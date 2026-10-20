import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fetchMarketCsgoPrices } from "./market-csgo";
import { fetchSkinMeta } from "./market-images";

/** A weapon skin / knife / glove name always ends with its wear. */
const WEAR_RE = /\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;
const FRESH_MS = 55_000;
const FORCE_MIN_GAP_S = 8;
const CHUNK = 4000;
const IMAGE_RETRY_S = 3600;
const DEFAULT_FX_RUB_PER_USD = 95;

export interface MarketSyncStatus {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  durationMs: number | null;
  itemsSynced: number | null;
  casesUpdated: number | null;
  lastError: string | null;
  skinsListed: number;
  itemsTotal: number;
  withImages: number;
}

export interface MarketItemDto {
  name: string;
  category: string;
  priceMinor: string;
  currency: "USD" | "RUB";
  volume: number;
  imageUrl: string | null;
  rarity: string | null;
}

export interface MarketItemQuery {
  q?: string;
  category?: string;
  currency?: string;
  min?: number;
  max?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

/**
 * The whole Market.CSGO catalog (~27k names) lives in `market_item`, refreshed
 * every minute from two bulk price lists with a handful of set-based SQL
 * statements — no per-skin requests. Active case items are re-priced from it in
 * one UPDATE. Tables are created on first use so no manual migration is needed.
 *
 * Serverless note: work must finish inside the request that starts it (Vercel
 * freezes the function afterwards), so every entry point awaits the sync. A
 * claim row in `market_sync_state` keeps concurrent instances from duplicating it.
 */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private ready: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private ensureTables(): Promise<void> {
    this.ready ??= (async () => {
      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS market_item (
        name text PRIMARY KEY, category text NOT NULL, rub_minor bigint NOT NULL, usd_minor bigint NOT NULL,
        volume integer NOT NULL DEFAULT 0, image_url text, rarity text, listed boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT now())`);
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS market_item_browse ON market_item (category, listed, usd_minor)`,
      );
      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS market_sync_state (
        id integer PRIMARY KEY, last_started timestamptz, last_finished timestamptz, duration_ms integer,
        items integer, cases_updated integer, last_error text, images_attempted_at timestamptz)`);
      await this.prisma.$executeRawUnsafe(`INSERT INTO market_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING`);
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  async getStatus(): Promise<MarketSyncStatus> {
    await this.ensureTables();
    const [s] = await this.prisma.$queryRaw<
      {
        last_started: Date | null;
        last_finished: Date | null;
        duration_ms: number | null;
        items: number | null;
        cases_updated: number | null;
        last_error: string | null;
      }[]
    >`SELECT last_started, last_finished, duration_ms, items, cases_updated, last_error FROM market_sync_state WHERE id = 1`;
    const [c] = await this.prisma.$queryRaw<{ skins: bigint; total: bigint; imgs: bigint }[]>`
      SELECT count(*) FILTER (WHERE listed AND category = 'skin') AS skins, count(*) AS total,
             count(*) FILTER (WHERE image_url IS NOT NULL) AS imgs FROM market_item`;
    return {
      lastStartedAt: s?.last_started?.toISOString() ?? null,
      lastFinishedAt: s?.last_finished?.toISOString() ?? null,
      durationMs: s?.duration_ms ?? null,
      itemsSynced: s?.items ?? null,
      casesUpdated: s?.cases_updated ?? null,
      lastError: s?.last_error ?? null,
      skinsListed: Number(c?.skins ?? 0),
      itemsTotal: Number(c?.total ?? 0),
      withImages: Number(c?.imgs ?? 0),
    };
  }

  /** Runs a sync only if the data is older than a minute. Safe to call from anywhere. */
  async ensureFresh(): Promise<void> {
    await this.ensureTables();
    const [row] = await this.prisma.$queryRaw<{ stale: boolean }[]>`
      SELECT (last_finished IS NULL OR last_finished < now() - ${FRESH_MS / 1000} * interval '1 second') AS stale
      FROM market_sync_state WHERE id = 1`;
    if (row?.stale) await this.syncNow(false).catch(() => undefined);
  }

  /** Claims the run atomically; returns false if another instance synced very recently. */
  private async claim(force: boolean): Promise<boolean> {
    const gap = force ? FORCE_MIN_GAP_S : FRESH_MS / 1000;
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      UPDATE market_sync_state SET last_started = now()
      WHERE id = 1 AND (last_started IS NULL OR last_started < now() - ${gap} * interval '1 second')
      RETURNING id`;
    return rows.length > 0;
  }

  async syncNow(force: boolean): Promise<MarketSyncStatus> {
    await this.ensureTables();
    if (!(await this.claim(force))) return this.getStatus();

    const t0 = Date.now();
    try {
      const [rub, usd] = await Promise.all([fetchMarketCsgoPrices("RUB"), fetchMarketCsgoPrices("USD")]);
      const fx = [...rub.entries()].reduce((acc, [n, r]) => {
        const u = usd.get(n);
        return u && acc.n < 200 ? { sum: acc.sum + r.priceMinor / u.priceMinor, n: acc.n + 1 } : acc;
      }, { sum: 0, n: 0 });
      const rubPerUsd = fx.n > 0 ? fx.sum / fx.n : DEFAULT_FX_RUB_PER_USD;

      const names: string[] = [];
      const cats: string[] = [];
      const rubs: string[] = [];
      const usds: string[] = [];
      const vols: string[] = [];
      for (const [name, r] of rub) {
        const u = usd.get(name);
        names.push(name);
        cats.push(WEAR_RE.test(name) ? "skin" : "other");
        rubs.push(String(r.priceMinor));
        usds.push(String(u ? u.priceMinor : Math.max(1, Math.round(r.priceMinor / rubPerUsd))));
        vols.push(String(r.volume));
      }

      const runAt = new Date();
      for (let i = 0; i < names.length; i += CHUNK) {
        await this.prisma.$executeRaw`
          INSERT INTO market_item (name, category, rub_minor, usd_minor, volume, listed, updated_at)
          SELECT t.name, t.cat, t.rub::bigint, t.usd::bigint, t.vol::integer, true, ${runAt}
          FROM unnest(${names.slice(i, i + CHUNK)}::text[], ${cats.slice(i, i + CHUNK)}::text[],
                      ${rubs.slice(i, i + CHUNK)}::text[], ${usds.slice(i, i + CHUNK)}::text[],
                      ${vols.slice(i, i + CHUNK)}::text[]) AS t(name, cat, rub, usd, vol)
          ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, rub_minor = EXCLUDED.rub_minor,
            usd_minor = EXCLUDED.usd_minor, volume = EXCLUDED.volume, listed = true, updated_at = EXCLUDED.updated_at`;
      }
      await this.prisma.$executeRaw`UPDATE market_item SET listed = false WHERE listed AND updated_at < ${runAt}`;

      const casesUpdated = await this.prisma.$executeRaw`
        UPDATE "CaseItem" ci
        SET "valueMinor" = CASE WHEN ci.currency = 'USD' THEN m.usd_minor ELSE m.rub_minor END
        FROM market_item m, "Case" c
        WHERE m.name = ci.name AND m.listed AND c.id = ci."caseId" AND c."isActive"
          AND ci."valueMinor" IS DISTINCT FROM (CASE WHEN ci.currency = 'USD' THEN m.usd_minor ELSE m.rub_minor END)`;

      await this.syncImages().catch((err) =>
        this.logger.warn(`image sync skipped: ${err instanceof Error ? err.message : err}`),
      );

      await this.prisma.$executeRaw`
        UPDATE market_sync_state SET last_finished = now(), duration_ms = ${Date.now() - t0},
          items = ${names.length}, cases_updated = ${casesUpdated}, last_error = NULL WHERE id = 1`;
      this.logger.log(`market sync: ${names.length} items, ${casesUpdated} case items repriced, ${Date.now() - t0} ms`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`market sync failed: ${message}`);
      await this.prisma.$executeRaw`UPDATE market_sync_state SET last_error = ${message.slice(0, 500)} WHERE id = 1`;
    }
    return this.getStatus();
  }

  /** Fills image/rarity for skins that have none. Retried at most hourly. */
  private async syncImages() {
    const [need] = await this.prisma.$queryRaw<{ missing: bigint; recent: boolean }[]>`
      SELECT (SELECT count(*) FROM market_item WHERE category = 'skin' AND image_url IS NULL) AS missing,
             COALESCE((SELECT images_attempted_at > now() - ${IMAGE_RETRY_S} * interval '1 second'
                       FROM market_sync_state WHERE id = 1), false) AS recent`;
    if (!need || Number(need.missing) < 50 || need.recent) return;
    await this.prisma.$executeRaw`UPDATE market_sync_state SET images_attempted_at = now() WHERE id = 1`;

    const meta = await fetchSkinMeta();
    const names = [...meta.keys()];
    for (let i = 0; i < names.length; i += CHUNK) {
      const part = names.slice(i, i + CHUNK);
      await this.prisma.$executeRaw`
        UPDATE market_item m SET image_url = t.img, rarity = t.rar
        FROM unnest(${part}::text[], ${part.map((n) => meta.get(n)!.imageUrl)}::text[],
                    ${part.map((n) => meta.get(n)!.rarity ?? "")}::text[]) AS t(name, img, rar)
        WHERE m.name = t.name`;
    }
    await this.prisma.$executeRaw`UPDATE market_item SET rarity = NULL WHERE rarity = ''`;
  }

  async listItems(query: MarketItemQuery): Promise<{ total: number; items: MarketItemDto[] }> {
    await this.ensureFresh();
    const currency: "USD" | "RUB" = query.currency?.toUpperCase() === "RUB" ? "RUB" : "USD";
    const col = Prisma.raw(currency === "RUB" ? "rub_minor" : "usd_minor");
    const where: Prisma.Sql[] = [Prisma.sql`listed`];
    if (query.category !== "all") where.push(Prisma.sql`category = ${query.category === "other" ? "other" : "skin"}`);
    if (query.q?.trim()) where.push(Prisma.sql`name ILIKE ${"%" + query.q.trim().replace(/[%_\\]/g, "\\$&") + "%"}`);
    if (Number.isFinite(query.min)) where.push(Prisma.sql`${col} >= ${Math.round(query.min!)}`);
    if (Number.isFinite(query.max)) where.push(Prisma.sql`${col} <= ${Math.round(query.max!)}`);
    const order =
      query.sort === "price_desc" ? Prisma.sql`${col} DESC, name` : query.sort === "name" ? Prisma.sql`name` : Prisma.sql`${col}, name`;
    const limit = Math.min(Math.max(Math.floor(query.limit ?? 50), 1), 200);
    const offset = Math.max(Math.floor(query.offset ?? 0), 0);
    const cond = Prisma.join(where, " AND ");

    const [count] = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM market_item WHERE ${cond}`;
    const rows = await this.prisma.$queryRaw<
      { name: string; category: string; price: bigint; volume: number; image_url: string | null; rarity: string | null }[]
    >`SELECT name, category, ${col} AS price, volume, image_url, rarity FROM market_item WHERE ${cond}
      ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`;
    return {
      total: Number(count?.n ?? 0),
      items: rows.map((r) => ({
        name: r.name,
        category: r.category,
        priceMinor: r.price.toString(),
        currency,
        volume: r.volume,
        imageUrl: r.image_url,
        rarity: r.rarity,
      })),
    };
  }
}
