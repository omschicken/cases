import { Controller, Get, Header, Query } from "@nestjs/common";
import { PricesService } from "./prices.service";

const num = (v?: string) => (v === undefined || v === "" ? undefined : Number(v));

@Controller("market")
export class MarketController {
  constructor(private readonly prices: PricesService) {}

  /** The full Market.CSGO catalog with live prices (minor units). */
  @Get("items")
  @Header("Cache-Control", "public, s-maxage=20, stale-while-revalidate=40")
  items(
    @Query("q") q?: string,
    @Query("category") category?: string,
    @Query("currency") currency?: string,
    @Query("min") min?: string,
    @Query("max") max?: string,
    @Query("sort") sort?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.prices.listItems({ q, category, currency, min: num(min), max: num(max), sort, limit: num(limit), offset: num(offset) });
  }

  @Get("status")
  status() {
    return this.prices.getStatus();
  }

  /** Cheap no-op unless prices are older than a minute; safe for cron / uptime pingers. */
  @Get("refresh")
  async refresh() {
    await this.prices.ensureFresh();
    return this.prices.getStatus();
  }
}
