import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import heroImage from "../assets/casecrow-approved/cases/webp/case_01.webp";
import staticImage from "../assets/editorial-kit/static-case.webp";
import ignitionImage from "../assets/editorial-kit/ignition-case.webp";
import tidalImage from "../assets/editorial-kit/tidal-case.webp";
import phantomImage from "../assets/editorial-kit/phantom-case.webp";
import promoImage from "../assets/editorial-kit/promo.webp";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";

type SortMode = "default" | "priceAsc" | "priceDesc" | "name";
type PriceFilter = "all" | "entry" | "core" | "apex";

const EDITORIAL_ART: Record<string, string> = {
  static: staticImage,
  ignition: ignitionImage,
  tidal: tidalImage,
  phantom: phantomImage,
};

const FILTERS: Array<{ value: PriceFilter; label: string }> = [
  { value: "all", label: "Все кейсы" },
  { value: "entry", label: "До 500 ₽" },
  { value: "core", label: "500–1 500 ₽" },
  { value: "apex", label: "От 1 500 ₽" },
];

function belongsToFilter(item: CaseDto, filter: PriceFilter): boolean {
  if (filter === "all") return true;
  const price = Number(item.priceMinor);
  if (filter === "entry") return price < 50_000;
  if (filter === "core") return price >= 50_000 && price <= 150_000;
  return price > 150_000;
}

function caseArt(item: CaseDto): string {
  return EDITORIAL_ART[item.slug] ?? item.imageUrl;
}

export function CaseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [query, setQuery] = useState(searchQuery);
  const [filter, setFilter] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    setQuery(searchQuery);
    setFilter("all");
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<CaseDto[]>("/cases")
      .then((data) => {
        if (!active) return;
        setCases(data);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setCases([]);
        setError(caught instanceof ApiError ? caught.message : "Не удалось загрузить каталог");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [requestId]);

  const visibleCases = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    const filtered = cases.filter((item) =>
      belongsToFilter(item, filter) &&
      (!needle || `${item.name} ${item.slug} ${item.items.map((entry) => entry.name).join(" ")}`.toLocaleLowerCase("ru").includes(needle)),
    );
    if (sort === "default") return filtered;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      const difference = Number(a.priceMinor) - Number(b.priceMinor);
      return sort === "priceAsc" ? difference : -difference;
    });
  }, [cases, filter, query, sort]);

  const featured = useMemo(
    () => [...cases].sort((a, b) => Number(b.priceMinor) - Number(a.priceMinor))[0],
    [cases],
  );

  return (
    <>
      <section className="fidelity-hero" aria-labelledby="fidelity-title">
        <div className="fidelity-hero-copy">
          <p>Коллекции&nbsp; / &nbsp;Counter-Strike 2</p>
          <h1 id="fidelity-title">Предметы<br />с <span>характером.</span></h1>
          <div className="fidelity-mobile-art"><img src={heroImage} alt="Коллекционный кейс CaseCrow" /></div>
          <div className="fidelity-hero-bottom">
            <p>Открывай кейсы, собирай редкие скины<br />и формируй собственную коллекцию.</p>
            <a href="#catalog">Открыть кейсы <span>→</span></a>
          </div>
        </div>
        <div className="fidelity-hero-art">
          <img src={heroImage} alt="Коллекционный кейс CaseCrow" />
        </div>
      </section>

      <section className="fidelity-catalog" id="catalog" aria-labelledby="catalog-title">
        <div className="fidelity-catalog-head">
          <h2 id="catalog-title">Коллекции <small>{cases.length}</small></h2>
          <div className="fidelity-filters" aria-label="Фильтры каталога">
            {FILTERS.map((item) => (
              <button className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)} type="button" key={item.value}>{item.label}</button>
            ))}
          </div>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Сортировка">
            <option value="default">По умолчанию</option>
            <option value="priceAsc">Сначала дешевле</option>
            <option value="priceDesc">Сначала дороже</option>
            <option value="name">По названию</option>
          </select>
        </div>

        {query && <div className="fidelity-query" role="status">Поиск: <strong>{query}</strong><button type="button" onClick={() => setSearchParams({})}>Сбросить</button></div>}
        {error && <div className="fidelity-catalog-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRequestId((value) => value + 1)}>Повторить</button></div>}

        <div className="fidelity-card-grid" aria-busy={loading}>
          {loading && Array.from({ length: 8 }, (_, index) => <div className="fidelity-card fidelity-card-skeleton" key={index}><div className="fidelity-card-art" /><div className="fidelity-card-info" /></div>)}
          {!loading && visibleCases.map((item) => (
            <article className="fidelity-card" key={item.id}>
              <Link className="fidelity-card-art" to={`/cases/${item.slug}`} aria-label={`Открыть страницу ${item.name}`}>
                <img src={caseArt(item)} alt={item.name} loading="lazy" />
                <span>{item.isActive ? "Доступен" : "Недоступен"}</span>
              </Link>
              <div className="fidelity-card-info">
                <div><h3>{item.name}</h3><strong>{formatMinor(item.priceMinor, item.currency)}</strong></div>
                <Link to={`/cases/${item.slug}`}>Открыть <span>→</span></Link>
              </div>
            </article>
          ))}
          {!loading && visibleCases.length === 0 && !error && <p className="fidelity-empty">Кейсы не найдены</p>}
        </div>
      </section>

      {featured && (
        <section className="fidelity-promo" aria-label={`Выбранный кейс: ${featured.name}`}>
          <img src={promoImage} alt="Коллекционное оружие" />
          <div><small>Выбор каталога</small><h2>{featured.name}</h2><p>{featured.items.length} предметов · {formatMinor(featured.priceMinor, featured.currency)}</p></div>
          <Link to={`/cases/${featured.slug}`}>Смотреть кейс <span>↗</span></Link>
        </section>
      )}
    </>
  );
}
