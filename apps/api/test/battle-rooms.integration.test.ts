import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { WalletService } from "../src/wallet/wallet.service";
import { CasesService } from "../src/cases/cases.service";
import { GamesService } from "../src/games/games.service";

/** Runs only against the disposable PostgreSQL service configured by CI. */
describe("multiplayer battle rooms (integration)", () => {
  const prisma = new PrismaService();
  const wallet = new WalletService(prisma);
  const cases = new CasesService(prisma, wallet);
  const games = new GamesService(prisma, cases, wallet);

  afterAll(async () => { await prisma.$disconnect(); });

  async function createUser(balanceMinor = 50_000n) {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `battle-${id}@example.test`,
        passwordHash: "integration-only",
        referralCode: id.slice(0, 12).toUpperCase(),
        displayName: `Player ${id.slice(0, 4)}`,
        ageConfirmedAt: new Date(),
        wallet: { create: {} },
      },
    });
    await wallet.credit(user.id, balanceMinor, {
      reason: "DEPOSIT",
      referenceType: "BattleIntegration",
      referenceId: id,
    });
    return user.id;
  }

  async function createEligibleCase() {
    const id = randomUUID();
    return prisma.case.create({
      data: {
        slug: `battle-${id}`,
        name: "Battle Integration Case",
        priceMinor: 3_000n,
        currency: "RUB",
        imageUrl: "https://example.test/case.png",
        items: {
          create: [{
            name: "Battle Integration Skin",
            imageUrl: "https://example.test/item.png",
            valueMinor: 1_000n,
            weight: 100,
            rarity: "MIL_SPEC",
            currency: "RUB",
          }],
        },
      },
    });
  }

  it("deduplicates simultaneous room creation before charging the creator", async () => {
    const userId = await createUser();
    const battleCase = await createEligibleCase();
    const requestKey = randomUUID();

    const [first, retry] = await Promise.all([
      games.createBattleRoom(userId, requestKey, [battleCase.id], 2),
      games.createBattleRoom(userId, requestKey, [battleCase.id], 2),
    ]);

    expect(first.id).toBe(retry.id);
    expect(await prisma.battleRoom.count({ where: { requestKey } })).toBe(1);
    expect(await prisma.battleParticipant.count({ where: { roomId: first.id, userId } })).toBe(1);
    expect(await wallet.getBalance(userId)).toBe(47_000n);

    const battleDebits = (await wallet.getLedger(userId)).filter((entry) => entry.reason === "GAME_BATTLE");
    expect(battleDebits).toHaveLength(1);
    expect(battleDebits[0].amountMinor).toBe(-3_000n);
  });

  it("deduplicates concurrent joins and awards every paid drop exactly once", async () => {
    const [creatorId, secondId, thirdId] = await Promise.all([createUser(), createUser(), createUser()]);
    const battleCase = await createEligibleCase();
    const created = await games.createBattleRoom(creatorId, randomUUID(), [battleCase.id], 3);

    const [joined, retry] = await Promise.all([
      games.joinBattleRoom(secondId, created.id),
      games.joinBattleRoom(secondId, created.id),
    ]);
    expect(joined.id).toBe(created.id);
    expect(retry.id).toBe(created.id);
    expect(await prisma.battleParticipant.count({ where: { roomId: created.id, userId: secondId } })).toBe(1);
    expect((await wallet.getLedger(secondId)).filter((entry) => entry.reason === "GAME_BATTLE")).toHaveLength(1);

    const completed = await games.joinBattleRoom(thirdId, created.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.participants).toHaveLength(3);
    expect(completed.participants.every((participant) => participant.roundResults.length === 1)).toBe(true);
    expect(completed.participants.flatMap((participant) => participant.awardedItems)).toHaveLength(3);
    expect(completed.participants.every((participant) => participant.isWinner)).toBe(true);

    const participantIds = [creatorId, secondId, thirdId];
    expect(await prisma.inventoryItem.count({ where: { userId: { in: participantIds } } })).toBe(3);
    expect(await prisma.gameOperation.count({ where: { userId: { in: participantIds }, type: "BATTLE" } })).toBe(3);
    expect(await prisma.provablyFairSeed.count({ where: { userId: { in: participantIds }, nonce: 1 } })).toBe(3);

    for (const userId of participantIds) {
      expect(await wallet.getBalance(userId)).toBe(47_000n);
      expect((await wallet.getLedger(userId)).filter((entry) => entry.reason === "GAME_BATTLE")).toHaveLength(1);
    }
  });

  it("refunds an untouched room once even when cancellation is retried", async () => {
    const creatorId = await createUser();
    const battleCase = await createEligibleCase();
    const room = await games.createBattleRoom(creatorId, randomUUID(), [battleCase.id], 2);

    const cancelled = await games.cancelBattleRoom(creatorId, room.id);
    const retry = await games.cancelBattleRoom(creatorId, room.id);

    expect(cancelled.status).toBe("CANCELLED");
    expect(retry.status).toBe("CANCELLED");
    expect(await wallet.getBalance(creatorId)).toBe(50_000n);
    const entries = (await wallet.getLedger(creatorId)).filter((entry) => entry.reason === "GAME_BATTLE");
    expect(entries.map((entry) => entry.amountMinor).sort((a, b) => Number(a - b))).toEqual([-3_000n, 3_000n]);
  });
});
