import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/dz/PageHeader";

interface Entry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  totalWinnings: number;
  totalOpenings: number;
  bestWin: number;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Minor units (kopecks) -> "1 234 ₽". */
function rub(minor: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.floor(minor / 100))} ₽`;
}

function Avatar({ entry }: { entry: Entry }) {
  return entry.avatar ? (
    <img className="lb-avatar" src={entry.avatar} alt="" loading="lazy" />
  ) : (
    <span className="lb-avatar lb-avatar--fallback" aria-hidden="true">
      {entry.username.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setEntries(null);
    api
      .get<Entry[]>("/leaderboard")
      .then((rows) => setEntries(Array.isArray(rows) ? rows : []))
      .catch(() => {
        setError(true);
        setEntries([]);
      });
  }, []);

  useEffect(load, [load]);

  const podiumOrder = entries ? [entries[1], entries[0], entries[2]].filter(Boolean) : [];
  const rest = entries ? entries.slice(3) : [];

  return (
    <div className="lb-page">
      <PageHeader
        kicker="DROPZONE / TOP"
        title="LEADERBOARD"
        lede={t("leaderboard.lede", { defaultValue: "Лучшие игроки по сумме выигрышей из кейсов." })}
        aside={
          <button type="button" onClick={load} className="lb-refresh">
            ↻ {t("leaderboard.refresh", { defaultValue: "Обновить" })}
          </button>
        }
      />

      {entries === null && (
        <div className="lb-skeleton" aria-busy="true" aria-label={t("leaderboard.loading", { defaultValue: "Загрузка" })}>
          <div className="lb-skeleton__podium">
            {[0, 1, 2].map((i) => <div key={i} className="lb-skeleton__card" />)}
          </div>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="lb-skeleton__row" />)}
        </div>
      )}

      {error && <p className="form-error">{t("leaderboard.error", { defaultValue: "Не удалось загрузить рейтинг." })}</p>}
      {entries && !error && entries.length === 0 && (
        <p className="hint">{t("leaderboard.empty", { defaultValue: "Пока никто не попал в рейтинг." })}</p>
      )}

      {podiumOrder.length > 0 && (
        <section className="lb-podium" aria-label="Top 3">
          {podiumOrder.map((e) => (
            <article key={e.userId} className={`lb-podium__card lb-podium__card--${e.rank}${user?.id === e.userId ? " lb-me" : ""}`}>
              <span className="lb-podium__medal" aria-hidden="true">{MEDALS[e.rank]}</span>
              <Avatar entry={e} />
              <h3 className="lb-podium__name">{e.username}</h3>
              <strong className="lb-podium__wins">{rub(e.totalWinnings)}</strong>
              <span className="lb-podium__meta">
                {e.totalOpenings} {t("leaderboard.openings", { defaultValue: "открытий" })}
              </span>
            </article>
          ))}
        </section>
      )}

      {rest.length > 0 && (
        <div className="dz-table-scroll">
          <table className="dz-table lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("leaderboard.player", { defaultValue: "Игрок" })}</th>
                <th>{t("leaderboard.wins", { defaultValue: "Выигрыш" })}</th>
                <th>{t("leaderboard.openingsCol", { defaultValue: "Открытий" })}</th>
                <th>{t("leaderboard.best", { defaultValue: "Лучший дроп" })}</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((e) => (
                <tr key={e.userId} className={user?.id === e.userId ? "lb-me" : undefined}>
                  <td>{e.rank}</td>
                  <td className="lb-player"><Avatar entry={e} /> {e.username}</td>
                  <td>{rub(e.totalWinnings)}</td>
                  <td>{e.totalOpenings}</td>
                  <td>{rub(e.bestWin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
