import type { CSSProperties } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { CaseOpenHistoryDto, InventoryItemDto, KycStatus, WalletDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { rarityColor } from "../lib/rarity";

interface KycMeResponse {
  status: KycStatus;
  latest: { status: KycStatus; rejectionReason?: string } | null;
}

interface SeedInfo {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const kycLabels: Record<KycStatus, { ru: string; en: string }> = {
  UNVERIFIED: { ru: "Не пройдена", en: "Not verified" },
  PENDING: { ru: "На проверке", en: "Under review" },
  VERIFIED: { ru: "Подтверждена", en: "Verified" },
  REJECTED: { ru: "Отклонена", en: "Rejected" },
};

/** KYC state to badge tone. Typed against KycStatus rather than string, so
 *  adding a state to the union fails the build here instead of silently
 *  rendering a neutral badge for it. */
const KYC_TONE: Record<KycStatus, "ok" | "pending" | "bad" | "idle"> = {
  VERIFIED: "ok",
  PENDING: "pending",
  REJECTED: "bad",
  UNVERIFIED: "idle",
};

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [kyc, setKyc] = useState<KycMeResponse | null>(null);
  const [seed, setSeed] = useState<SeedInfo | null>(null);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [inventory, setInventory] = useState<InventoryItemDto[] | null>(null);
  const [recentOpens, setRecentOpens] = useState<CaseOpenHistoryDto[] | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [documentFrontUrl, setDocumentFrontUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  const [nextClientSeed, setNextClientSeed] = useState("");

  function load() {
    api.get<KycMeResponse>("/kyc/me").then(setKyc).catch(() => undefined);
    api.get<SeedInfo>("/cases/seed/me").then(setSeed).catch(() => undefined);
  }

  function loadOverview() {
    setOverviewError(false);
    setOverviewLoading(true);
    Promise.allSettled([
      api.get<WalletDto>("/wallet/me"),
      api.get<InventoryItemDto[]>("/cases/inventory/me"),
      api.get<CaseOpenHistoryDto[]>("/cases/history/me"),
    ]).then(([nextWallet, nextInventory, nextOpens]) => {
      if (nextWallet.status === "fulfilled") setWallet(nextWallet.value);
      if (nextInventory.status === "fulfilled") setInventory(nextInventory.value);
      if (nextOpens.status === "fulfilled") setRecentOpens(nextOpens.value);
      setOverviewError([nextWallet, nextInventory, nextOpens].some((result) => result.status === "rejected"));
      setOverviewLoading(false);
    });
  }

  useEffect(() => { load(); loadOverview(); }, []);

  async function submitKyc(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/kyc/submit", {
        fullName,
        dateOfBirth,
        documentType: "PASSPORT",
        documentFrontUrl,
        selfieUrl,
      });
      setInfo(t("profile.kyc.submitted"));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.kyc.submitFailed"));
    }
  }

  async function rotateSeed(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/cases/seed/rotate", { nextClientSeed: nextClientSeed || undefined });
      setInfo(t("profile.seed.rotated"));
      setNextClientSeed("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.seed.rotateFailed"));
    }
  }

  return (
    <div className="profile-page">
      <PageHeader
        kicker="DROPZONE / ACCOUNT"
        title={user?.displayName ?? t("profile.title")}
        lede={user?.email}
        aside={<>
          <div className="profile-avatar">{user?.steamAvatarUrl ? <img src={user.steamAvatarUrl} alt="" /> : (user?.displayName ?? user?.email ?? "D").slice(0, 1).toUpperCase()}</div>
          {user && <Readout label="ID" value={user.id.slice(0, 8).toUpperCase()} />}
        </>}
      />

      <nav className="dz-chips" aria-label={t("profile.title")}>
        <Link to="/inventory" className="dz-chip">{t("nav.sidebar.inventory")} <b>01</b></Link>
        <Link to="/history" className="dz-chip">{t("nav.sidebar.history")} <b>02</b></Link>
        <Link to="/wallet" className="dz-chip">{t("nav.pagesBar.wallet", { defaultValue: "Кошелёк" })} <b>03</b></Link>
      </nav>

      <section className="dz-panel" aria-label={t("profile.title")}>
        <div className="dz-panel__label"><span>{t("profile.dashboard")}</span><span>DROPZONE / LIVE DATA</span></div>
        {overviewError && <div className="catalog-notice" role="alert"><span>{t("profile.overviewError")}</span><button type="button" className="catalog-retry" onClick={loadOverview}>{t("common.retry")}</button></div>}
        <div className="dz-stat-grid" aria-busy={overviewLoading}>
          <Link to="/wallet" className="dz-stat"><span className="dz-stat__label">{t("wallet.title")}</span><span className="dz-stat__value">{wallet ? formatMinor(wallet.balanceMinor) : overviewLoading ? "…" : "—"}</span><span className="dz-stat__arrow" aria-hidden="true">↗</span></Link>
          <Link to="/inventory" className="dz-stat"><span className="dz-stat__label">{t("nav.sidebar.inventory")}</span><span className="dz-stat__value">{inventory ? inventory.length : overviewLoading ? "…" : "—"}</span><span className="dz-stat__arrow" aria-hidden="true">↗</span></Link>
          <Link to="/history" className="dz-stat"><span className="dz-stat__label">{t("profile.recentOpens")}</span><span className="dz-stat__value">{recentOpens ? recentOpens.length : overviewLoading ? "…" : "—"}</span><span className="dz-stat__arrow" aria-hidden="true">↗</span></Link>
        </div>
        {recentOpens && recentOpens.length > 0 && <div>
          <div className="dz-panel__label"><span>{t("profile.recentOpens")}</span><Link to="/history">{t("profile.allHistory")} ↗</Link></div>
          <ol className="dz-log">
            {recentOpens.slice(0, 3).map((open) => (
              <li key={open.id} className="dz-log__row" style={{ "--dz-rarity": rarityColor(open.resultCaseItem.rarity) } as CSSProperties}>
                <img className="dz-log__art" src={open.resultCaseItem.imageUrl} alt="" loading="lazy" />
                <div className="dz-log__main">
                  <p className="dz-log__name">{open.resultCaseItem.name}</p>
                  <span className="dz-log__meta"><Link to={`/verify/${open.id}`}>{open.case.name}</Link></span>
                </div>
                <span className="dz-log__value">{formatMinor(open.resultCaseItem.valueMinor, open.resultCaseItem.currency)}</span>
              </li>
            ))}
          </ol>
        </div>}
      </section>

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      <section className="dz-panel">
        <h2>{t("profile.kyc.heading")}</h2>
        <p>
          {t("profile.kyc.status")} <strong className={`dz-status dz-status--${kyc ? KYC_TONE[kyc.status] : "idle"}`}>{kyc ? kycLabels[kyc.status][i18n.language.startsWith("ru") ? "ru" : "en"] : "…"}</strong>
        </p>
        {kyc?.latest?.rejectionReason && (
          <p className="form-error">{t("profile.kyc.reason", { reason: kyc.latest.rejectionReason })}</p>
        )}
        {(kyc?.status === "UNVERIFIED" || kyc?.status === "REJECTED") && (
          <form onSubmit={submitKyc} className="auth-form">
            <label>
              {t("profile.kyc.fullName")}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              {t("profile.kyc.dob")}
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </label>
            <label>
              {t("profile.kyc.docFront")}
              <input
                type="url"
                value={documentFrontUrl}
                onChange={(e) => setDocumentFrontUrl(e.target.value)}
                required
              />
            </label>
            <label>
              {t("profile.kyc.selfie")}
              <input type="url" value={selfieUrl} onChange={(e) => setSelfieUrl(e.target.value)} required />
            </label>
            <p className="hint">{t("profile.kyc.uploadHint")}</p>
            <button type="submit">{t("profile.kyc.submit")}</button>
          </form>
        )}
      </section>

      <section className="dz-panel">
        <h2>{t("profile.seed.heading")}</h2>
        {seed && (
          <ul>
            <li>{t("profile.seed.serverSeedHash", { hash: seed.serverSeedHash })}</li>
            <li>{t("profile.seed.clientSeed", { seed: seed.clientSeed })}</li>
            <li>{t("profile.seed.roundsPlayed", { n: seed.nonce })}</li>
          </ul>
        )}
        <form onSubmit={rotateSeed} className="auth-form">
          <label>
            {t("profile.seed.newClientSeed")}
            <input value={nextClientSeed} onChange={(e) => setNextClientSeed(e.target.value)} />
          </label>
          <button type="submit">{t("profile.seed.rotateButton")}</button>
        </form>
      </section>
    </div>
  );
}
