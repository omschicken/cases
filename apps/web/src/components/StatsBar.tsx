import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { PublicStatsDto } from "../lib/types";

export function StatsBar() {
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
        <span className="stat-label">Cases opened</span>
      </div>
      <div className="stat-tile">
        <span className="stat-value">{formatMinor(stats.totalValueMinor)}</span>
        <span className="stat-label">Total won</span>
      </div>
      <div className="stat-tile">
        <span className="stat-value">{stats.playerCount.toLocaleString()}</span>
        <span className="stat-label">Players</span>
      </div>
    </div>
  );
}
