import { Link } from "react-router-dom";
import { CASECROW_ART_COLLECTIONS, CASECROW_ORIGINALS } from "../lib/casecrowOriginals";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";
import "../styles/casecrow-original-collections.css";

interface Props {
  cases: CaseDto[];
  loading: boolean;
  search: string;
}

/** The collection is editorial only; availability, pricing and opening live on the API. */
export function OriginalCollection({ cases, loading, search }: Props) {
  const availableBySlug = new Map(cases.map((theCase) => [theCase.slug, theCase]));
  const needle = search.trim().toLocaleLowerCase("ru");
  const groups = CASECROW_ART_COLLECTIONS.map((group) => ({
    ...group,
    entries: CASECROW_ORIGINALS.filter((entry) =>
      entry.series === group.key && (!needle || entry.name.toLocaleLowerCase("ru").includes(needle)),
    ),
  })).filter((group) => group.entries.length > 0);
  if (!groups.length) return null;

  return <div className="cco-collections" id="new-collections">
    {groups.map((group) => <section className="cco-section" aria-labelledby={`cco-title-${group.key}`} key={group.key}>
      <header className="cco-header">
        <div>
          <p className="cco-kicker">CASECROW / COLLECTION</p>
          <h2 id={`cco-title-${group.key}`}>{group.title}</h2>
          <p>{group.subtitle}</p>
        </div>
        <span>{String(group.entries.length).padStart(2, "0")} кейсов</span>
      </header>
      <div className="cco-grid">
        {group.entries.map((entry) => {
          const data = availableBySlug.get(entry.slug);
          const live = Boolean(data?.isActive && data.canOpen !== false);
          const art = <div className="cco-art">
            <img src={entry.imageUrl} alt={entry.name} loading="lazy" decoding="async" width="600" height="600" />
          </div>;
          return <article className={`cco-card ${live ? "cco-live" : "cco-pending"}`} key={entry.slug} style={{ "--cco-accent": entry.accent } as React.CSSProperties}>
            {live
              ? <Link className="cco-visual-link" to={`/cases/${entry.slug}`} aria-label={`Открыть кейс ${entry.name}`}>{art}</Link>
              : <div className="cco-visual-link">{art}</div>}
            <div className="cco-info">
              <div><h3>{entry.name}</h3><span>{data ? formatMinor(data.priceMinor, data.currency) : "Скоро"}</span></div>
              {live
                ? <Link to={`/cases/${entry.slug}`}>Открыть <span aria-hidden="true">↗</span></Link>
                : <span className="cco-unavailable">{loading ? "Загрузка…" : data?.canOpen === false ? "Проверка цены" : "Готовится"}</span>}
            </div>
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}
