import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const CLAIMED_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export interface SteamProfile {
  displayName: string;
  avatarUrl: string;
}

/**
 * Real Steam OpenID 2.0 login — no paid/gated credential needed for the
 * core flow (redirect to Steam, verify the signed callback). Fetching the
 * player's persona name/avatar via the Steam Web API is a nice-to-have
 * layered on top; it needs a free STEAM_API_KEY and degrades gracefully
 * (generic display name/avatar) when one isn't configured.
 */
@Injectable()
export class SteamOpenIdService {
  private readonly logger = new Logger(SteamOpenIdService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiBaseUrl(): string {
    return this.config.get<string>("API_PUBLIC_URL", `http://localhost:${this.config.get("PORT", 4000)}`);
  }

  private get returnUrl(): string {
    return `${this.apiBaseUrl}/auth/steam/callback`;
  }

  buildLoginUrl(): string {
    const params = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": this.returnUrl,
      "openid.realm": this.apiBaseUrl,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    });
    return `${STEAM_OPENID_URL}?${params.toString()}`;
  }

  /** Verifies the callback query with Steam directly. Returns the SteamID64, or null if invalid/forged. */
  async verifyCallback(query: Record<string, string>): Promise<string | null> {
    const claimedId = query["openid.claimed_id"];
    if (!claimedId) return null;

    const match = CLAIMED_ID_PATTERN.exec(claimedId);
    if (!match) return null;

    const verifyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith("openid.")) verifyParams.set(key, value);
    }
    verifyParams.set("openid.mode", "check_authentication");

    try {
      const res = await fetch(STEAM_OPENID_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: verifyParams.toString(),
      });
      const text = await res.text();
      if (!text.includes("is_valid:true")) return null;
    } catch (err) {
      this.logger.error("Steam OpenID verification request failed", err as Error);
      return null;
    }

    return match[1];
  }

  async fetchProfile(steamId: string): Promise<SteamProfile | null> {
    const apiKey = this.config.get<string>("STEAM_API_KEY");
    if (!apiKey) return null;

    try {
      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        response?: { players?: { personaname?: string; avatarfull?: string }[] };
      };
      const player = data.response?.players?.[0];
      if (!player?.personaname) return null;
      return { displayName: player.personaname, avatarUrl: player.avatarfull ?? "" };
    } catch (err) {
      this.logger.warn(`Steam profile fetch failed for ${steamId}: ${(err as Error).message}`);
      return null;
    }
  }
}
