import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { AdminService } from "./admin.service";
import { ReviewKycDto } from "./dto/review-kyc.dto";
import { ReviewWithdrawalDto } from "../payments/dto/review-withdrawal.dto";
import { CreateCaseDto } from "../cases/dto/admin-case.dto";
import { ToggleCaseDto } from "./dto/toggle-case.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  listUsers(@Query("take") take?: string) {
    return this.adminService.listUsers(take ? Number(take) : undefined);
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.adminService.getUser(id);
  }

  @Get("kyc/pending")
  pendingKyc() {
    return this.adminService.listPendingKyc();
  }

  @Post("kyc/:id/review")
  reviewKyc(
    @CurrentUser() admin: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.adminService.reviewKyc(id, admin.id, dto);
  }

  @Get("withdrawals/pending")
  pendingWithdrawals() {
    return this.adminService.listPendingWithdrawals();
  }

  @Post("withdrawals/:id/review")
  reviewWithdrawal(
    @CurrentUser() admin: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.adminService.reviewWithdrawal(id, admin.id, dto);
  }

  @Get("ledger")
  ledger(@Query("userId") userId?: string, @Query("take") take?: string) {
    return this.adminService.listLedger(userId, take ? Number(take) : undefined);
  }

  @Get("cases")
  listCases() {
    return this.adminService.listCases();
  }

  @Post("cases")
  createCase(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCaseDto) {
    return this.adminService.createCase(admin.id, dto);
  }

  @Patch("cases/:id/active")
  setCaseActive(
    @CurrentUser() admin: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ToggleCaseDto,
  ) {
    return this.adminService.setCaseActive(admin.id, id, dto.isActive);
  }

  @Get("audit-log")
  auditLog(@Query("take") take?: string) {
    return this.adminService.listAuditLog(take ? Number(take) : undefined);
  }
}
