import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/dz/PageHeader";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, rarityColor } from "../lib/rarity";
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
      <PageHeader
        kicker={t("history.kicker")}
        title={t("history.title")}
        lede={t("history.description")}
        aside={<Link to="/inventory" className="dz-btn">{t("history.inventoryLink")}</Link>}
      />

      {loading && <p>{t("common.loading")}</p>}
      {error && <p className="form-error" role="alert">{t("history.loadError")}</p>}
      {!loading && !error && events.length === 0 && (
        <div className="dz-empty" role="status">
          <span className="dz-empty__mark" aria-hidden="true">◷</span>
          <h2 className="dz-empty__title">{t("history.emptyTitle")}</h2>
          <p className="dz-empty__body">{t("history.emptyDescription")}</p>
          <Link to="/" className="dz-hero__cta">{t("history.openCases")}</Link>
        </div>
      )}

      <ol className="dz-log">
        {events.map((event) => (
          <li
            key={event.id}
            className="dz-log__row"
            style={{ "--dz-rarity": rarityColor(event.resultCaseItem.rarity) } as CSSProperties}
          >
            <img className="dz-log__art" src={event.resultCaseItem.imageUrl} alt="" loading="lazy" />
            <div className="dz-log__main">
              <p className="dz-log__name">{event.resultCaseItem.name}</p>
              <span className="dz-log__meta">
                {t(`rarity.${event.resultCaseItem.rarity}`, { defaultValue: RARITY_LABELS[event.resultCaseItem.rarity] })}
                {" · "}
                <Link to={`/cases/${event.case.slug}`}>{event.case.name}</Link>
                {" · "}
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                {" · "}
                <Link to={`/verify/${event.id}`}>{t("history.verify")}</Link>
              </span>
            </div>
            <span className="dz-log__value">
              {formatMinor(event.resultCaseItem.valueMinor, event.resultCaseItem.currency)}
            </span>
          </li>
        ))}
      </ol>
      {!loading && !error && events.length === 50 && <p className="history-limit">{t("history.recentLimit")}</p>}
    </div>
  );
}
