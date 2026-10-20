import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  computeRoll,
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
  pickWeightedItem,
  verifyRoll,
} from "@cs2-cases/shared";
import { Subject } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { assessCaseEconomics } from "../common/util/case-economics";
import { CreateCaseDto } from "./dto/admin-case.dto";
import { maskEmail } from "../common/util/mask";

export interface DropEvent {
  id: string;
  userLabel: string;
  caseName: string;
  item: { name: string; imageUrl: string; valueMinor: string; currency: string; rarity: string };
}

@Injectable()
export class CasesService {
  readonly dropsFeed$ = new Subject<DropEvent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  broadcastDrop(event: DropEvent) {
    this.dropsFeed$.next(event);
  }

  async listActive() {
    const cases = await this.prisma.case.findMany({
      where: { isActive: true },
      include: { items: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });
    // The catalog only needs one representative image per skin design. The
    // detail endpoint still returns every priced exterior and its exact odds.
    return cases.map((itemCase) => {
      const representative = new Map<string, typeof itemCase.items[number]>();
      for (const item of itemCase.items) {
        const baseName = item.name.replace(/ \((?:Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, "");
        const previous = representative.get(baseName);
        if (!previous || item.valueMinor > previous.valueMinor) representative.set(baseName, item);
      }
      const eligibility = assessCaseEconomics(itemCase.items, itemCase.priceMinor);
      return { ...itemCase, itemCount: itemCase.items.length, ...eligibility, items: [...representative.values()] };
    });
  }

  async getBySlug(slug: string) {
    const found = await this.prisma.case.findUnique({ where: { slug }, include: { items: true } });
    if (!found) throw new NotFoundException("Case not found");
    return { ...found, ...assessCaseEconomics(found.items, found.priceMinor) };
  }

  /** Fetches the user's active provably-fair seed pair, creating one on first use. */
  async getOrCreateActiveSeed(userId: string, initialClientSeed?: string) {
    const existing = await this.prisma.provablyFairSeed.findFirst({
      where: { userId, isActive: true },
    });
    if (existing) return existing;
    // Only on first use: serialize seed allocation per account so two
    // concurrent opens never create two active seeds with duplicate nonces.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const allocated = await tx.provablyFairSeed.findFirst({
        where: { userId, isActive: true },
      });
      if (allocated) return allocated;
      const serverSeed = generateServerSeed();
      return tx.provablyFairSeed.create({
        data: {
          userId,
          serverSeed,
          serverSeedHash: hashServerSeed(serverSeed),
          clientSeed: initialClientSeed ?? generateClientSeed(),
          nonce: 0,
          isActive: true,
        },
      });
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
    if (theCase.currency !== "RUB" || theCase.items.some((item) => item.currency !== "RUB")) {
      throw new BadRequestException("This case is not configured in RUB");
    }
    if (theCase.items.length === 0) throw new BadRequestException("This case has no items configured");
    if (!assessCaseEconomics(theCase.items, theCase.priceMinor).canOpen) {
      throw new BadRequestException("Case temporarily unavailable pending price review");
    }

    const seed = await this.getOrCreateActiveSeed(userId, clientSeedIfFirstUse);

    const result = await this.prisma.$transaction(async (tx) => {
      // Debiting first takes the row lock on the user's wallet, which also
      // serializes the nonce increment below against concurrent opens by
      // the same user (see WalletService for the FOR UPDATE lock).
      await this.wallet.debitInTx(tx, userId, theCase.priceMinor, {
        reason: "CASE_OPEN",
        referenceType: "Case",
        referenceId: theCase.id,
      });

      // Must hold the same seed row lock as batched opens: otherwise two
      // concurrent requests can reuse one nonce before either update commits.
      const rows = await tx.$queryRaw<{ nonce: number; serverSeed: string; serverSeedHash: string; clientSeed: string }[]>`
        SELECT "nonce", "serverSeed", "serverSeedHash", "clientSeed"
        FROM "ProvablyFairSeed" WHERE "id" = ${seed.id} FOR UPDATE
      `;
      const lockedSeed = rows[0];
      if (!lockedSeed) throw new BadRequestException("Case seed unavailable");
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

    // Broadcast after commit so SSE subscribers see confirmed drops only.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } });
    if (user) {
      this.broadcastDrop({
        id: result.openEventId,
        userLabel: user.displayName ?? maskEmail(user.email),
        caseName: theCase.name,
        item: {
          name: result.item.name,
          imageUrl: result.item.imageUrl,
          valueMinor: result.item.valueMinor.toString(),
          currency: result.item.currency,
          rarity: result.item.rarity,
        },
      });
    }

    return result;
  }

  /** Atomic multiple opening: one wallet debit, consecutive nonces and five
   * or fewer real inventory items. No retries after an uncertain response. */
  async openCaseBatch(userId: string, caseId: string, count: number, clientSeedIfFirstUse?: string) {
    if (!Number.isInteger(count) || count < 1 || count > 5) throw new BadRequestException("Choose 1 to 5 cases");
    const theCase = await this.prisma.case.findUnique({ where: { id: caseId }, include: { items: true } });
    if (!theCase || !theCase.isActive || !theCase.items.length) throw new BadRequestException("Case unavailable");
    if (theCase.currency !== "RUB" || theCase.items.some(item => item.currency !== "RUB"))
      throw new BadRequestException("Case currency is unsupported");
    if (!assessCaseEconomics(theCase.items, theCase.priceMinor).canOpen)
      throw new BadRequestException("Case temporarily unavailable pending price review");
    const seed = await this.getOrCreateActiveSeed(userId, clientSeedIfFirstUse);
    type Opened = {
      inventoryItemId: string; openEventId: string;
      item: (typeof theCase.items)[number];
      roll: number; nonce: number; serverSeedHash: string; clientSeed: string;
    };
    const results = await this.prisma.$transaction(async tx => {
      // Row lock serializes all open operations on the same wallet.
      await this.wallet.debitInTx(tx, userId, theCase.priceMinor * BigInt(count), {
        reason: "CASE_OPEN", referenceType: "Case", referenceId: theCase.id,
      });
      const rows = await tx.$queryRaw<{ nonce: number; serverSeed: string; serverSeedHash: string; clientSeed: string }[]>`
        SELECT "nonce", "serverSeed", "serverSeedHash", "clientSeed"
        FROM "ProvablyFairSeed" WHERE "id" = ${seed.id} FOR UPDATE
      `;
      if (!rows[0]) throw new BadRequestException("Case seed unavailable");
      const locked = rows[0];
      const weights = theCase.items.map(item => ({ id: item.id, weight: item.weight }));
      const output: Opened[] = [];
      for (let index = 0; index < count; index++) {
        const nonce = locked.nonce + index;
        const roll = computeRoll(locked.serverSeed, locked.clientSeed, nonce);
        const chosen = pickWeightedItem(weights, roll);
        const item = theCase.items.find(candidate => candidate.id === chosen.id)!;
        const inventory = await tx.inventoryItem.create({
          data: { userId, caseItemId: item.id, status: "IN_INVENTORY" },
        });
        const event = await tx.caseOpenEvent.create({
          data: {
            userId, caseId: theCase.id, resultCaseItemId: item.id,
            provablyFairSeedId: seed.id, nonce, roll, inventoryItemId: inventory.id,
          },
        });
        output.push({
          inventoryItemId: inventory.id, openEventId: event.id, item, roll, nonce,
          serverSeedHash: locked.serverSeedHash, clientSeed: locked.clientSeed,
        });
      }
      await tx.provablyFairSeed.update({ where: { id: seed.id }, data: { nonce: locked.nonce + count } });
      return output;
    }, { timeout: 15_000 });

    // Broadcast only committed events, never unconfirmed rolls.
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { email: true, displayName: true },
    });
    if (user) for (const result of results) {
      this.broadcastDrop({
        id: result.openEventId,
        userLabel: user.displayName ?? maskEmail(user.email),
        caseName: theCase.name,
        item: {
          name: result.item.name, imageUrl: result.item.imageUrl,
          valueMinor: result.item.valueMinor.toString(),
          currency: result.item.currency, rarity: result.item.rarity,
        },
      });
    }
    return { results, count, totalPriceMinor: (theCase.priceMinor * BigInt(count)).toString() };
  }

  async listMyOpenEvents(userId: string) {
    return this.prisma.caseOpenEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        nonce: true,
        roll: true,
        case: { select: { name: true, slug: true } },
        resultCaseItem: {
          select: { name: true, imageUrl: true, valueMinor: true, currency: true, rarity: true },
        },
        provablyFairSeed: { select: { serverSeedHash: true } },
      },
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
    if (item.caseItem.currency !== "RUB") throw new BadRequestException("This item is not priced in RUB");

    return this.prisma.$transaction(async (tx) => {
      // Claim the item with one conditional write before crediting the wallet.
      // Two concurrent requests can both pass the read above, but only one
      // can transition IN_INVENTORY → SOLD; the other transaction receives
      // count=0 and exits without creating a second credit.
      const claimed = await tx.inventoryItem.updateMany({
        where: { id: item.id, userId, status: "IN_INVENTORY" },
        data: { status: "SOLD", resolvedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException("Item is not available to sell");

      await this.wallet.creditInTx(tx, userId, item.caseItem.valueMinor, {
        reason: "ITEM_SELL",
        referenceType: "InventoryItem",
        referenceId: item.id,
      });
      return tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
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

  /**
   * Public headline numbers for the homepage stats bar. Excludes the
   * bot-owned accounts the seed script uses to keep the drops feed looking
   * alive on a fresh install — those are decoration, not real business
   * volume, and must never inflate this.
   */
  async getPublicStats() {
    const [{ opens, totalValueMinor }] = await this.prisma.$queryRaw<
      { opens: bigint; totalValueMinor: bigint }[]
    >`
      SELECT COUNT(*)::bigint AS opens, COALESCE(SUM(ci."valueMinor"), 0)::bigint AS "totalValueMinor"
      FROM "CaseOpenEvent" eo
      JOIN "CaseItem" ci ON ci.id = eo."resultCaseItemId"
      JOIN "User" u ON u.id = eo."userId"
      WHERE u.email NOT LIKE '%@bots.internal'
    `;
    const playerCount = await this.prisma.user.count({ where: { email: { not: { endsWith: "@bots.internal" } } } });

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
    return this.prisma.case.findMany({
      include: { items: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });
  }
}
