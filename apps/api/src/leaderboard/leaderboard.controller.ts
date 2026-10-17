import { Controller, Get, Header } from "@nestjs/common";
import { LeaderboardService } from "./leaderboard.service";

@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=60")
  top() {
    return this.leaderboard.top(50);
  }
}
