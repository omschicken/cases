import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { SteamCompleteDto } from "./dto/steam-complete.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "./jwt.strategy";
import { SteamOpenIdService } from "./steam-openid.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly steamOpenId: SteamOpenIdService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  refresh(@Body("refreshToken") refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  // Full-page browser redirect (not an API fetch) — Steam's OpenID flow
  // requires the user's own browser to visit Steam and come back.
  @Get("steam")
  loginWithSteam(@Res() res: Response) {
    res.redirect(this.steamOpenId.buildLoginUrl());
  }

  @Get("steam/callback")
  async steamCallback(@Query() query: Record<string, string>, @Res() res: Response) {
    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:5173");
    const steamId = await this.steamOpenId.verifyCallback(query);

    if (!steamId) {
      return res.redirect(`${webOrigin}/login?error=steam_failed`);
    }

    const tokens = await this.authService.loginWithSteamId(steamId);
    if (tokens) {
      return res.redirect(
        `${webOrigin}/auth/steam/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
      );
    }

    // First time this SteamID has shown up: verified by Steam, but still
    // needs the same age/ToS attestation every other sign-up path requires
    // before an account (and wallet) gets created.
    const profile = await this.steamOpenId.fetchProfile(steamId);
    const pendingToken = await this.authService.issueSteamSignupToken(steamId, profile);
    return res.redirect(`${webOrigin}/auth/steam/complete?token=${encodeURIComponent(pendingToken)}`);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("steam/complete")
  completeSteamSignup(@Body() dto: SteamCompleteDto) {
    return this.authService.completeSteamSignup(dto.pendingToken, dto.referralCode);
  }
}
