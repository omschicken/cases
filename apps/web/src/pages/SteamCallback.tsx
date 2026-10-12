import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { setTokens } from "../lib/api";

/**
 * Landing point for `/auth/steam` once the API has verified the player with
 * Steam and an account already exists — it redirects here with fresh tokens
 * in the URL fragment, which is not sent to servers in requests or referrers.
 */
export function SteamCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (!accessToken || !refreshToken) {
      navigate("/login?error=steam_failed", { replace: true });
      return;
    }

    setTokens(accessToken, refreshToken);
    refreshUser().finally(() => navigate("/", { replace: true }));
  }, [navigate, refreshUser]);

  return <p className="page-loading">{t("steamCallback.signingIn")}</p>;
}
