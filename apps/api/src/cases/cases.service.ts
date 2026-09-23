import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  computeRoll,
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
  pickWeightedItem,
  verifyRoll,
} from "@cs2-cases/shared";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { CreateCaseDto } from "./dto/admin-case.dto";
import { maskEmail } from "../common/util/mask";

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  listActive() {
    return this.prisma.case.findMany({
      where: { isActive: true },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getBySlug(slug: string) {
    const found = await this.prisma.case.findUnique({ where: { slug }, include: { items: true } });
    if (!found) throw new NotFoundException("Case not found");
    return found;
  }

  /** Fetches the user's active provably-fair seed pair, creating one on first use. */
  async getOrCreateActiveSeed(userId: string, initialClientSeed?: string) {
    const existing = await this.prisma.provablyFairSeed.findFirst({
      where: { userId, isActive: true },
    });
    if (existing) return existing;

    const serverSeed = generateServerSeed();
    return this.prisma.provablyFairSeed.create({
      data: {
        userId,
        serverSeed,
        serverSeedHash: hashServerSeed(serverSeed),
        clientSeed: initialClientSeed ?? generateClientSeed(),
        nonce: 0,
        isActive: true,
      },
    });
  }

  /** Reveals the current seed (so past rolls become verifiable) and starts a fresh one. */
  async rotateSeed(userId: string, nextClientSeed?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.provablyFairSeed.findFirst({ where: { userId, isActive: true } });
      let revealed = null;
      if (current) {
        revealed = await tx.provablyFairSeed.update({
          where: { id: current.id },
          data: { isActive: false, isRevealed: true, revealedAt: new Date() },
        });
      }

      const serverSeed = generateServerSeed();
      const created = await tx.provablyFairSeed.create({
        data: {
          userId,
          serverSeed,
          serverSeedHash: hashServerSeed(serverSeed),
          clientSeed: nextClientSeed ?? generateClientSeed(),
          nonce: 0,
          isActive: true,
        },
      });

      return { revealed, next: created };
    });
  }

  async openCase(userId: string, caseId: string, clientSeedIfFirstUse?: string) {
    const theCase = await this.prisma.case.findUnique({ where: { id: caseId }, include: { items: true } });
    if (!theCase) throw new NotFoundException("Case not found");
    if (!theCase.isActive) throw new BadRequestException("This case is not available");
    if (theCase.items.length === 0) throw new BadRequestException("This case has no items configured");

    const seed = await this.getOrCreateActiveSeed(userId, clientSeedIfFirstUse);

    return this.prisma.$transaction(async (tx) => {
      // Debiting first takes the row lock on the user's wallet, which also
      // serializes the nonce increment below against concurrent opens by
      // the same user (see WalletService for the FOR UPDATE lock).
      await this.wallet.debitInTx(tx, userId, theCase.priceMinor, {
        reason: "CASE_OPEN",
        referenceType: "Case",
        referenceId: theCase.id,
      });

      const lockedSeed = await tx.provablyFairSeed.findUniqueOrThrow({ where: { id: seed.id } });
      const nonce = lockedSeed.nonce;

      const roll = computeRoll(lockedSeed.serverSeed, lockedSeed.clientSeed, nonce);
      const weightedItems = theCase.items.map((item) => ({ id: item.id, weight: item.weight }));
      const won = pickWeightedItem(weightedItems, roll);
      const wonItem = theCase.items.find((item) => item.id === won.id)!;

      await tx.provablyFairSeed.update({ where: { id: seed.id }, data: { nonce: nonce + 1 } });

      const inventoryItem = await tx.inventoryItem.create({
        data: { userId, caseItemId: wonItem.id, status: "IN_INVENTORY" },
      });

      const openEvent = await tx.caseOpenEvent.create({
        data: {
          userId,
          caseId: theCase.id,
          resultCaseItemId: wonItem.id,
          provablyFairSeedId: seed.id,
          nonce,
          roll,
          inventoryItemId: inventoryItem.id,
        },
      });

      return {
        inventoryItemId: inventoryItem.id,
        openEventId: openEvent.id,
        item: wonItem,
        roll,
        nonce,
        serverSeedHash: lockedSeed.serverSeedHash,
        clientSeed: lockedSeed.clientSeed,
      };
    });
  }

  async listMyInventory(userId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { userId, status: "IN_INVENTORY" },
      include: { caseItem: true },
      orderBy: { acquiredAt: "desc" },
    });
  }

  async sellItem(userId: string, inventoryItemId: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { caseItem: true },
    });
    if (!item || item.userId !== userId) throw new NotFoundException("Inventory item not found");
    if (item.status !== "IN_INVENTORY") throw new BadRequestException("Item is not available to sell");

    return this.prisma.$transaction(async (tx) => {
      await this.wallet.creditInTx(tx, userId, item.caseItem.valueMinor, {
        reason: "ITEM_SELL",
        referenceType: "InventoryItem",
        referenceId: item.id,
      });
      return tx.inventoryItem.update({
        where: { id: item.id },
        data: { status: "SOLD", resolvedAt: new Date() },
      });
    });
  }

  async verifyOpenEvent(openEventId: string) {
    const event = await this.prisma.caseOpenEvent.findUnique({
      where: { id: openEventId },
      include: {
        provablyFairSeed: true,
        case: { include: { items: true } },
        resultCaseItem: true,
      },
    });
    if (!event) throw new NotFoundException("Open event not found");

    if (!event.provablyFairSeed.isRevealed) {
      return {
        verifiable: false,
        reason: "Server seed not yet revealed — rotate your seed to reveal it.",
        serverSeedHash: event.provablyFairSeed.serverSeedHash,
      };
    }

    const weightedItems = event.case.items.map((item) => ({ id: item.id, weight: item.weight }));
    const result = verifyRoll({
      serverSeed: event.provablyFairSeed.serverSeed,
      serverSeedHash: event.provablyFairSeed.serverSeedHash,
      clientSeed: event.provablyFairSeed.clientSeed,
      nonce: event.nonce,
      items: weightedItems,
      expectedItemId: event.resultCaseItemId,
    });

    return { verifiable: true, ...result };
  }

  /** Public live-drops feed — real openings, not mocked. Username is masked. */
  async listRecentDrops(take = 16) {
    const events = await this.prisma.caseOpenEvent.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: {
        resultCaseItem: true,
        case: { select: { name: true } },
        user: { select: { email: true, displayName: true } },
      },
    });

    return events.map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      userLabel: event.user.displayName ?? maskEmail(event.user.email),
      caseName: event.case.name,
      item: {
        name: event.resultCaseItem.name,
        imageUrl: event.resultCaseItem.imageUrl,
        valueMinor: event.resultCaseItem.valueMinor,
        currency: event.resultCaseItem.currency,
        rarity: event.resultCaseItem.rarity,
      },
    }));
  }

  /** Public headline numbers for the homepage stats bar. */
  async getPublicStats() {
    const [{ opens, totalValueMinor }] = await this.prisma.$queryRaw<
      { opens: bigint; totalValueMinor: bigint }[]
    >`
      SELECT COUNT(*)::bigint AS opens, COALESCE(SUM(ci."valueMinor"), 0)::bigint AS "totalValueMinor"
      FROM "CaseOpenEvent" eo
      JOIN "CaseItem" ci ON ci.id = eo."resultCaseItemId"
    `;
    const playerCount = await this.prisma.user.count();

    return {
      totalOpens: opens,
      totalValueMinor,
      playerCount,
    };
  }

  // --- Admin management ---

  async createCase(dto: CreateCaseDto) {
    return this.prisma.case.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        priceMinor: dto.priceMinor,
        currency: dto.currency,
        imageUrl: dto.imageUrl,
        items: {
          create: dto.items.map((item) => ({
            name: item.name,
            imageUrl: item.imageUrl,
            weight: item.weight,
            valueMinor: item.valueMinor,
            currency: item.currency,
            rarity: item.rarity,
          })),
        },
      },
      include: { items: true },
    });
  }

  async setCaseActive(caseId: string, isActive: boolean) {
    return this.prisma.case.update({ where: { id: caseId }, data: { isActive } });
  }

  listAllForAdmin() {
    return this.prisma.case.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
  }
}
