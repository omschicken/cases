import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseOpenHistoryDto } from "../lib/types";

export function HistoryPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<CaseOpenHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<CaseOpenHistoryDto[]>("/cases/history/me")
      .then((data) => { if (active) setEvents(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="history-page">
      <header className="history-heading">
        <div>
          <p className="section-kicker">{t("history.kicker")}</p>
          <h1>{t("history.title")}</h1>
          <p className="section-intro">{t("history.description")}</p>
        </div>
        <Link to="/inventory" className="history-inventory-link">{t("history.inventoryLink")}</Link>
      </header>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p className="form-error" role="alert">{t("history.loadError")}</p>}
      {!loading && !error && events.length === 0 && (
        <div className="history-empty" role="status">
          <h2>{t("history.emptyTitle")}</h2>
          <p>{t("history.emptyDescription")}</p>
          <Link to="/" className="open-button">{t("history.openCases")}</Link>
        </div>
      )}

      <ol className="history-list">
        {events.map((event) => (
          <li key={event.id} className="history-row" style={{ "--rarity-color": rarityColor(event.resultCaseItem.rarity) } as CSSProperties}>
            <img src={event.resultCaseItem.imageUrl} alt="" loading="lazy" />
            <div className="history-row-main">
              <Link to={`/cases/${event.case.slug}`} className="history-case-name">{event.case.name}</Link>
              <strong>{event.resultCaseItem.name}</strong>
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
            </div>
            <div className="history-row-result">
              <span className="history-rarity">{t(`rarity.${event.resultCaseItem.rarity}`, { defaultValue: event.resultCaseItem.rarity })}</span>
              <strong>{formatMinor(event.resultCaseItem.valueMinor, event.resultCaseItem.currency)}</strong>
              <Link to={`/verify/${event.id}`}>{t("history.verify")}</Link>
            </div>
          </li>
        ))}
      </ol>
      {!loading && !error && events.length === 50 && <p className="history-limit">{t("history.recentLimit")}</p>}
    </div>
  );
}
