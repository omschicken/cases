import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, ApiError, setTokens } from "../lib/api";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * First-time Steam sign-up: Steam has already verified the player, but every
 * other sign-up path on this site requires an explicit age/ToS attestation,
 * so this step collects it before the account actually gets created.
 */
export function SteamCompletePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const pendingToken = searchParams.get("token") ?? "";
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ageConfirmed) {
      setError(t("steamComplete.ageRequired"));
      return;
    }
    if (!pendingToken) {
      setError(t("steamComplete.expired"));
      return;
    }
    setSubmitting(true);
    try {
      const tokens = await api.post<AuthTokens>("/auth/steam/complete", {
        pendingToken,
        ageConfirmed: true,
        referralCode: referralCode || undefined,
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
      await refreshUser();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("steamComplete.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>{t("steamComplete.title")}</h1>
      <p className="hint">{t("steamComplete.hint")}</p>
      <form onSubmit={onSubmit} className="auth-form">
        <label>
          {t("steamComplete.referralCode")}
          <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
          />
          {t("steamComplete.ageConfirm")}
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? t("steamComplete.finishing") : t("steamComplete.continue")}
        </button>
      </form>
      <p>
        <Link to="/">{t("steamComplete.cancel")}</Link>
      </p>
    </div>
  );
}
