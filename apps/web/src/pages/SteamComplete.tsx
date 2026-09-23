import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
      setError("You must confirm you are of legal gambling age to continue.");
      return;
    }
    if (!pendingToken) {
      setError("Steam sign-up session expired, please log in again.");
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
      setError(err instanceof ApiError ? err.message : "Steam sign-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>One last step</h1>
      <p className="hint">Steam verified your identity — confirm the rest to finish creating your account.</p>
      <form onSubmit={onSubmit} className="auth-form">
        <label>
          Referral code (optional)
          <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
          />
          I confirm I am of legal age to gamble in my jurisdiction and I accept the Terms of Service.
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Finishing up…" : "Continue"}
        </button>
      </form>
      <p>
        <Link to="/">Cancel</Link>
      </p>
    </div>
  );
}
