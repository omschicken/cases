import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fetchCsMoneyPrices } from "./cs-money";
import { fetchSkinMeta } from "./market-images";
import { resolveMarketName } from "./market-names";
import { matchesCaseTheme } from "./case-theme";
import { marketCasePrice } from "./case-pricing";
import { balanceCase } from "./case-balance";
import { pickCaseItems, toItemRarity, type Candidate } from "./case-populate";

/** A weapon skin / knife / glove name always ends with its wear. */
const WEAR_RE = /\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;
const FRESH_MS = 55_000;
const FORCE_MIN_GAP_S = 8;
const CHUNK = 4000;
const IMAGE_RETRY_S = 3600;


export interface MarketSyncStatus {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  durationMs: number | null;
  itemsSynced: number | null;
  casesUpdated: number | null;
  lastError: string | null;
  source: "CS.MONEY";
  mode: "active-case-batches";
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

export interface CaseBalanceRow {
  slug: string;
  currency: string;
  oldPriceMinor: string;
  priceMinor: string;
  rtp: number;
  itemCount: number;
  /** Share of opens that return at least the case price. */
  winShare: number;
  /** Return (x price) that half of all opens reach. */
  medianReturn: number;
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
 * Exact CS.MONEY quotes for active case items live in `market_item`, refreshed
 * in small rotating batches from public CS.MONEY snapshots with set-based SQL
 * statements. Active case items are re-priced from it in
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
      await this.prisma.$executeRawUnsafe(`ALTER TABLE market_item ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'market.csgo'`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE market_sync_state ADD COLUMN IF NOT EXISTS cs_money_cursor integer NOT NULL DEFAULT 0`);
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
      source: "CS.MONEY",
      mode: "active-case-batches",
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
      const targets = await this.prisma.$queryRaw<{name:string}[]>`SELECT DISTINCT ci.name FROM "CaseItem" ci JOIN "Case" c ON c.id=ci."caseId" WHERE c."isActive" ORDER BY ci.name`;
      if (!targets.length) throw new Error("No active case prices to synchronize");
      const batchSize = 8;
      const [cursor] = await this.prisma.$queryRaw<{cs_money_cursor:number}[]>`SELECT cs_money_cursor FROM market_sync_state WHERE id=1`;
      const offset = (cursor?.cs_money_cursor ?? 0) % targets.length;
      const requested = targets.slice(offset, offset + batchSize).map(row => row.name);
      const nextCursor = (offset + requested.length) % targets.length;
      const quotes = await fetchCsMoneyPrices(requested);
      if (!quotes.size) {
        await this.prisma.$executeRaw`UPDATE market_sync_state SET cs_money_cursor=${nextCursor},last_finished=now(),last_error='CS.MONEY: no exact matches in this batch; prices retained' WHERE id=1`;
        return this.getStatus();
      }
      const names = [...quotes.keys()];
      const cats = names.map(name => WEAR_RE.test(name) ? "skin" : "other");
      const rubs = names.map(name => String(quotes.get(name)!.rubMinor));
      const usds = names.map(name => String(quotes.get(name)!.usdMinor));
      const vols = names.map(name => String(quotes.get(name)!.volume));

      const runAt = new Date();
      for (let i = 0; i < names.length; i += CHUNK) {
        await this.prisma.$executeRaw`
          INSERT INTO market_item (name, category, rub_minor, usd_minor, volume, listed, updated_at, price_source)
          SELECT t.name, t.cat, t.rub::bigint, t.usd::bigint, t.vol::integer, true, ${runAt}, 'cs.money'
          FROM unnest(${names.slice(i, i + CHUNK)}::text[], ${cats.slice(i, i + CHUNK)}::text[],
                      ${rubs.slice(i, i + CHUNK)}::text[], ${usds.slice(i, i + CHUNK)}::text[],
                      ${vols.slice(i, i + CHUNK)}::text[]) AS t(name, cat, rub, usd, vol)
          ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, rub_minor = EXCLUDED.rub_minor,
            usd_minor = EXCLUDED.usd_minor, volume = EXCLUDED.volume, listed = true, updated_at = EXCLUDED.updated_at, price_source=EXCLUDED.price_source`;
      }
      // This is an incremental batch, never mark the unvisited catalog as unavailable.

      // Preserve exact wears and phase identities; no fallback to a different item.
      const renamed = 0;
      const casesUpdated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "CaseItem" ci
        SET "valueMinor" = CASE WHEN ci.currency = 'USD' THEN m.usd_minor ELSE m.rub_minor END
        FROM market_item m, "Case" c
        WHERE m.name = ci.name AND m.name = ANY(${names}::text[]) AND m.listed AND c.id = ci."caseId" AND c."isActive"
          AND ci."valueMinor" IS DISTINCT FROM (CASE WHEN ci.currency = 'USD' THEN m.usd_minor ELSE m.rub_minor END)`;
      // Refresh the opening price in the same transaction as its quoted drops.
      // Existing weights and historical pools are never changed by the sync.
      const minimums: Record<string,number> = {fade:119900,doppler:199900,'ruby-crystal':499900,'sapphire-crystal':499900};
      const themed = await tx.case.findMany({where:{isActive:true,slug:{in:Object.keys(minimums)},items:{some:{name:{in:names}}}},include:{items:true}});
      for (const c of themed) {
        const priceMinor = BigInt(marketCasePrice(c.items.map(i=>({weight:i.weight,valueMinor:Number(i.valueMinor)})),minimums[c.slug]));
        if(c.priceMinor!==priceMinor) await tx.case.update({where:{id:c.id},data:{priceMinor}});
      }
      return updated;
      });

      await this.syncImages().catch((err) =>
        this.logger.warn(`image sync skipped: ${err instanceof Error ? err.message : err}`),
      );

      await this.prisma.$executeRaw`
        UPDATE market_sync_state SET last_finished = now(), duration_ms = ${Date.now() - t0},
          items = ${names.length}, cases_updated = ${casesUpdated}, cs_money_cursor=${nextCursor}, last_error = NULL WHERE id = 1`;
      this.logger.log(`market sync: ${names.length} items, ${casesUpdated} case items repriced (${renamed} renamed), ${Date.now() - t0} ms`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`market sync failed: ${message}`);
      await this.prisma.$executeRaw`UPDATE market_sync_state SET last_error = ${message.slice(0, 500)} WHERE id = 1`;
    }
    return this.getStatus();
  }

  /** Case items seeded with short names ("(FN)", knives without ★) never match the
   * market. Rename them to the exact market_hash_name (and take its real image). */
  private async repairCaseItemNames(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT DISTINCT ci.name FROM "CaseItem" ci JOIN "Case" c ON c.id = ci."caseId" AND c."isActive"
      WHERE NOT EXISTS (SELECT 1 FROM market_item m WHERE m.name = ci.name AND m.listed)`;
    if (rows.length === 0) return 0;
    const listed = new Set((await this.prisma.$queryRaw<{ name: string }[]>`SELECT name FROM market_item WHERE listed`).map((r) => r.name));
    const fixes = rows
      .map((r) => ({ from: r.name, to: resolveMarketName(r.name, (n) => listed.has(n)) }))
      .filter((f): f is { from: string; to: string } => f.to !== null && f.to !== f.from);
    for (let i = 0; i < fixes.length; i += 10) {
      await Promise.all(
        fixes.slice(i, i + 10).map(
          (f) => this.prisma.$executeRaw`
            UPDATE "CaseItem" ci SET name = ${f.to}, "imageUrl" = COALESCE(m.image_url, ci."imageUrl")
            FROM market_item m, "Case" c
            WHERE m.name = ${f.to} AND ci.name = ${f.from} AND c.id = ci."caseId" AND c."isActive"`,
        ),
      );
    }
    const unresolved = rows.length - fixes.length;
    if (unresolved > 0) this.logger.warn(`${unresolved} case item names have no market match`);
    return fixes.length;
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

  /** Tops every active case up to 24–28 drops with real, priced skins from the market
   * catalog. Existing drops are kept (opened items reference them); weights are set
   * afterwards by rebalanceCases. */
  async populateCases(): Promise<number> {
    await this.ensureTables();
    const cases = await this.prisma.case.findMany({
      where: { isActive: true },
      include: { items: { select: { name: true } } },
      orderBy: { displayOrder: "asc" },
    });
    const rows = await this.prisma.$queryRaw<
      { name: string; rub_minor: bigint; usd_minor: bigint; image_url: string; rarity: string | null }[]
    >`SELECT name, rub_minor, usd_minor, image_url, rarity FROM market_item
      WHERE listed AND category = 'skin' AND volume >= 3 AND image_url IS NOT NULL AND rub_minor >= 1000 AND name NOT LIKE 'Souvenir %' AND name NOT LIKE '%StatTrak%'`;

    const taken = new Set<string>(cases.flatMap((c) => c.items.map((i) => i.name)));
    let added = 0;
    for (const c of cases) {
      const target = 24 + (c.slug.length % 5);
      const need = target - c.items.length;
      if (need <= 0) continue;
      const price = Number(c.priceMinor);
      const candidates: Candidate[] = rows.filter(r => matchesCaseTheme(c.slug, r.name)).map((r) => ({
        name: r.name,
        priceMinor: Number(c.currency === "USD" ? r.usd_minor : r.rub_minor),
        imageUrl: r.image_url,
        rarity: r.rarity,
      }));
      const picked = pickCaseItems(candidates, price, need, taken, Math.random);
      if (picked.length === 0) continue;
      await this.prisma.caseItem.createMany({
        data: picked.map((p) => ({
          caseId: c.id,
          name: p.name,
          imageUrl: p.imageUrl,
          weight: 1,
          valueMinor: BigInt(p.priceMinor),
          currency: c.currency,
          rarity: toItemRarity(p.rarity, p.priceMinor, price),
        })),
      });
      added += picked.length;
    }
    return added;
  }

  /** Sets every active case's drop chances (and, when needed, price) so its RTP equals `targetRtp`.
   * Changing weights changes the odds that past opens were verified against, so this is a
   * deliberate admin action, not part of the minute sync. */
  async rebalanceCases(targetRtp = 0.9): Promise<CaseBalanceRow[]> {
    const cases = await this.prisma.case.findMany({
      where: { isActive: true },
      include: { items: { orderBy: { valueMinor: "asc" } } },
      orderBy: { displayOrder: "asc" },
    });
    const rows: CaseBalanceRow[] = [];
    for (const c of cases) {
      if (c.items.length === 0 || c.items.some((i) => i.currency !== c.currency)) continue;
      const result = balanceCase(
        {
          priceMinor: Number(c.priceMinor),
          valuesMinor: c.items.map((i) => Number(i.valueMinor)),
          priceStepMinor: c.currency === "RUB" ? 1000 : 100,
        },
        targetRtp,
      );
      await this.prisma.$transaction([
        this.prisma.case.update({ where: { id: c.id }, data: { priceMinor: BigInt(result.priceMinor) } }),
        ...c.items.map((item, i) =>
          this.prisma.caseItem.update({ where: { id: item.id }, data: { weight: Number((result.probabilities[i] * 100).toFixed(6)) } }),
        ),
      ]);
      rows.push({
        slug: c.slug,
        currency: c.currency,
        oldPriceMinor: c.priceMinor.toString(),
        priceMinor: String(result.priceMinor),
        rtp: Number(result.rtp.toFixed(4)),
        itemCount: c.items.length,
        winShare: Number(result.winShare.toFixed(3)),
        medianReturn: Number(result.medianReturn.toFixed(2)),
      });
    }
    return rows;
  }

  async listItems(query: MarketItemQuery): Promise<{ total: number; items: MarketItemDto[] }> {
    await this.ensureTables();
    const fresh = this.ensureFresh();
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

    const countQ = this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM market_item WHERE ${cond}`;
    const rowsQ = this.prisma.$queryRaw<
      { name: string; category: string; price: bigint; volume: number; image_url: string | null; rarity: string | null }[]
    >`SELECT name, category, ${col} AS price, volume, image_url, rarity FROM market_item WHERE ${cond}
      ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`;
    // Staleness check and both reads run together; a sync (rare) is awaited first.
    const [, [count], rows] = await Promise.all([fresh, countQ, rowsQ]);
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
