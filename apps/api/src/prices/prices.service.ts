import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const STEAM_APP_ID = 730; // CS2
const STEAM_CURRENCY_USD = 1;
// Valve doesn't publish a hard limit for this endpoint, but it's known to
// soft-rate-limit aggressive callers. This is deliberately conservative —
// nothing user-facing is waiting on a sync pass, so there's no reason to
// push it. Only applies to the Steam fallback path now (see below) — the
// Skinport pass is one bulk request, not one per skin.
const REQUEST_SPACING_MS = 1500;
const DEFAULT_FX_RUB_PER_USD = 95;

interface SkinportListing {
  market_hash_name: string;
  currency: string;
  min_price: number | null;
  suggested_price: number | null;
}

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
 * shares that name — same end result (one skin, one live price, wherever it
 * appears), far smaller blast radius.
 *
 * Primary source is Skinport's public catalog (GET /v1/items, no key) — one
 * bulk request returns every listed item's price, so a full pass is one
 * HTTP call plus an in-memory lookup per skin instead of 1000+ individual
 * requests. Steam's per-item priceoverview endpoint is kept as a fallback
 * for any name Skinport doesn't carry, at the same conservative pace as
 * before.
 *
 * NOTE on match rate: our CaseItem.name values are simplified ("AK-47 |
 * Redline") without the wear/exterior suffix both Skinport's
 * market_hash_name and Steam's actually key on ("AK-47 | Redline
 * (Field-Tested)"), and knives are missing their "★ " / StatTrak prefix
 * formatting in some cases. Expect a meaningful chunk of `skipped` on the
 * first real run against live network access — that's a data-quality gap
 * in the seeded names, not a bug here. Fix it by tightening names once real
 * skip/hit rates are visible.
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
      bySource: { skinport: 0, steam: 0 },
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

    // One bulk call covers most of the catalog; only names it doesn't carry
    // fall through to the slow per-item Steam path below.
    const skinport = await this.fetchSkinportCatalog();
    this.logger.log(`skinport catalog: ${skinport ? skinport.size : 0} listings fetched`);

    const misses: string[] = [];
    for (const name of names) {
      const usdValueMinor = skinport?.get(name);
      if (usdValueMinor === undefined) {
        misses.push(name);
        continue;
      }
      await this.applyPrice(name, usdValueMinor, "skinport", summary);
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
          await this.applyPrice(name, usdValueMinor, "steam", summary);
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
    source: "skinport" | "steam",
    summary: PriceSyncSummary,
  ) {
    await this.prisma.skinPrice.upsert({
      where: { name },
      create: { name, usdValueMinor, source, lastSyncedAt: new Date(), syncFailCount: 0 },
      update: { usdValueMinor, source, lastSyncedAt: new Date(), syncFailCount: 0 },
    });
    await this.propagate(name, usdValueMinor);
    summary.updated++;
    summary.bySource[source]++;
  }

  /** Skinport's public catalog — no key required. Returns null (not an
   * empty map) on any fetch/parse failure, so callers can tell "nothing
   * matched" apart from "couldn't even reach Skinport" and fall everything
   * through to the Steam path rather than silently treating a down/blocked
   * Skinport as "this catalog has zero listings". */
  private async fetchSkinportCatalog(): Promise<Map<string, bigint> | null> {
    try {
      const res = await fetch("https://api.skinport.com/v1/items?app_id=730&currency=USD", {
        headers: { "Accept-Encoding": "br", "User-Agent": "Mozilla/5.0 (GunDone.case price sync)" },
      });
      if (!res.ok) throw new Error(`skinport /v1/items HTTP ${res.status}`);

      const body = (await res.json()) as SkinportListing[];
      if (!Array.isArray(body)) throw new Error("skinport /v1/items: unexpected response shape");

      const map = new Map<string, bigint>();
      for (const listing of body) {
        // min_price is what you'd actually pay right now; suggested_price
        // is Skinport's own estimate for items with no current listings.
        const price = listing.min_price ?? listing.suggested_price;
        if (price === null || price === undefined || price <= 0) continue;
        map.set(listing.market_hash_name, BigInt(Math.round(price * 100)));
      }
      return map;
    } catch (err) {
      this.logger.warn(`skinport catalog fetch failed, falling back to Steam for everything: ${err instanceof Error ? err.message : err}`);
      return null;
    }
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
