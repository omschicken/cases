import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { CaseChest } from "../components/CaseChest";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { DropHero } from "../components/dz/DropHero";
import { PromoFirstDeposit } from "../components/PromoFirstDeposit";
import { StatsBar } from "../components/StatsBar";
import { RecentDrops } from "../components/RecentDrops";
import { highestRarity, RARITY_LABELS, RARITY_RANK } from "../lib/rarity";
import { CaseCard, CaseCardSkeleton } from "../components/dz/CaseCard";
import { PageHeader } from "../components/dz/PageHeader";
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


export function CaseListPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [sort, setSort] = useState<SortMode>("default");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
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

  // Groups follow the price: under 500 ₽ СТАРТ, 500–1 500 ₽ ИМПУЛЬС, above ПРЕДЕЛ.
  // A group nobody falls into is left out rather than shown empty.
  const collections = useMemo(() => {
    const byPrice = [...cases].sort((a, b) => Number(a.priceMinor) - Number(b.priceMinor));
    const groupOf = (priceMinor: string) => {
      const kopecks = Number(priceMinor);
      return kopecks < 50_000 ? "entry" : kopecks <= 150_000 ? "core" : "apex";
    };
    return COLLECTIONS.map((id) => {
      const members = byPrice.filter((c) => groupOf(c.priceMinor) === id);
      return { id, members, representative: members[Math.floor(members.length / 2)], minimum: members[0] };
    }).filter((group) => group.members.length > 0);
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
    <div className="black-archive-home">
      <PromoFirstDeposit />
      <DropHero
        caseCount={cases.length}
        showcase={[...cases]
          .filter((c) => /^https?:\/\//.test(c.imageUrl ?? ""))
          .sort((a, b) => Number(BigInt(b.priceMinor) - BigInt(a.priceMinor)))
          .slice(0, 3)
          .map((c) => ({ slug: c.slug, name: c.name, imageUrl: c.imageUrl }))}
      />
      <StatsBar />

      {cases.length > 0 && (
        <section className="collection-discovery" aria-labelledby="collection-discovery-heading">
          <div className="collection-discovery-head">
            <div>
              <span className="black-archive-kicker">ARCHIVE / SELECTED SERIES</span>
              <h2 id="collection-discovery-heading">{t("home.discoveryHeading")}</h2>
            </div>
            <p>{t("home.discoveryIntro")}</p>
          </div>
          <div className="collection-route-grid">
            {collections.map((group, index) => {
              const representative = group.representative;
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`collection-route collection-route-${group.id}${collection === group.id ? " is-active" : ""}`}
                  onClick={() => {
                    setCollection(group.id);
                    document.getElementById("collections")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  aria-pressed={collection === group.id}
                  disabled={!group.members.length}
                >
                  <span className="collection-route-index">0{index + 1} / 0{collections.length}</span>
                  {representative && (
                    <span className="collection-route-art">
                      <CaseChest caseName={representative.name} caseSlug={representative.slug} />
                    </span>
                  )}
                  <span className="collection-route-bottom">
                    <span>
                      <strong>{t(`home.collection.${group.id}.title`)}</strong>
                      <small>{t(`home.collection.${group.id}.subtitle`)}</small>
                    </span>
                    <span className="collection-route-meta">
                      {t("home.collectionCases")} <b>{group.members.length}</b>
                      <em>{group.minimum ? `${t("home.collectionFrom")} ${formatMinor(group.minimum.priceMinor, group.minimum.currency)}` : ""}</em>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Catalog toolbar ───────────────────────────────────────────────── */}
      <div id="collections">
        <div className="black-archive-catalog-head" aria-hidden="true">
          <span>BLACK ARCHIVE</span>
          <span>{String(filteredCases.length).padStart(2, "0")} OBJECTS</span>
        </div>
        <PageHeader
          kicker="DROPZONE / COLLECTIONS"
          title={t("home.casesHeading")}
          lede={t("home.casesIntro")}
        />

        <div className="dz-toolbar" style={{ marginTop: "var(--dz-s3)" }}>
          {/* Search */}
          <label className="dz-field dz-field--row" style={{ flex: "1 1 200px" }}>
            <span className="sr-only">{t("home.searchCases")}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7"/>
              <path d="m16 16 4.4 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("home.searchPlaceholder")}
              autoComplete="off"
            />
          </label>

          {/* Sort */}
          <label className="dz-field">
            <span>{t("home.sortLabel")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="default">{t("home.sortDefault")}</option>
              <option value="priceAsc">{t("home.sortPriceAsc")}</option>
              <option value="priceDesc">{t("home.sortPriceDesc")}</option>
            </select>
          </label>
        </div>

        {/* Collection filter chips */}
        {cases.length > 0 && (
          <div className="dz-chips" style={{ marginTop: "var(--dz-s3)" }} role="group" aria-label={t("home.collectionFilterLabel")}>
            <button
              type="button"
              className="dz-chip"
              aria-pressed={collection === "all"}
              onClick={() => setCollection("all")}
            >
              {t("home.collectionAll")}<b>{cases.length}</b>
            </button>
            {collections.map((group) => (
              <button
                type="button"
                key={group.id}
                className="dz-chip"
                aria-pressed={collection === group.id}
                onClick={() => setCollection(group.id)}
              >
                {t(`home.collection.${group.id}.title`)}<b>{group.members.length}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error notice */}
      {error && (
        <div role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--dz-s3)", marginTop: "var(--dz-s4)", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-edge-strong)", borderRadius: "var(--dz-r-sm)", background: "var(--dz-surface-1)" }}>
          <span style={{ color: "var(--dz-text-2)", fontSize: "var(--dz-type-xs)" }}>{error}</span>
          <button type="button" className="dz-btn" onClick={() => setRequestId((id) => id + 1)}>
            {t("common.retry", { defaultValue: "Повторить" })}
          </button>
        </div>
      )}

      {/* Case grid */}
      <div className="dz-case-grid" aria-busy={loading}>
        {loading && Array.from({ length: 10 }, (_, i) => <CaseCardSkeleton key={i} />)}
        {!loading && visibleCases.map((c, i) => {
          const tiers = rarityTiers(c) as ItemRarity[];
          const chase = highestRarity(tiers);
          return (
            <CaseCard
              key={c.id}
              caseDto={c}
              index={i}
              tiers={tiers}
              chase={chase}
              tier={caseToTier.get(c.id)}
              rarityLabel={chase
                ? t(`rarity.${chase}`, { defaultValue: RARITY_LABELS[chase] })
                : t("home.caseCollection", { defaultValue: "COLLECTION" })}
              priceLabel={t("caseCard.priceLabel", { defaultValue: "Открыть за" })}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {!loading && filteredCases.length === 0 && !error && (
        <div className="dz-empty" role="status">
          <span className="dz-empty__mark" aria-hidden="true">◎</span>
          <p className="dz-empty__title">
            {query ? t("home.noSearchResults", { query }) : t("home.noCasesYet")}
          </p>
        </div>
      )}

      {/* Load more */}
      {!loading && filteredCases.length > visibleCases.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--dz-s5)" }}>
          <button
            className="dz-btn"
            type="button"
            style={{ minWidth: "min(100%, 280px)" }}
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            {t("home.showMoreCases", { count: Math.min(PAGE_SIZE, filteredCases.length - visibleCases.length) })}
            <span aria-hidden="true" style={{ color: "var(--dz-amber)" }}>↓</span>
          </button>
        </div>
      )}

      <RecentDrops />
    </div>
  );
}
