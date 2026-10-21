import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateBattleDto, CreateBattleRoomDto, CreateContractDto, CreateUpgradeDto } from "./dto/game-operation.dto";
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
  @Post("contracts/quote")
  quoteContract(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContractDto) {
    return this.games.quoteContract(user.id, dto.inventoryItemIds);
  }

  @UseGuards(JwtAuthGuard)
  @Post("contracts")
  contract(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContractDto) { return this.games.createContract(user.id, dto.inventoryItemIds); }

  @UseGuards(JwtAuthGuard)
  @Post("upgrades")
  upgrade(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUpgradeDto) { return this.games.createUpgrade(user.id, dto.inventoryItemId, dto.targetCaseItemId); }

  @UseGuards(JwtAuthGuard)
  @Post("battles")
  battle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBattleDto) { return this.games.createBattle(user.id, dto.caseId); }

  @Get("battles/rooms")
  rooms(@Query("status") status?: "WAITING" | "COMPLETED") { return this.games.listBattleRooms(status); }

  @Get("battles/rooms/:id")
  room(@Param("id", ParseUUIDPipe) id: string) { return this.games.getBattleRoom(id); }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("battles/rooms")
  createRoom(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBattleRoomDto) { return this.games.createBattleRoom(user.id, dto.requestKey, dto.caseIds, dto.maxPlayers); }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("battles/rooms/:id/join")
  joinRoom(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.games.joinBattleRoom(user.id, id); }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("battles/rooms/:id/cancel")
  cancelRoom(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) { return this.games.cancelBattleRoom(user.id, id); }
}
