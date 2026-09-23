import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { generateReferralCode } from "../common/util/code";
import { JwtPayload } from "./jwt.strategy";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    let referredById: string | undefined;
    if (dto.referralCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: dto.referralCode },
      });
      referredById = referrer?.id;
    }

    const passwordHash = await argon2.hash(dto.password);

    // Retry on the (astronomically unlikely) referralCode collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: dto.email,
              passwordHash,
              ageConfirmedAt: new Date(),
              referralCode: generateReferralCode(),
              referredById,
            },
          });
          await tx.wallet.create({ data: { userId: created.id } });
          return created;
        });
        return this.issueTokens(user.id, user.email, user.role);
      } catch (err: unknown) {
        const isUniqueViolation =
          typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
        if (!isUniqueViolation) throw err;
      }
    }
    throw new ConflictException("Could not allocate a unique referral code, please retry");
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException("Invalid refresh token");

    return this.issueTokens(user.id, user.email, user.role);
  }

  private async issueTokens(userId: string, email: string, role: JwtPayload["role"]): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_TTL", "7d"),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
