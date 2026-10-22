import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { PageHeader } from "../components/dz/PageHeader";

interface ReferralStats {
  referralCode: string;
  referralsCount: number;
  totalEarnedMinor: string;
}

export function ReferralPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    api
      .get<ReferralStats>("/referral/me")
      .then((data) => { if (active) setStats(data); })
      // A swallowed rejection left this page on "Loading…" forever, with no
      // error and nothing to retry — the failure was invisible rather than
      // handled.
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  if (failed && !stats) return (
    <div className="referral-page">
      <PageHeader kicker="CASECROW / REFERRAL" title={t("referral.title")} lede={t("referral.description")} />
      <div className="dz-empty" role="alert">
        <span className="dz-empty__mark" aria-hidden="true">!</span>
        <h2 className="dz-empty__title">{t("common.error", { defaultValue: "Не удалось загрузить" })}</h2>
        <button type="button" className="dz-btn" onClick={() => setAttempt((n) => n + 1)}>
          {t("common.retry", { defaultValue: "Повторить" })}
        </button>
      </div>
    </div>
  );

  if (!stats) return (
    <div className="referral-page">
      <PageHeader kicker="CASECROW / REFERRAL" title={t("referral.title")} lede={t("referral.description")} />
      <p aria-busy="true">{t("common.loading")}</p>
    </div>
  );

  const link = `${window.location.origin}/register?ref=${stats.referralCode}`;

  return (
    <div className="referral-page">
      <PageHeader kicker="CASECROW / REFERRAL" title={t("referral.title")} lede={t("referral.description")} />
      <div className="referral-link-panel">
        <span>LINK / SHARE</span>
        <code>{link}</code>
      </div>
      <ul className="referral-stat-grid">
        <li>{t("referral.referrals", { n: stats.referralsCount })}</li>
        <li>{t("referral.totalEarned", { amount: formatMinor(stats.totalEarnedMinor) })}</li>
      </ul>
    </div>
  );
}
