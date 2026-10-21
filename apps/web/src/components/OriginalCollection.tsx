import { Link } from "react-router-dom";
import { CASECROW_ART_COLLECTIONS, CASECROW_ORIGINALS } from "../lib/casecrowOriginals";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";
import "../styles/casecrow-original-collections.css";

interface Props { cases: CaseDto[]; loading: boolean; search: string; }

/** Artwork and taxonomy are local; prices, availability and contents come from the API. */
export function OriginalCollection({ cases, loading, search }: Props) {
  const availableBySlug = new Map(cases.map(item => [item.slug, item]));
  const needle = search.trim().toLocaleLowerCase("ru");
  return <div id="new-collections">
    {CASECROW_ART_COLLECTIONS.map(group => {
      const entries = CASECROW_ORIGINALS.filter(entry => entry.series === group.key &&
        (!needle || `${entry.name} ${availableBySlug.get(entry.slug)?.items.map(item => item.name).join(" ") ?? ""}`.toLocaleLowerCase("ru").includes(needle)));
      if (!entries.length) return null;
      return <section className="fidelity-catalog original-catalog" aria-labelledby={`collection-${group.key}`} key={group.key}>
        <div className="fidelity-catalog-head">
          <h2 id={`collection-${group.key}`}>{group.title} <small>{entries.length}</small></h2>
        </div>
        <p>{group.subtitle}</p>
        <div className="fidelity-card-grid" aria-busy={loading}>
          {entries.map(entry => {
            const data = availableBySlug.get(entry.slug);
            const label = loading ? "Загрузка…" : !data ? "Недоступен" : data.isActive && data.canOpen !== false ? "Доступен" : "Недоступен";
            return <article className="fidelity-card" key={entry.slug}>
              <Link className="fidelity-card-art" to={`/cases/${entry.slug}`} aria-label={`Открыть страницу ${entry.name}`}>
                <img src={entry.imageUrl} alt={entry.name} width="1100" height="1100" loading="lazy" decoding="async" />
                <span>{label}</span>
              </Link>
              <div className="fidelity-card-info">
                <div><h3>{entry.name}</h3><strong>{data ? formatMinor(data.priceMinor, data.currency) : "—"}</strong></div>
                <Link to={`/cases/${entry.slug}`}>{data?.isActive && data.canOpen !== false ? "Открыть" : "Подробнее"} <span>→</span></Link>
              </div>
            </article>;
          })}
        </div>
      </section>;
    })}
  </div>;
}
