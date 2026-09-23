import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { KycStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { KYC_PROVIDER, KycProvider } from "./kyc-provider.interface";
import { KycSubmitDto } from "./dto/kyc-submit.dto";

const MINIMUM_AGE_YEARS = 18;

function ageInYears(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = at.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
  ) {}

  async submit(userId: string, dto: KycSubmitDto) {
    const dateOfBirth = new Date(dto.dateOfBirth);
    if (ageInYears(dateOfBirth) < MINIMUM_AGE_YEARS) {
      throw new BadRequestException(`Must be at least ${MINIMUM_AGE_YEARS} years old`);
    }

    const result = await this.provider.submit({ ...dto });

    const [record] = await this.prisma.$transaction([
      this.prisma.kycRecord.create({
        data: {
          userId,
          status: result.autoStatus,
          fullName: dto.fullName,
          dateOfBirth,
          documentType: dto.documentType,
          documentFrontUrl: dto.documentFrontUrl,
          documentBackUrl: dto.documentBackUrl,
          selfieUrl: dto.selfieUrl,
          providerRef: result.providerRef,
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { kycStatus: result.autoStatus } }),
    ]);

    return record;
  }

  async getStatus(userId: string): Promise<KycStatus> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { kycStatus: true } });
    if (!user) throw new NotFoundException("User not found");
    return user.kycStatus;
  }

  async getLatestRecord(userId: string) {
    return this.prisma.kycRecord.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async listPending() {
    return this.prisma.kycRecord.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  async review(recordId: string, adminUserId: string, approve: boolean, rejectionReason?: string) {
    const record = await this.prisma.kycRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException("KYC record not found");

    const status: KycStatus = approve ? "VERIFIED" : "REJECTED";

    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { id: recordId },
        data: { status, reviewedByAdminId: adminUserId, reviewedAt: new Date(), rejectionReason },
      }),
      this.prisma.user.update({ where: { id: record.userId }, data: { kycStatus: status } }),
    ]);

    return updated;
  }

  async requireVerified(userId: string) {
    const status = await this.getStatus(userId);
    if (status !== "VERIFIED") {
      throw new BadRequestException("Identity verification (KYC) required before withdrawing funds");
    }
  }
}
