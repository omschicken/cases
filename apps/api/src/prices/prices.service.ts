import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const STEAM_APP_ID = 730; // CS2
const STEAM_CURRENCY_USD = 1;
// Valve doesn't publish a hard limit for this endpoint, but it's known to
// soft-rate-limit aggressive callers. This is deliberately conservative —
// nothing user-facing is waiting on a sync pass, so there's no reason to
// push it.
const REQUEST_SPACING_MS = 1500;
const DEFAULT_FX_RUB_PER_USD = 95;

export interface PriceSyncSummary {
  startedAt: Date;
  finishedAt: Date | null;
  totalNames: number;
  updated: number;
  failed: number;
  skipped: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps CaseItem.valueMinor in sync with a real external market instead of
 * the static numbers cases were originally seeded with.
 *
 * Deliberately does NOT normalize CaseItem into a foreign-key relation on a
 * shared skin table — that would touch every read path (openCase, sellItem,
 * verifyOpenEvent, recent-drops, admin case creation, the frontend's CaseDto
 * shape). Instead this fetches one canonical USD price per unique skin
 * name, records it in SkinPrice, and bulk-updates every CaseItem row that
 * shares that name — same end result (one skin, one live price, wherever it
 * appears), far smaller blast radius.
 *
 * NOTE on match rate: our CaseItem.name values are simplified ("AK-47 |
 * Redline") without the wear/exterior suffix Steam's market_hash_name
 * actually keys on ("AK-47 | Redline (Field-Tested)"), and knives are
 * missing their "★ " / StatTrak prefix formatting in some cases. Expect a
 * meaningful chunk of `skipped` on the first real run against live network
 * access — that's a data-quality gap in the seeded names, not a bug here.
 * Fix it by tightening names once real skip/hit rates are visible.
 */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private running = false;
  private lastSummary: PriceSyncSummary | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get fxRubPerUsd(): number {
    const raw = this.config.get<string>("USD_TO_RUB_RATE");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FX_RUB_PER_USD;
  }

  getStatus() {
    return { running: this.running, lastSummary: this.lastSummary };
  }

  /** Kicks off a (long-running) full sync in the background and returns
   * immediately — a pass over 1000+ skins at a polite request rate takes
   * tens of minutes, far too long to hold an admin's HTTP request open. */
  triggerSync(): PriceSyncSummary {
    if (this.running && this.lastSummary) return this.lastSummary;

    const summary: PriceSyncSummary = {
      startedAt: new Date(),
      finishedAt: null,
      totalNames: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
    };
    this.lastSummary = summary;
    this.running = true;

    this.runSync(summary)
      .catch((err) => this.logger.error(`price sync crashed: ${err instanceof Error ? err.message : err}`))
      .finally(() => {
        this.running = false;
        summary.finishedAt = new Date();
      });

    return summary;
  }

  // Skin prices drift over hours/days, not minutes — a daily pass keeps
  // everything reasonably current without hammering the source.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  handleCron() {
    this.logger.log("starting scheduled daily price sync");
    this.triggerSync();
  }

  private async runSync(summary: PriceSyncSummary) {
    const rows = await this.prisma.caseItem.findMany({
      distinct: ["name"],
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const names = rows.map((r) => r.name);
    summary.totalNames = names.length;
    this.logger.log(`price sync: ${names.length} unique skins to check`);

    for (const name of names) {
      try {
        const usdValueMinor = await this.fetchSteamPriceMinor(name);
        if (usdValueMinor === null) {
          summary.skipped++;
          await this.prisma.skinPrice.upsert({
            where: { name },
            create: { name, usdValueMinor: 0n, source: "steam", syncFailCount: 1 },
            update: { syncFailCount: { increment: 1 } },
          });
        } else {
          await this.prisma.skinPrice.upsert({
            where: { name },
            create: { name, usdValueMinor, source: "steam", lastSyncedAt: new Date(), syncFailCount: 0 },
            update: { usdValueMinor, lastSyncedAt: new Date(), syncFailCount: 0 },
          });
          await this.propagate(name, usdValueMinor);
          summary.updated++;
        }
      } catch (err) {
        summary.failed++;
        this.logger.warn(`price sync failed for "${name}": ${err instanceof Error ? err.message : err}`);
      }
      await sleep(REQUEST_SPACING_MS);
    }

    this.logger.log(
      `price sync done: ${summary.updated} updated, ${summary.skipped} skipped (no listing), ${summary.failed} failed`,
    );
  }

  /** Pushes a freshly-fetched USD price out to every CaseItem row sharing
   * this skin name. USD-tagged rows take it directly; RUB-tagged rows get
   * it converted at the configured rate — never a case's sticker price
   * itself, only what a specific drop is worth. */
  private async propagate(name: string, usdValueMinor: bigint) {
    await this.prisma.caseItem.updateMany({
      where: { name, currency: "USD" },
      data: { valueMinor: usdValueMinor },
    });
    const rubValueMinor = BigInt(Math.round(Number(usdValueMinor) * this.fxRubPerUsd));
    await this.prisma.caseItem.updateMany({
      where: { name, currency: "RUB" },
      data: { valueMinor: rubValueMinor },
    });
  }

  /** Steam's public, keyless price-overview endpoint. Returns null ONLY when
   * Steam itself responds normally but has no active listing for this exact
   * market_hash_name — that's the one case worth counting as "skipped"
   * (name mismatch, delisted item, etc). Anything else — non-2xx HTTP
   * (blocked egress, Valve rate-limiting, transient 5xx), a malformed body —
   * throws instead, so the caller buckets it as `failed`, not `skipped`.
   * Conflating the two would make a summary read as "these skins don't
   * exist on Steam" when the real story is "we couldn't reach Steam". */
  private async fetchSteamPriceMinor(marketHashName: string): Promise<bigint | null> {
    const url =
      `https://steamcommunity.com/market/priceoverview/` +
      `?appid=${STEAM_APP_ID}&currency=${STEAM_CURRENCY_USD}&market_hash_name=${encodeURIComponent(marketHashName)}`;

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (GunDone.case price sync)" } });
    if (!res.ok) throw new Error(`steam priceoverview HTTP ${res.status}`);

    const body = (await res.json()) as { success?: boolean; lowest_price?: string; median_price?: string };
    if (!body.success) return null;

    const raw = body.lowest_price ?? body.median_price;
    if (!raw) return null;

    // "$12.34" / "12,34€" / "1 234,56 pуб." — strip everything but digits,
    // dot and comma, then normalize to a plain "12.34" before parsing.
    const cleaned = raw.replace(/[^\d.,]/g, "");
    const normalized =
      cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;

    return BigInt(Math.round(value * 100));
  }
}
