import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateBattleDto, CreateContractDto, CreateUpgradeDto } from "./dto/game-operation.dto";
import { GamesService } from "./games.service";

@Controller("games")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get("upgrade-targets")
  targets() { return this.games.listUpgradeTargets(); }

  @UseGuards(JwtAuthGuard)
  @Get("operations/me")
  history(@CurrentUser() user: AuthenticatedUser) { return this.games.listMyOperations(user.id); }

  @UseGuards(JwtAuthGuard)
  @Post("contracts")
  contract(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContractDto) { return this.games.createContract(user.id, dto.inventoryItemIds); }

  @UseGuards(JwtAuthGuard)
  @Post("upgrades")
  upgrade(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUpgradeDto) { return this.games.createUpgrade(user.id, dto.inventoryItemId, dto.targetCaseItemId); }

  @UseGuards(JwtAuthGuard)
  @Post("battles")
  battle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBattleDto) { return this.games.createBattle(user.id, dto.caseId); }
}
