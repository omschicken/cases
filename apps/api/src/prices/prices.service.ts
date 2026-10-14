import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { fetchMarketListings } from "./market-catalog";

const STEAM_APP_ID = 730; // CS2
const STEAM_CURRENCY_USD = 1;
// Valve doesn't publish a hard limit for this endpoint, but it's known to
// soft-rate-limit aggressive callers. This is deliberately conservative —
// nothing user-facing is waiting on a sync pass, so there's no reason to
// push it. Only applies to the Steam fallback path now (see below) — the
// Skinport pass is one bulk request, not one per skin.
const REQUEST_SPACING_MS = 1500;
const DEFAULT_FX_RUB_PER_USD = 95;

export interface PriceSyncSummary {
  startedAt: Date;
  finishedAt: Date | null;
  totalNames: number;
  updated: number;
  failed: number;
  skipped: number;
  bySource: { skinport: number; steam: number };
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
   * shares that name in the active catalog. Archived pools retain their
   * original values for historical verification.
 *
 * Active cases use exact market_hash_name values including wear. Skinport's
 * RUB catalog supplies the displayed price directly; the USD catalog feeds
 * the existing SkinPrice audit cache. Steam remains a fallback for an exact
 * name temporarily missing from Skinport.
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

    void this.syncNow().catch((err) => this.logger.error(`price sync crashed: ${err instanceof Error ? err.message : err}`));
    return this.lastSummary!;
  }

  /** Awaitable entry point for a long-running job outside Vercel Functions. */
  async syncNow(): Promise<PriceSyncSummary> {
    if (this.running) throw new Error("Price sync is already running");

    const summary: PriceSyncSummary = {
      startedAt: new Date(),
      finishedAt: null,
      totalNames: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      bySource: { skinport: 0, steam: 0 },
    };
    this.lastSummary = summary;
    this.running = true;

    try {
      await this.runSync(summary);
      return summary;
    } finally {
      this.running = false;
      summary.finishedAt = new Date();
    }
  }

  private async runSync(summary: PriceSyncSummary) {
    const rows = await this.prisma.caseItem.findMany({
      where: { case: { isActive: true } },
      distinct: ["name"],
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const names = rows.map((r) => r.name);
    summary.totalNames = names.length;
    this.logger.log(`price sync: ${names.length} unique skins to check`);

    // Skinport supports RUB directly. Converting USD with a fixed FX rate
    // would give users a different price from the actual RUB listing.
    const [rubPrices, usdPrices] = await Promise.all([
      fetchMarketListings("RUB"),
      fetchMarketListings("USD"),
    ]);
    this.logger.log(`skinport catalog: ${rubPrices.size} RUB listings fetched`);

    const misses: string[] = [];
    const matched: Array<{ name: string; usd: bigint; rub: bigint }> = [];
    for (const name of names) {
      const rubValueMinor = rubPrices.get(name);
      const usdValueMinor = usdPrices.get(name);
      if (rubValueMinor === undefined || usdValueMinor === undefined) {
        misses.push(name);
        continue;
      }
      matched.push({ name, usd: BigInt(usdValueMinor), rub: BigInt(rubValueMinor) });
    }
    // A small bounded batch avoids thousands of serial database round trips
    // while staying within the connection pool's normal capacity.
    for (let i = 0; i < matched.length; i += 8) {
      await Promise.all(matched.slice(i, i + 8).map(async ({ name, usd, rub }) => {
        try {
          await this.applyPrice(name, usd, rub, "skinport", summary);
        } catch (err) {
          summary.failed++;
          this.logger.warn(`price sync failed for "${name}": ${err instanceof Error ? err.message : err}`);
        }
      }));
    }

    for (const name of misses) {
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
          await this.applyPrice(name, usdValueMinor, null, "steam", summary);
        }
      } catch (err) {
        summary.failed++;
        this.logger.warn(`price sync failed for "${name}": ${err instanceof Error ? err.message : err}`);
      }
      await sleep(REQUEST_SPACING_MS);
    }

    this.logger.log(
      `price sync done: ${summary.updated} updated (${summary.bySource.skinport} skinport, ` +
        `${summary.bySource.steam} steam fallback), ${summary.skipped} skipped (no listing), ${summary.failed} failed`,
    );
  }

  private async applyPrice(
    name: string,
    usdValueMinor: bigint,
    rubValueMinor: bigint | null,
    source: "skinport" | "steam",
    summary: PriceSyncSummary,
  ) {
    await this.prisma.skinPrice.upsert({
      where: { name },
      create: { name, usdValueMinor, source, lastSyncedAt: new Date(), syncFailCount: 0 },
      update: { usdValueMinor, source, lastSyncedAt: new Date(), syncFailCount: 0 },
    });
    await this.propagate(name, usdValueMinor, rubValueMinor);
    summary.updated++;
    summary.bySource[source]++;
  }

  /** Update active drops only. Historical case pools keep their values. */
  private async propagate(name: string, usdValueMinor: bigint, rubValueMinor: bigint | null) {
    await this.prisma.caseItem.updateMany({
      where: { name, currency: "USD", case: { isActive: true } },
      data: { valueMinor: usdValueMinor },
    });
    const rubValue = rubValueMinor ?? BigInt(Math.round(Number(usdValueMinor) * this.fxRubPerUsd));
    await this.prisma.caseItem.updateMany({
      where: { name, currency: "RUB", case: { isActive: true } },
      data: { valueMinor: rubValue },
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
