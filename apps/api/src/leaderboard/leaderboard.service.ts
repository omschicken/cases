import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  totalWinnings: number; // kopecks
  totalOpenings: number;
  bestWin: number; // kopecks
}

const CACHE_TTL_MS = 60_000;

interface Row {
  userId: string;
  displayName: string | null;
  email: string;
  avatar: string | null;
  totalWinnings: bigint;
  totalOpenings: bigint;
  bestWin: bigint;
}

/** Public name: the chosen display name, else a masked email prefix — never the full local part. */
export function publicName(displayName: string | null, email: string): string {
  const name = displayName?.trim();
  if (name) return name;
  const prefix = email.split("@")[0] ?? "";
  return `${prefix.slice(0, 2)}***`;
}

@Injectable()
export class LeaderboardService {
  private cache: { at: number; data: LeaderboardEntry[] } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async top(limit = 50): Promise<LeaderboardEntry[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.data;

    // A "win" is an opening whose item is worth more than the case costs.
    // Price is the case's current price (openings don't snapshot it).
    // Admin accounts are excluded so test openings can't top the board.
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        u."id" AS "userId",
        u."displayName" AS "displayName",
        u."email" AS "email",
        u."steamAvatarUrl" AS "avatar",
        SUM(ci."valueMinor")::bigint AS "totalWinnings",
        COUNT(*)::bigint AS "totalOpenings",
        MAX(ci."valueMinor")::bigint AS "bestWin"
      FROM "CaseOpenEvent" e
      JOIN "CaseItem" ci ON ci."id" = e."resultCaseItemId"
      JOIN "Case" c ON c."id" = e."caseId"
      JOIN "User" u ON u."id" = e."userId"
      WHERE ci."valueMinor" > c."priceMinor" AND u."role" <> 'ADMIN'
      GROUP BY u."id"
      ORDER BY "totalWinnings" DESC, "totalOpenings" DESC
      LIMIT ${limit}
    `;

    // totalOpenings above counts winning openings only; fetch the real count per listed user.
    const ids = rows.map((r) => r.userId);
    const counts = ids.length
      ? await this.prisma.caseOpenEvent.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } })
      : [];
    const openings = new Map(counts.map((c) => [c.userId, c._count._all]));

    const data = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: publicName(r.displayName, r.email),
      ...(r.avatar ? { avatar: r.avatar } : {}),
      totalWinnings: Number(r.totalWinnings),
      totalOpenings: openings.get(r.userId) ?? Number(r.totalOpenings),
      bestWin: Number(r.bestWin),
    }));
    this.cache = { at: Date.now(), data };
    return data;
  }
}
