import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { CaseOpenHistoryDto, InventoryItemDto, KycStatus, WalletDto } from "../lib/types";

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
      <header className="profile-identity">
        <div className="profile-avatar">{user?.steamAvatarUrl ? <img src={user.steamAvatarUrl} alt="" /> : (user?.displayName ?? user?.email ?? "D").slice(0, 1).toUpperCase()}</div>
        <div><span className="section-kicker">DROPZONE / ACCOUNT</span><h1>{user?.displayName ?? t("profile.title")}</h1><p>{user?.email}</p></div>
        <span className="profile-account-id">ID / {user?.id.slice(0, 8).toUpperCase()}</span>
      </header>

      <nav className="profile-shortcuts" aria-label={t("profile.title")}>
        <Link to="/inventory"><span>01</span>{t("nav.sidebar.inventory")} <i aria-hidden="true">↗</i></Link>
        <Link to="/history"><span>02</span>{t("nav.sidebar.history")} <i aria-hidden="true">↗</i></Link>
        <Link to="/wallet"><span>03</span>{t("nav.pagesBar.wallet", { defaultValue: "Кошелёк" })} <i aria-hidden="true">↗</i></Link>
      </nav>

      <section className="profile-overview" aria-label={t("profile.title")}>
        <div className="profile-overview-head"><span>{t("profile.dashboard")}</span><span>DROPZONE / LIVE DATA</span></div>
        {overviewError && <div className="catalog-notice" role="alert"><span>{t("profile.overviewError")}</span><button type="button" className="catalog-retry" onClick={loadOverview}>{t("common.retry")}</button></div>}
        <div className="profile-stat-grid" aria-busy={overviewLoading}>
          <Link to="/wallet"><span>{t("wallet.title")}</span><strong>{wallet ? formatMinor(wallet.balanceMinor) : overviewLoading ? "…" : "—"}</strong><i aria-hidden="true">↗</i></Link>
          <Link to="/inventory"><span>{t("nav.sidebar.inventory")}</span><strong>{inventory ? inventory.length : overviewLoading ? "…" : "—"}</strong><i aria-hidden="true">↗</i></Link>
          <Link to="/history"><span>{t("profile.recentOpens")}</span><strong>{recentOpens ? recentOpens.length : overviewLoading ? "…" : "—"}</strong><i aria-hidden="true">↗</i></Link>
        </div>
        {recentOpens && recentOpens.length > 0 && <div className="profile-recent">
          <div className="profile-overview-head"><span>{t("profile.recentOpens")}</span><Link to="/history">{t("profile.allHistory")} ↗</Link></div>
          {recentOpens.slice(0, 3).map((open) => <Link to={`/verify/${open.id}`} key={open.id} className="profile-recent-row"><img src={open.resultCaseItem.imageUrl} alt="" loading="lazy" /><span><strong>{open.resultCaseItem.name}</strong><small>{open.case.name}</small></span><b>{formatMinor(open.resultCaseItem.valueMinor, open.resultCaseItem.currency)}</b></Link>)}
        </div>}
      </section>

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      <section className="profile-settings-panel">
        <h2>{t("profile.kyc.heading")}</h2>
        <p>
          {t("profile.kyc.status")} <strong className={`profile-kyc-status profile-kyc-status--${kyc?.status?.toLowerCase() ?? "loading"}`}>{kyc ? kycLabels[kyc.status][i18n.language.startsWith("ru") ? "ru" : "en"] : "…"}</strong>
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

      <section className="profile-settings-panel">
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
