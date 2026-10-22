import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { OriginalCollection } from "../components/OriginalCollection";
import { CASECROW_ORIGINALS_BY_SLUG } from "../lib/casecrowOriginals";
import heroImage from "../assets/casecrow-approved/hero-courtyard-v2.webp";
import mobileHero from "../assets/casecrow-approved/cases/webp/case_01.webp";
import { api, ApiError } from "../lib/api";
import { caseVersionLabel, resolveCaseArt } from "../lib/caseArt";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";

type SortMode = "default" | "priceAsc" | "priceDesc" | "name";
type PriceFilter = "all" | "entry" | "core" | "apex";

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

export function CaseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    if (window.location.hash !== "#catalog") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("catalog")?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [searchQuery]);
  const [cases, setCases] = useState<CaseDto[]>(() => api.peek<CaseDto[]>("/cases") ?? []);
  const [query, setQuery] = useState(searchQuery);
  const [filter, setFilter] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [loading, setLoading] = useState(() => !api.peek("/cases"));
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    setQuery(searchQuery);
    setFilter("all");
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    setLoading(!api.peek("/cases"));
    api.get<CaseDto[]>("/cases")
      .then((data) => {
        if (!active) return;
        setCases(data);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setCases([]);
        setError(
          caught instanceof ApiError && caught.status === 0
            ? "Каталог временно недоступен. Проверьте подключение и попробуйте ещё раз."
            : "Не удалось загрузить каталог. Попробуйте повторить запрос.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [requestId]);

  const visibleCases = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    const filtered = cases.filter((item) =>
      !CASECROW_ORIGINALS_BY_SLUG.has(item.slug) && belongsToFilter(item, filter) &&
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
    () => [...cases].filter((item) => item.canOpen !== false).sort((a, b) => Number(b.priceMinor) - Number(a.priceMinor))[0],
    [cases],
  );

  return (
    <>
      <section className="fidelity-hero" aria-labelledby="fidelity-title">
        <picture className="cc-hero-scene">
          <source media="(max-width:600px)" srcSet={mobileHero} />
          <img src={heroImage} alt="Кейс CaseCrow и коллекционный скин в светлом каменном дворике" fetchPriority="high" decoding="async" width="2172" height="724" />
        </picture>
        <div className="fidelity-hero-copy">
          <p>Коллекции&nbsp; / &nbsp;Counter-Strike 2</p>
          <h1 id="fidelity-title">Предметы<br />с <span>характером.</span></h1>
          <div className="fidelity-hero-bottom">
            <p>Открывай кейсы, собирай редкие скины<br />и формируй собственную коллекцию.</p>
            <a href="#catalog">Открыть кейсы <span>→</span></a>
          </div>
        </div>
      </section>

      <OriginalCollection cases={cases} loading={loading} search={query} />

      <section className="fidelity-catalog" id="catalog" aria-labelledby="catalog-title">
        <div className="fidelity-catalog-head">
          <h2 id="catalog-title">Коллекции <small>{loading || error ? "—" : cases.filter(item => !CASECROW_ORIGINALS_BY_SLUG.has(item.slug)).length}</small></h2>
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

        <label className="fidelity-catalog-search"><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти кейс или скин" aria-label="Поиск кейсов и скинов" /></label>
        {query && <div className="fidelity-query" role="status">Поиск: <strong>{query}</strong><button type="button" onClick={() => setSearchParams({})}>Сбросить</button></div>}
        {error && <div className="fidelity-catalog-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRequestId((value) => value + 1)}>Повторить</button></div>}

        <div className="fidelity-card-grid" aria-busy={loading}>
          {loading && Array.from({ length: 8 }, (_, index) => <div className="fidelity-card fidelity-card-skeleton" key={index}><div className="fidelity-card-art" /><div className="fidelity-card-info" /></div>)}
          {!loading && visibleCases.map((item) => {
            const version = caseVersionLabel(item.slug);
            return (
              <article className="fidelity-card" key={item.id}>
                <Link className="fidelity-card-art" to={`/cases/${item.slug}`} aria-label={`Открыть страницу ${item.name}`}>
                  <img src={resolveCaseArt(item.slug, item.imageUrl)} alt={item.name} loading="lazy" />
                  <span>{item.canOpen === false ? "Проверка цены" : item.isActive ? "Доступен" : "Недоступен"}</span>
                  {version ? <em className="fidelity-card-version">{version}</em> : null}
                </Link>
                <div className="fidelity-card-info">
                  <div><h3>{item.name}</h3><strong>{formatMinor(item.priceMinor, item.currency)}</strong></div>
                  <Link to={`/cases/${item.slug}`}>{item.canOpen === false ? "Подробнее" : "Открыть"} <span>→</span></Link>
                </div>
              </article>
            );
          })}
          {!loading && visibleCases.length === 0 && !error && (
            <p className="fidelity-empty">{cases.length === 0 ? "Активных кейсов пока нет" : "По вашему запросу кейсы не найдены"}</p>
          )}
        </div>
      </section>

      {featured && (
        <section className="fidelity-promo" aria-label={`Выбранный кейс: ${featured.name}`}>
          <img src={resolveCaseArt(featured.slug, featured.imageUrl)} alt={featured.name} />
          <div><small>Выбор каталога</small><h2>{featured.name}</h2><p>{featured.itemCount ?? featured.items.length} предметов · {formatMinor(featured.priceMinor, featured.currency)}</p></div>
          <Link to={`/cases/${featured.slug}`}>Смотреть кейс <span>↗</span></Link>
        </section>
      )}
    </>
  );
}
