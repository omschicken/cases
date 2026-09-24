import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";

interface ReferralStats {
  referralCode: string;
  referralsCount: number;
  totalEarnedMinor: string;
}

export function ReferralPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ReferralStats | null>(null);

  useEffect(() => {
    api.get<ReferralStats>("/referral/me").then(setStats).catch(() => undefined);
  }, []);

  if (!stats) return <p>{t("common.loading")}</p>;

  const link = `${window.location.origin}/register?ref=${stats.referralCode}`;

  return (
    <div>
      <h1>{t("referral.title")}</h1>
      <p>{t("referral.description")}</p>
      <p>
        <code>{link}</code>
      </p>
      <ul>
        <li>{t("referral.referrals", { n: stats.referralsCount })}</li>
        <li>{t("referral.totalEarned", { amount: formatMinor(stats.totalEarnedMinor) })}</li>
      </ul>
    </div>
  );
}
