import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { PublicStatsDto } from "../lib/types";

const STATS_FALLBACK: PublicStatsDto = { totalOpens: "0", totalValueMinor: "0", playerCount: 0 };

export function StatsBar() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PublicStatsDto>(STATS_FALLBACK);

  useEffect(() => {
    api
      .get<PublicStatsDto>("/cases/stats")
      // Merged over the defaults rather than replacing them: a payload
      // missing a field would otherwise leave it undefined, and this renders
      // inside the home page, so one undefined number took the whole page
      // down with it.
      .then((data) => setStats({ ...STATS_FALLBACK, ...data }))
      .catch(() => undefined);
  }, []);

  if (Number(stats.totalOpens) === 0) return null;

  return (
    <div className="stats-bar">
      <div className="stat-tile">
        <span className="stat-value">{Number(stats.totalOpens).toLocaleString()}</span>
        <span className="stat-label">{t("home.stats.casesOpened")}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-value">{formatMinor(stats.totalValueMinor)}</span>
        <span className="stat-label">{t("home.stats.totalWon")}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-value">{stats.playerCount.toLocaleString()}</span>
        <span className="stat-label">{t("home.stats.players")}</span>
      </div>
    </div>
  );
}
