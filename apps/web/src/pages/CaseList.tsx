import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CaseChest, caseVisualIdentity } from "../components/CaseChest";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { DropHero } from "../components/dz/DropHero";
import { StatsBar } from "../components/StatsBar";
import { RecentDrops } from "../components/RecentDrops";
import { highestRarity, RARITY_LABELS, RARITY_RANK } from "../lib/rarity";
import { CaseCard, CaseCardSkeleton } from "../components/dz/CaseCard";
import type { CaseDto, ItemRarity } from "../lib/types";

type SortMode = "default" | "priceAsc" | "priceDesc";
type CollectionMode = "all" | "entry" | "core" | "apex";
const COLLECTIONS = ["entry", "core", "apex"] as const;
const PAGE_SIZE = 16;

/** Distinct rarity tiers present in a case, highest first — the at-a-glance
 * "what could I get" signal shown as a dot row on every case card. */
function rarityTiers(c: CaseDto): string[] {
  const present = new Set(c.items.map((i) => i.rarity));
  return RARITY_RANK.filter((tier) => present.has(tier));
}

function featuredItem(c: CaseDto): CaseDto["items"][number] | undefined {
  return c.items.reduce<CaseDto["items"][number] | undefined>((best, item) => {
    if (!best) return item;
    const rarityDiff = RARITY_RANK.indexOf(item.rarity) - RARITY_RANK.indexOf(best.rarity);
    return rarityDiff < 0 || (rarityDiff === 0 && BigInt(item.valueMinor) > BigInt(best.valueMinor)) ? item : best;
  }, undefined);
}

export function CaseListPage() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [sort, setSort] = useState<SortMode>("default");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<CollectionMode>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => setVisibleCount(PAGE_SIZE), [query, collection]);

  useEffect(() => {
    setLoading(true);
    api
      .get<CaseDto[]>("/cases")
      .then((data) => {
        setCases(data);
        setError(null);
      })
      .catch(() => {
        setCases([]);
        setError(t("home.couldNotLoadCases"));
      })
      .finally(() => setLoading(false));
  }, [t, requestId]);

  const sortedCases = useMemo(() => {
    if (sort === "default") return cases;
    const sorted = [...cases];
    sorted.sort((a, b) => {
      const diff = Number(a.priceMinor) - Number(b.priceMinor);
      return sort === "priceAsc" ? diff : -diff;
    });
    return sorted;
  }, [cases, sort]);

  const collections = useMemo(() => {
    const byPrice = [...cases].sort((a, b) => Number(a.priceMinor) - Number(b.priceMinor));
    return COLLECTIONS.map((id, index) => {
      const start = Math.floor((index * byPrice.length) / 3);
      const end = Math.floor(((index + 1) * byPrice.length) / 3);
      const members = byPrice.slice(start, end);
      return { id, members, representative: members[Math.floor(members.length / 2)], minimum: members[0] };
    });
  }, [cases]);

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const selectedIds = collection === "all" ? null : new Set(collections.find((group) => group.id === collection)?.members.map((item) => item.id));
    return sortedCases.filter((item) =>
      (!selectedIds || selectedIds.has(item.id)) &&
      (!normalizedQuery || `${item.name} ${item.slug} ${item.items.map((caseItem) => caseItem.name).join(" ")}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)),
    );
  }, [collection, collections, query, sortedCases]);
  const visibleCases = filteredCases.slice(0, visibleCount);

  const caseToTier = useMemo(() => {
    const map = new Map<string, "entry" | "core" | "apex">();
    for (const group of collections) {
      for (const c of group.members) map.set(c.id, group.id as "entry" | "core" | "apex");
    }
    return map;
  }, [collections]);

  return (
    <div className="case-list-page">
      <DropHero featuredCase={cases[0]} catalogStatus={loading ? "loading" : error ? "error" : "empty"} />
      <StatsBar />

      {cases.length > 0 && <section className="collection-discovery" aria-labelledby="collection-discovery-heading">
        <div className="collection-discovery-head">
          <div>
            <span className="section-kicker">DROPZONE / SELECT YOUR ROUTE</span>
            <h2 id="collection-discovery-heading">{t("home.discoveryHeading")}</h2>
          </div>
          <p>{t("home.discoveryIntro")}</p>
        </div>
        <div className="collection-route-grid">
          {collections.map((group, index) => {
            const representative = group.representative;
            const highlight = representative && featuredItem(representative);
            return (
              <button
                key={group.id}
                type="button"
                className={`collection-route collection-route-${group.id}${collection === group.id ? " is-active" : ""}`}
                onClick={() => { setCollection(group.id); document.getElementById("collections")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                aria-pressed={collection === group.id}
                disabled={!group.members.length}
              >
                <span className="collection-route-index">0{index + 1} / 0{COLLECTIONS.length}</span>
                {representative && <span className="collection-route-art"><CaseChest caseName={representative.name} caseSlug={representative.slug} itemImageUrl={highlight?.imageUrl} /></span>}
                <span className="collection-route-bottom">
                  <span><strong>{t(`home.collection.${group.id}.title`)}</strong><small>{t(`home.collection.${group.id}.subtitle`)}</small></span>
                  <span className="collection-route-meta">{t("home.collectionCases")} <b>{group.members.length}</b><em>{group.minimum ? `${t("home.collectionFrom")} ${formatMinor(group.minimum.priceMinor, group.minimum.currency)}` : ""}</em></span>
                </span>
              </button>
            );
          })}
        </div>
      </section>}

      <div id="collections" className="cases-toolbar">
        <div className="cases-heading-group"><span className="section-kicker">DROPZONE / COLLECTIONS</span><h1 className="section-heading cases-toolbar-heading">{t("home.casesHeading")}</h1><p className="section-intro">{t("home.casesIntro")}</p></div>
        <div className="cases-controls">
          <label className="case-search-wrap">
            <span className="sr-only">{t("home.searchCases")}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7"/><path d="m16 16 4.4 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("home.searchPlaceholder")}
              autoComplete="off"
            />
          </label>
          <label className="sort-select-wrap">
            <span>{t("home.sortLabel")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="default">{t("home.sortDefault")}</option>
              <option value="priceAsc">{t("home.sortPriceAsc")}</option>
              <option value="priceDesc">{t("home.sortPriceDesc")}</option>
            </select>
          </label>
        </div>
      </div>

      {cases.length > 0 && <div className="collection-filters" role="group" aria-label={t("home.collectionFilterLabel")}>
        <button type="button" className={collection === "all" ? "is-active" : ""} aria-pressed={collection === "all"} onClick={() => setCollection("all")}>{t("home.collectionAll")}<span>{cases.length}</span></button>
        {collections.map((group) => <button type="button" key={group.id} className={collection === group.id ? "is-active" : ""} aria-pressed={collection === group.id} onClick={() => setCollection(group.id)}>{t(`home.collection.${group.id}.title`)}<span>{group.members.length}</span></button>)}
      </div>}

      {error && (
        <div className="catalog-notice" role="alert">
          <span>{error}</span>
          <button type="button" className="catalog-retry" onClick={() => setRequestId((id) => id + 1)}>
            {t("common.retry", { defaultValue: "Повторить" })}
          </button>
        </div>
      )}
      <div className="dz-case-grid" aria-busy={loading}>
        {loading && Array.from({ length: 10 }, (_, i) => <CaseCardSkeleton key={i} />)}
        {!loading && visibleCases.map((c, i) => {
          const tiers = rarityTiers(c) as ItemRarity[];
          const chase = highestRarity(tiers);
          const highlight = featuredItem(c);
          // Only real artwork reaches the cell. The inline data: placeholders
          // used by offline preview cases would read as a broken image.
          const artUrl = highlight && !highlight.imageUrl.startsWith("data:image")
            ? highlight.imageUrl
            : undefined;
          return (
            <CaseCard
              key={c.id}
              caseDto={c}
              index={i}
              tiers={tiers}
              chase={chase}
              artUrl={artUrl}
              tier={caseToTier.get(c.id)}
              rarityLabel={chase
                ? t(`rarity.${chase}`, { defaultValue: RARITY_LABELS[chase] })
                : t("home.caseCollection", { defaultValue: "COLLECTION" })}
              priceLabel={t("home.casePriceFrom", { defaultValue: "CASE PRICE" })}
            />
          );
        })}
      </div>
      {!loading && filteredCases.length === 0 && !error && (
        <p className="case-grid-empty" role="status">
          {query ? t("home.noSearchResults", { query }) : t("home.noCasesYet")}
        </p>
      )}

      {!loading && filteredCases.length > visibleCases.length && (
        <button className="case-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
          {t("home.showMoreCases", { count: Math.min(PAGE_SIZE, filteredCases.length - visibleCases.length) })}
          <span aria-hidden="true">↓</span>
        </button>
      )}

      <RecentDrops />
    </div>
  );
}
