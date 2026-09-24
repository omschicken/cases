import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { PublicStatsDto } from "../lib/types";

export function StatsBar() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PublicStatsDto | null>(null);

  useEffect(() => {
    api
      .get<PublicStatsDto>("/cases/stats")
      .then(setStats)
      .catch(() => undefined);
  }, []);

  if (!stats) return null;

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
