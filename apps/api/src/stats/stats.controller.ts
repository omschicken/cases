import { Controller, Get, Header } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=300")
  get() {
    return this.stats.get();
  }
}
