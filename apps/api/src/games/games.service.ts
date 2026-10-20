import { battleWinChance } from "./battle-odds";
import { selectContractOutcomes } from "./contract-odds";
import { assessCaseEconomics } from "../common/util/case-economics";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { computeRoll, pickWeightedItem } from "@cs2-cases/shared";
import type { Prisma } from "@prisma/client";
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

  private async lockSeed(tx: Prisma.TransactionClient, seedId: string) {
    const rows = await tx.$queryRaw<{ id: string; serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number }[]>`
      SELECT "id", "serverSeed", "serverSeedHash", "clientSeed", "nonce" FROM "ProvablyFairSeed" WHERE "id" = ${seedId} FOR UPDATE
    `;
    if (!rows[0]) throw new BadRequestException("Fairness seed is unavailable");
    return rows[0];
  }
}
