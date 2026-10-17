import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SiteStats {
  totalOpenings: number;
  bestDrop: { itemName: string; value: string; rarity: string } | null;
  playerCount: number;
}

const CACHE_TTL_MS = 5 * 60_000;

@Injectable()
export class StatsService {
  private cache: { at: number; data: SiteStats } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SiteStats> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.data;

    // Seed-script bot accounts are decoration, not real activity (same rule as /cases/stats).
    const [{ opens }] = await this.prisma.$queryRaw<{ opens: bigint }[]>`
      SELECT COUNT(*)::bigint AS opens
      FROM "CaseOpenEvent" e JOIN "User" u ON u."id" = e."userId"
      WHERE u."email" NOT LIKE '%@bots.internal'
    `;
    const best = await this.prisma.$queryRaw<{ name: string; valueMinor: bigint; rarity: string }[]>`
      SELECT ci."name", ci."valueMinor", ci."rarity"::text AS "rarity"
      FROM "CaseOpenEvent" e
      JOIN "CaseItem" ci ON ci."id" = e."resultCaseItemId"
      JOIN "User" u ON u."id" = e."userId"
      WHERE u."email" NOT LIKE '%@bots.internal'
      ORDER BY ci."valueMinor" DESC
      LIMIT 1
    `;
    const playerCount = await this.prisma.user.count({ where: { email: { not: { endsWith: "@bots.internal" } } } });

    const data: SiteStats = {
      totalOpenings: Number(opens),
      bestDrop: best[0]
        ? { itemName: best[0].name, value: best[0].valueMinor.toString(), rarity: best[0].rarity }
        : null,
      playerCount,
    };
    this.cache = { at: Date.now(), data };
    return data;
  }
}
