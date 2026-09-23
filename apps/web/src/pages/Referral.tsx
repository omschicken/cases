import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";

interface ReferralStats {
  referralCode: string;
  referralsCount: number;
  totalEarnedMinor: string;
}

export function ReferralPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);

  useEffect(() => {
    api.get<ReferralStats>("/referral/me").then(setStats).catch(() => undefined);
  }, []);

  if (!stats) return <p>Loading…</p>;

  const link = `${window.location.origin}/register?ref=${stats.referralCode}`;

  return (
    <div>
      <h1>Referral program</h1>
      <p>Share your link — you earn a commission whenever someone you refer deposits.</p>
      <p>
        <code>{link}</code>
      </p>
      <ul>
        <li>Referrals: {stats.referralsCount}</li>
        <li>Total earned: {formatMinor(stats.totalEarnedMinor)}</li>
      </ul>
    </div>
  );
}
