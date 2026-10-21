import { battleWinChance } from "./battle-odds";
import { allocateBattlePrizePool } from "./battle-settlement";
import { selectContractOutcomes } from "./contract-odds";
import { assessCaseEconomics } from "../common/util/case-economics";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { computeRoll, pickWeightedItem } from "@cs2-cases/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CasesService } from "../cases/cases.service";
import { WalletService } from "../wallet/wallet.service";

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: CasesService,
    private readonly wallet: WalletService,
  ) {}

  listUpgradeTargets() {
    return this.prisma.caseItem.findMany({
      where: { currency: "RUB", case: { isActive: true } },
      orderBy: { valueMinor: "asc" },
      take: 1000,
    });
  }

  listMyOperations(userId: string) {
    return this.prisma.gameOperation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });
  }

  async createContract(userId: string, inventoryItemIds: string[]) {
    const uniqueIds = [...new Set(inventoryItemIds)];
    if (uniqueIds.length !== inventoryItemIds.length) throw new BadRequestException("Each inventory item may only be selected once");
    const seed = await this.cases.getOrCreateActiveSeed(userId);

    return this.prisma.$transaction(async (tx) => {
      const inputs = await tx.inventoryItem.findMany({
        where: { id: { in: uniqueIds }, userId, status: "IN_INVENTORY" },
        include: { caseItem: true },
      });
      if (inputs.length !== uniqueIds.length) throw new BadRequestException("One or more selected items are no longer available");
      if (inputs.some((item) => item.caseItem.currency !== "RUB")) throw new BadRequestException("Only RUB-priced items can be used");

      const total = inputs.reduce((sum, item) => sum + item.caseItem.valueMinor, 0n);
      const candidates = await tx.caseItem.findMany({
        where: { currency: "RUB", valueMinor: { gte: total * 20n / 100n, lte: total * 4n }, case: { isActive: true } },
        orderBy: [{ valueMinor: "asc" }, { id: "asc" }],
        take: 5000,
      });
      const quote = selectContractOutcomes(candidates, total);
      if (!quote) throw new BadRequestException("Contract unavailable: no fair reward pair for this total; change selected items");

      const lockedSeed = await this.lockSeed(tx, seed.id);
      const roll = computeRoll(lockedSeed.serverSeed, lockedSeed.clientSeed, lockedSeed.nonce);
      const output = roll < quote.highChance ? quote.high : quote.low;
      const claimed = await tx.inventoryItem.updateMany({
        where: { id: { in: uniqueIds }, userId, status: "IN_INVENTORY" },
        data: { status: "CONSUMED", resolvedAt: new Date() },
      });
      if (claimed.count !== uniqueIds.length) throw new BadRequestException("Selected items changed before the contract completed");
      const created = await tx.inventoryItem.create({ data: { userId, caseItemId: output.id } });
      await tx.provablyFairSeed.update({ where: { id: seed.id }, data: { nonce: lockedSeed.nonce + 1 } });
      const operation = await tx.gameOperation.create({ data: {
        userId, type: "CONTRACT", status: "WON", inputInventoryItemIds: uniqueIds,
        outputCaseItemId: output.id, outputInventoryItemId: created.id, roll, chance: 1,
        serverSeedHash: lockedSeed.serverSeedHash, clientSeed: lockedSeed.clientSeed, nonce: lockedSeed.nonce,
        metadata: { lowCaseItemId: quote.low.id, highCaseItemId: quote.high.id, highChance: quote.highChance, inputValueMinor: total.toString(), expectedReturnMinor: quote.expectedReturnMinor.toString() },
      } });
      return { operation, item: output, inventoryItemId: created.id, inputValueMinor: total, quote: { low: quote.low, high: quote.high, highChance: quote.highChance } };
    });
  }

  async quoteContract(userId: string, inventoryItemIds: string[]) {
    const unique = [...new Set(inventoryItemIds)];
    if (unique.length !== inventoryItemIds.length || unique.length < 3 || unique.length > 10) {
      throw new BadRequestException("Select 3 to 10 distinct items");
    }
    const inputs = await this.prisma.inventoryItem.findMany({
      where: { id: { in: unique }, userId, status: "IN_INVENTORY" },
      include: { caseItem: true },
    });
    if (inputs.length !== unique.length || inputs.some(item => item.caseItem.currency !== "RUB")) {
      throw new BadRequestException("Selected items are unavailable");
    }
    const total = inputs.reduce((sum, item) => sum + item.caseItem.valueMinor, 0n);
    const candidates = await this.prisma.caseItem.findMany({
      where: { currency: "RUB", valueMinor: { gte: total * 20n / 100n, lte: total * 4n }, case: { isActive: true } },
      orderBy: [{ valueMinor: "asc" }, { id: "asc" }], take: 5000,
    });
    const quote = selectContractOutcomes(candidates, total);
    if (!quote) return { available: false, inputValueMinor: total.toString() };
    return {
      available: true,
      inputValueMinor: total.toString(),
      expectedReturnMinor: quote.expectedReturnMinor.toString(),
      low: { id: quote.low.id, name: quote.low.name, valueMinor: quote.low.valueMinor.toString(), imageUrl: quote.low.imageUrl },
      high: { id: quote.high.id, name: quote.high.name, valueMinor: quote.high.valueMinor.toString(), imageUrl: quote.high.imageUrl },
      highChance: quote.highChance,
    };
  }

  async createUpgrade(userId: string, inventoryItemId: string, targetCaseItemId: string) {
    const seed = await this.cases.getOrCreateActiveSeed(userId);
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, userId, status: "IN_INVENTORY" }, include: { caseItem: true } });
      if (!source) throw new NotFoundException("Inventory item not found");
      const target = await tx.caseItem.findFirst({ where: { id: targetCaseItemId, currency: "RUB", case: { isActive: true } } });
      if (!target) throw new NotFoundException("Upgrade target not found");
      if (source.caseItem.currency !== "RUB") throw new BadRequestException("Only RUB-priced items can be upgraded");
      if (target.valueMinor <= source.caseItem.valueMinor) throw new BadRequestException("The target must be more valuable than the source item");
      // A fixed 1% minimum would exceed the advertised 90% gross return beyond 90x.
      if (target.valueMinor > source.caseItem.valueMinor * 90n) throw new BadRequestException("Upgrade target exceeds maximum 90x source value");
      const rawChance = Number(source.caseItem.valueMinor * 90_000n / target.valueMinor) / 100_000;
      const chance = Math.max(0.01, Math.min(0.75, rawChance));

      const lockedSeed = await this.lockSeed(tx, seed.id);
      const roll = computeRoll(lockedSeed.serverSeed, lockedSeed.clientSeed, lockedSeed.nonce);
      const won = roll < chance;
      const claimed = await tx.inventoryItem.updateMany({ where: { id: source.id, userId, status: "IN_INVENTORY" }, data: { status: "CONSUMED", resolvedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException("The source item changed before the upgrade completed");
      const created = won ? await tx.inventoryItem.create({ data: { userId, caseItemId: target.id } }) : null;
      await tx.provablyFairSeed.update({ where: { id: seed.id }, data: { nonce: lockedSeed.nonce + 1 } });
      const operation = await tx.gameOperation.create({ data: {
        userId, type: "UPGRADE", status: won ? "WON" : "LOST", inputInventoryItemIds: [source.id],
        targetCaseItemId: target.id, outputCaseItemId: won ? target.id : null, outputInventoryItemId: created?.id,
        roll, chance, serverSeedHash: lockedSeed.serverSeedHash, clientSeed: lockedSeed.clientSeed, nonce: lockedSeed.nonce,
      } });
      return { operation, won, item: won ? target : null, target, chance };
    });
  }

  async createBattle(userId: string, caseId: string) {
    const battleCase = await this.prisma.case.findFirst({
      where: { id: caseId, isActive: true, currency: "RUB" },
      include: { items: true },
    });
    if (!battleCase || battleCase.items.length === 0) throw new NotFoundException("Battle case not found");
    if (battleCase.items.some((item) => item.currency !== "RUB")) throw new BadRequestException("This case is not configured in RUB");
    if (!assessCaseEconomics(battleCase.items, battleCase.priceMinor).canBattle) {
      throw new BadRequestException("Battle temporarily unavailable pending price review");
    }
    const seed = await this.cases.getOrCreateActiveSeed(userId);

    return this.prisma.$transaction(async (tx) => {
      await this.wallet.debitInTx(tx, userId, battleCase.priceMinor, {
        reason: "GAME_BATTLE",
        referenceType: "CaseBattle",
        referenceId: battleCase.id,
      });
      const lockedSeed = await this.lockSeed(tx, seed.id);
      const playerRoll = computeRoll(lockedSeed.serverSeed, lockedSeed.clientSeed, lockedSeed.nonce);
      const botRoll = computeRoll(lockedSeed.serverSeed, `${lockedSeed.clientSeed}:bot`, lockedSeed.nonce + 1);
      const weightedItems = battleCase.items.map((item) => ({ id: item.id, weight: item.weight }));
      const playerPick = pickWeightedItem(weightedItems, playerRoll);
      const botPick = pickWeightedItem(weightedItems, botRoll);
      const playerItem = battleCase.items.find((item) => item.id === playerPick.id)!;
      const botItem = battleCase.items.find((item) => item.id === botPick.id)!;
      const won = playerItem.valueMinor >= botItem.valueMinor;
      const chance = battleWinChance(battleCase.items);
      const winnings = won
        ? await Promise.all([
            tx.inventoryItem.create({ data: { userId, caseItemId: playerItem.id } }),
            tx.inventoryItem.create({ data: { userId, caseItemId: botItem.id } }),
          ])
        : [];

      await tx.provablyFairSeed.update({ where: { id: seed.id }, data: { nonce: lockedSeed.nonce + 2 } });
      const operation = await tx.gameOperation.create({ data: {
        userId,
        type: "BATTLE",
        status: won ? "WON" : "LOST",
        inputInventoryItemIds: [],
        outputCaseItemId: won ? playerItem.id : null,
        outputInventoryItemId: winnings[0]?.id,
        roll: playerRoll,
        chance,
        serverSeedHash: lockedSeed.serverSeedHash,
        clientSeed: lockedSeed.clientSeed,
        nonce: lockedSeed.nonce,
        metadata: {
          caseId: battleCase.id,
          playerItemId: playerItem.id,
          botItemId: botItem.id,
          playerRoll,
          botRoll,
          outputInventoryItemIds: winnings.map((item) => item.id),
        },
      } });
      return { operation, won, battleCase: { id: battleCase.id, name: battleCase.name }, playerItem, botItem, winnings: winnings.map((item) => item.id) };
    });
  }

  async listBattleRooms(status?: "WAITING" | "COMPLETED") {
    const rooms = await this.prisma.battleRoom.findMany({
      where: status ? { status } : { status: "WAITING" },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        participants: { include: { user: { select: { id: true, displayName: true, steamAvatarUrl: true } } } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    return rooms.map((room) => this.presentRoom(room));
  }

  async getBattleRoom(roomId: string) {
    return this.loadBattleRoom(this.prisma, roomId);
  }

  private async loadBattleRoom(db: PrismaService | Prisma.TransactionClient, roomId: string) {
    const room = await db.battleRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, displayName: true, steamAvatarUrl: true } } } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    if (!room) throw new NotFoundException("Battle room not found");
    const caseIds = room.caseIds as string[];
    const battleCases = await db.case.findMany({ where: { id: { in: [...new Set(caseIds)] } }, select: { id: true, name: true, imageUrl: true, priceMinor: true } });
    return { ...this.presentRoom(room), cases: caseIds.map((id) => battleCases.find((value) => value.id === id)).filter(Boolean) };
  }

  async createBattleRoom(userId: string, requestKey: string, caseIds: string[], maxPlayers: number) {
    if (new Set(caseIds).size !== caseIds.length) throw new BadRequestException("Each selected case must be a separate round");
    const sameRequest = (room: { createdById: string; caseIds: unknown; maxPlayers: number }) =>
      room.createdById === userId && room.maxPlayers === maxPlayers && JSON.stringify(room.caseIds) === JSON.stringify(caseIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const prior = await tx.battleRoom.findUnique({ where: { requestKey } });
        if (prior) {
          if (!sameRequest(prior)) throw new BadRequestException("Battle create retry does not match the original request");
          return this.loadBattleRoom(tx, prior.id);
        }
        const cases = await this.getBattleCases(caseIds, tx);
        const entryFee = cases.reduce((sum, item) => sum + item.priceMinor, 0n);
        const room = await tx.battleRoom.create({ data: { requestKey, createdById: userId, caseIds, maxPlayers } });
        await this.wallet.debitInTx(tx, userId, entryFee, { reason: "GAME_BATTLE", referenceType: "CaseBattleRoom", referenceId: `${room.id}:${userId}` });
        await tx.battleParticipant.create({ data: { roomId: room.id, userId, paidMinor: entryFee } });
        return this.loadBattleRoom(tx, room.id);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const prior = await this.prisma.battleRoom.findUnique({ where: { requestKey } });
        if (prior && sameRequest(prior)) return this.getBattleRoom(prior.id);
      }
      throw error;
    }
  }

  async joinBattleRoom(userId: string, roomId: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; caseIds: unknown; maxPlayers: number; status: "WAITING" | "COMPLETED" }[]>`
        SELECT "id", "caseIds", "maxPlayers", "status" FROM "BattleRoom" WHERE "id" = ${roomId} FOR UPDATE
      `;
      const room = locked[0];
      if (!room) throw new NotFoundException("Battle room not found");
      const existing = await tx.battleParticipant.findUnique({ where: { roomId_userId: { roomId, userId } } });
      if (existing) return this.loadBattleRoom(tx, roomId); // Safe retry after a client timeout.
      if (room.status !== "WAITING") throw new BadRequestException("This battle has already finished");
      const participants = await tx.battleParticipant.findMany({ where: { roomId }, orderBy: { createdAt: "asc" } });
      if (participants.length >= room.maxPlayers) throw new BadRequestException("This battle is full");
      const caseIds = room.caseIds as string[];
      const cases = await this.getBattleCases(caseIds, tx);
      const entryFee = cases.reduce((sum, item) => sum + item.priceMinor, 0n);
      await this.wallet.debitInTx(tx, userId, entryFee, { reason: "GAME_BATTLE", referenceType: "CaseBattleRoom", referenceId: `${roomId}:${userId}` });
      await tx.battleParticipant.create({ data: { roomId, userId, paidMinor: entryFee } });
      const joined = [...participants, { userId }];
      if (joined.length === room.maxPlayers) await this.settleBattleRoom(tx, roomId, caseIds, cases);
      return this.loadBattleRoom(tx, roomId);
    });
  }

  async cancelBattleRoom(userId: string, roomId: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; createdById: string; status: "WAITING" | "COMPLETED" | "CANCELLED" }[]>`
        SELECT "id", "createdById", "status" FROM "BattleRoom" WHERE "id" = ${roomId} FOR UPDATE
      `;
      const room = locked[0];
      if (!room) throw new NotFoundException("Battle room not found");
      if (room.status === "CANCELLED") return this.loadBattleRoom(tx, roomId);
      if (room.createdById !== userId || room.status !== "WAITING") throw new BadRequestException("Only the creator can cancel an open room");
      const participants = await tx.battleParticipant.findMany({ where: { roomId }, orderBy: { createdAt: "asc" } });
      if (participants.length !== 1 || participants[0].userId !== userId) throw new BadRequestException("A room can only be cancelled before another player joins");
      await this.wallet.creditInTx(tx, userId, participants[0].paidMinor, { reason: "GAME_BATTLE", referenceType: "CaseBattleRoomRefund", referenceId: `${roomId}:${userId}` });
      await tx.battleRoom.update({ where: { id: roomId }, data: { status: "CANCELLED", completedAt: new Date() } });
      return this.loadBattleRoom(tx, roomId);
    });
  }

  private async getBattleCases(caseIds: string[], tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const cases = await db.case.findMany({ where: { id: { in: [...new Set(caseIds)] }, isActive: true, currency: "RUB" }, include: { items: true } });
    if (cases.length !== new Set(caseIds).size) throw new BadRequestException("One or more selected cases are no longer available");
    const ordered = caseIds.map((id) => cases.find((value) => value.id === id)!);
    for (const value of ordered) {
      if (!value.items.length || value.items.some((item) => item.currency !== "RUB") || !assessCaseEconomics(value.items, value.priceMinor).canBattle) {
        throw new BadRequestException("One or more selected cases are not eligible for battles");
      }
    }
    return ordered;
  }

  private async settleBattleRoom(tx: Prisma.TransactionClient, roomId: string, caseIds: string[], cases: Awaited<ReturnType<GamesService["getBattleCases"]>>) {
    const participants = await tx.battleParticipant.findMany({ where: { roomId }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, displayName: true } } } });
    if (participants.length < 2) throw new BadRequestException("At least two players are required");
    const seeds = new Map<string, Awaited<ReturnType<GamesService["lockSeed"]>>>();
    for (const participant of [...participants].sort((a, b) => a.userId.localeCompare(b.userId))) {
      const seed = await this.cases.getOrCreateActiveSeed(participant.userId);
      const lockedSeed = await this.lockSeed(tx, seed.id);
      seeds.set(participant.userId, lockedSeed);
    }
    const records = [] as Array<{ participant: typeof participants[number]; seed: Awaited<ReturnType<GamesService["lockSeed"]>>; drops: Array<{ caseId: string; item: (typeof cases)[number]["items"][number]; roll: number; nonce: number }> }>;
    for (const participant of participants) {
      const lockedSeed = seeds.get(participant.userId)!;
      const drops = caseIds.map((caseId, round) => {
        const battleCase = cases.find((value) => value.id === caseId)!;
        const nonce = lockedSeed.nonce + round;
        const roll = computeRoll(lockedSeed.serverSeed, `${lockedSeed.clientSeed}:battle:${roomId}`, nonce);
        const picked = pickWeightedItem(battleCase.items.map((item) => ({ id: item.id, weight: item.weight })), roll);
        return { caseId, item: battleCase.items.find((item) => item.id === picked.id)!, roll, nonce };
      });
      records.push({ participant, seed: lockedSeed, drops });
    }
    const scores = records.map(({ drops }) => drops.reduce((sum, drop) => sum + drop.item.valueMinor, 0n));
    const sharedPool = records.flatMap((record) => record.drops);
    const { winnerIndexes, awards } = allocateBattlePrizePool(scores, sharedPool);
    for (const [index, record] of records.entries()) {
      const prizeDrops = awards[index];
      const inventory = await Promise.all(prizeDrops.map((drop) => tx.inventoryItem.create({ data: { userId: record.participant.userId, caseItemId: drop.item.id } })));
      await tx.battleParticipant.update({ where: { id: record.participant.id }, data: {
        scoreMinor: scores[index], isWinner: winnerIndexes.includes(index),
        roundResults: record.drops.map((drop) => ({ round: drop.nonce - record.seed.nonce + 1, caseId: drop.caseId, itemId: drop.item.id, name: drop.item.name, imageUrl: drop.item.imageUrl, valueMinor: drop.item.valueMinor.toString(), roll: drop.roll, nonce: drop.nonce })),
        awardedItems: prizeDrops.map((drop, itemIndex) => ({ inventoryItemId: inventory[itemIndex].id, caseId: drop.caseId, itemId: drop.item.id, name: drop.item.name, imageUrl: drop.item.imageUrl, valueMinor: drop.item.valueMinor.toString() })),
      } });
      await tx.gameOperation.create({ data: {
        userId: record.participant.userId, type: "BATTLE", status: winnerIndexes.includes(index) ? "WON" : "LOST", inputInventoryItemIds: [],
        outputCaseItemId: prizeDrops[0]?.item.id ?? null, outputInventoryItemId: inventory[0]?.id ?? null,
        roll: record.drops[0]?.roll ?? 0, chance: winnerIndexes.includes(index) ? 1 : 0,
        serverSeedHash: record.seed.serverSeedHash, clientSeed: record.seed.clientSeed, nonce: record.seed.nonce,
        metadata: { roomId, scoreMinor: scores[index].toString(), roundResults: record.drops.map((drop) => ({ itemId: drop.item.id, roll: drop.roll, nonce: drop.nonce })), winnings: inventory.map((item) => item.id) },
      } });
      await tx.provablyFairSeed.update({ where: { id: record.seed.id }, data: { nonce: record.seed.nonce + caseIds.length } });
    }
    await tx.battleRoom.update({ where: { id: roomId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }

  private presentRoom<T extends { id: string; createdById: string; caseIds: unknown; maxPlayers: number; status: string; createdAt: Date; completedAt: Date | null; participants: Array<{ id: string; userId: string; paidMinor: bigint; scoreMinor: bigint; isWinner: boolean; roundResults: unknown; awardedItems: unknown; user: { id: string; displayName: string | null; steamAvatarUrl?: string | null } }>; createdBy: { id: string; displayName: string | null } }>(room: T) {
    return { id: room.id, caseIds: room.caseIds, maxPlayers: room.maxPlayers, status: room.status, createdAt: room.createdAt, completedAt: room.completedAt,
      createdBy: room.createdBy, participants: room.participants.map((player) => ({ id: player.id, userId: player.userId, displayName: player.user.displayName ?? "Игрок", avatarUrl: player.user.steamAvatarUrl ?? null, paidMinor: player.paidMinor, scoreMinor: player.scoreMinor, isWinner: player.isWinner, roundResults: player.roundResults, awardedItems: player.awardedItems })),
    };
  }

  private async lockSeed(tx: Prisma.TransactionClient, seedId: string) {
    const rows = await tx.$queryRaw<{ id: string; serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number }[]>`
      SELECT "id", "serverSeed", "serverSeedHash", "clientSeed", "nonce" FROM "ProvablyFairSeed" WHERE "id" = ${seedId} FOR UPDATE
    `;
    if (!rows[0]) throw new BadRequestException("Fairness seed is unavailable");
    return rows[0];
  }
}
