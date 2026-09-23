import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CasesService } from "./cases.service";
import { OpenCaseDto } from "./dto/open-case.dto";
import { RotateSeedDto } from "./dto/rotate-seed.dto";

@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  listActive() {
    return this.casesService.listActive();
  }

  // Must be declared before the ":slug" route below — both are single path
  // segments, and NestJS/Express matches in registration order, so ":slug"
  // would otherwise swallow these as if they were a case slug.
  @Get("recent-drops")
  recentDrops() {
    return this.casesService.listRecentDrops();
  }

  @Get("stats")
  stats() {
    return this.casesService.getPublicStats();
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.casesService.getBySlug(slug);
  }

  // Public: provably-fair results must be independently auditable by anyone,
  // not just the user who opened the case.
  @Get("open-events/:id/verify")
  verify(@Param("id") id: string) {
    return this.casesService.verifyOpenEvent(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("open")
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenCaseDto) {
    return this.casesService.openCase(user.id, dto.caseId, dto.clientSeed);
  }

  @UseGuards(JwtAuthGuard)
  @Get("inventory/me")
  myInventory(@CurrentUser() user: AuthenticatedUser) {
    return this.casesService.listMyInventory(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("inventory/:id/sell")
  sell(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.casesService.sellItem(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("seed/me")
  async mySeed(@CurrentUser() user: AuthenticatedUser) {
    const seed = await this.casesService.getOrCreateActiveSeed(user.id);
    return {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post("seed/rotate")
  rotateSeed(@CurrentUser() user: AuthenticatedUser, @Body() dto: RotateSeedDto) {
    return this.casesService.rotateSeed(user.id, dto.nextClientSeed);
  }
}
