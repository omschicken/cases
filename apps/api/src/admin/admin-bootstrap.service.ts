import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { generateReferralCode } from "../common/util/code";

/**
 * Promotes (or creates) a single admin account on boot, driven entirely by
 * env vars. Lets us provision production admins without ever needing a
 * direct DB connection or a deploy-time seed step: set
 * ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD on the Railway service and
 * restart it once. Existing accounts are only promoted to ADMIN, never
 * password-reset, so this can't be used to hijack a real user's login.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>("ADMIN_BOOTSTRAP_EMAIL")?.trim().toLowerCase();
    const password = this.config.get<string>("ADMIN_BOOTSTRAP_PASSWORD");
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role !== "ADMIN") {
        await this.prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
        this.logger.warn(`Promoted existing user ${email} to ADMIN via ADMIN_BOOTSTRAP_EMAIL`);
      }
      return;
    }

    const passwordHash = await argon2.hash(password);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              passwordHash,
              role: "ADMIN",
              ageConfirmedAt: new Date(),
              referralCode: generateReferralCode(),
            },
          });
          await tx.wallet.create({ data: { userId: created.id } });
        });
        this.logger.warn(`Created ADMIN account ${email} via ADMIN_BOOTSTRAP_EMAIL`);
        return;
      } catch (err: unknown) {
        const isUniqueViolation =
          typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
        if (!isUniqueViolation) throw err;
      }
    }
    this.logger.error(`Could not create bootstrap admin ${email}: referral code collisions`);
  }
}
