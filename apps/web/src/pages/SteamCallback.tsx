import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { setTokens } from "../lib/api";

/**
 * Landing point for `/auth/steam` once the API has verified the player with
 * Steam and an account already exists — it redirects here with fresh tokens
 * as query params (a real browser redirect, so they can't come back any
 * other way).
 */
export function SteamCallbackPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    if (!accessToken || !refreshToken) {
      navigate("/login?error=steam_failed", { replace: true });
      return;
    }

    setTokens(accessToken, refreshToken);
    refreshUser().finally(() => navigate("/", { replace: true }));
  }, [searchParams, navigate, refreshUser]);

  return <p className="page-loading">{t("steamCallback.signingIn")}</p>;
}
