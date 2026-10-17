import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";

interface SiteStats {
  totalOpenings: number;
  bestDrop: { itemName: string; value: string; rarity: string } | null;
  playerCount: number;
}

const REFRESH_MS = 5 * 60_000;

/** Thin strip under the page nav with real, server-cached site numbers. */
export function SiteStatsBar() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = () =>
      api
        .get<SiteStats>("/stats")
        .then((s) => !stopped && setStats(s))
        .catch(() => undefined);
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="site-stats" role="status" aria-label={t("siteStats.label", { defaultValue: "Статистика сайта" })}>
      {stats ? (
        <>
          <span>🎮 {t("siteStats.opened", { defaultValue: "Открыто кейсов" })}: <b>{stats.totalOpenings.toLocaleString("ru-RU")}</b></span>
          <span>
            💎 {t("siteStats.best", { defaultValue: "Лучший дроп" })}:{" "}
            <b>{stats.bestDrop ? `${stats.bestDrop.itemName} · ${formatMinor(stats.bestDrop.value)}` : "—"}</b>
          </span>
          <span>👥 {t("siteStats.players", { defaultValue: "Игроков" })}: <b>{stats.playerCount.toLocaleString("ru-RU")}</b></span>
        </>
      ) : (
        <>
          <i className="site-stats__skel" /><i className="site-stats__skel" /><i className="site-stats__skel" />
        </>
      )}
    </div>
  );
}
