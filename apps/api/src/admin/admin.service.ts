import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { KycService } from "../kyc/kyc.service";
import { PaymentsService } from "../payments/payments.service";
import { CasesService } from "../cases/cases.service";
import { PricesService } from "../prices/prices.service";
import { WalletService } from "../wallet/wallet.service";
import { randomUUID } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { ReviewKycDto } from "./dto/review-kyc.dto";
import { ReviewWithdrawalDto } from "../payments/dto/review-withdrawal.dto";
import { CreateCaseDto } from "../cases/dto/admin-case.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kyc: KycService,
    private readonly payments: PaymentsService,
    private readonly cases: CasesService,
    private readonly prices: PricesService,
    private readonly wallet: WalletService,
  ) {}

  private audit(adminUserId: string, action: string, targetType: string, targetId: string, metadata?: object) {
    return this.prisma.adminAuditLog.create({
      data: { adminUserId, action, targetType, targetId, metadata: metadata as never },
    });
  }

  listUsers(take = 50) {
    return this.prisma.user.findMany({
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true,
        wallet: { select: { balanceMinor: true, currency: true } },
      },
    });
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, kycRecords: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
  }

  listPendingKyc() {
    return this.kyc.listPending();
  }

  async reviewKyc(recordId: string, adminUserId: string, dto: ReviewKycDto) {
    const result = await this.kyc.review(recordId, adminUserId, dto.approve, dto.rejectionReason);
    await this.audit(adminUserId, dto.approve ? "KYC_APPROVE" : "KYC_REJECT", "KycRecord", recordId, {
      rejectionReason: dto.rejectionReason,
    });
    return result;
  }

  listPendingWithdrawals() {
    return this.payments.listPendingWithdrawals();
  }

  async reviewWithdrawal(withdrawalId: string, adminUserId: string, dto: ReviewWithdrawalDto) {
    const result = await this.payments.reviewWithdrawal(withdrawalId, adminUserId, dto);
    await this.audit(
      adminUserId,
      dto.approve ? "WITHDRAWAL_APPROVE" : "WITHDRAWAL_REJECT",
      "Withdrawal",
      withdrawalId,
      { rejectionReason: dto.rejectionReason },
    );
    return result;
  }

  listLedger(userId?: string, take = 100) {
    return this.prisma.ledgerEntry.findMany({
      where: userId ? { wallet: { userId } } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: { wallet: { select: { userId: true } } },
    });
  }

  listCases() {
    return this.cases.listAllForAdmin();
  }

  async createCase(adminUserId: string, dto: CreateCaseDto) {
    const created = await this.cases.createCase(dto);
    await this.audit(adminUserId, "CASE_CREATE", "Case", created.id, { slug: dto.slug });
    return created;
  }

  async setCaseActive(adminUserId: string, caseId: string, isActive: boolean) {
    const updated = await this.cases.setCaseActive(caseId, isActive);
    await this.audit(adminUserId, isActive ? "CASE_ENABLE" : "CASE_DISABLE", "Case", caseId);
    return updated;
  }

  getPriceSyncStatus() {
    return this.prices.getStatus();
  }

  async triggerPriceSync(adminUserId: string) {
    const status = await this.prices.syncNow(true);
    void this.audit(adminUserId, "PRICE_SYNC_TRIGGER", "MarketItem", "all");
    return status;
  }

  async rebalanceCases(adminUserId: string, populate = false) {
    if (populate) await this.prices.populateCases();
    const rows = await this.prices.rebalanceCases(0.8);
    void this.audit(adminUserId, populate ? "CASES_POPULATE" : "CASES_REBALANCE", "Case", "all");
    return rows;
  }

  /** Credits (or, with a negative amount, debits) a user's wallet; always ledgered and audited. */
  async adjustBalance(adminUserId: string, userId: string, amount: number, note?: string) {
    const amountMinor = BigInt(Math.round(amount * 100));
    if (amountMinor === 0n) throw new BadRequestException("Amount must not be zero");
    const ref = { reason: "ADMIN_ADJUSTMENT" as const, referenceType: "AdminAdjustment", referenceId: randomUUID() };
    const entry =
      amountMinor > 0n
        ? await this.wallet.credit(userId, amountMinor, ref)
        : await this.wallet.debit(userId, -amountMinor, ref);
    await this.audit(adminUserId, "BALANCE_ADJUST", "User", userId, { amountMinor: amountMinor.toString(), note });
    return { balanceMinor: entry.balanceAfterMinor.toString(), currency: "RUB" };
  }

  listAuditLog(take = 100) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { admin: { select: { email: true } } },
    });
  }
}
