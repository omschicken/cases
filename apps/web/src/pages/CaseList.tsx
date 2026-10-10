import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { HeroBanner } from "../components/HeroBanner";
import { StatsBar } from "../components/StatsBar";
import { RecentDrops } from "../components/RecentDrops";
import { rarityColor, highestRarity, RARITY_RANK } from "../lib/rarity";
import type { CaseDto } from "../lib/types";

type SortMode = "default" | "priceAsc" | "priceDesc";

const FALLBACK_ART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1'%3E%3Cstop stop-color='%23151b2d'/%3E%3Cstop offset='1' stop-color='%23462a79'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='420' fill='url(%23g)'/%3E%3Cpath d='M80 300 220 100l140 200 90-120 110 120' fill='none' stroke='%23b86bff' stroke-width='10' opacity='.75'/%3E%3C/svg%3E";

const FALLBACK_CASES: CaseDto[] = [
  { id: "preview-ignition", slug: "ignition-case", name: "Ignition Case", priceMinor: "14900", currency: "RUB", imageUrl: FALLBACK_ART, isActive: true, items: [
    { id: "preview-usp", name: "USP-S | Printstream", imageUrl: FALLBACK_ART, weight: 55, valueMinor: "9900", currency: "RUB", rarity: "RESTRICTED" },
    { id: "preview-ak", name: "AK-47 | Slate", imageUrl: FALLBACK_ART, weight: 35, valueMinor: "19900", currency: "RUB", rarity: "CLASSIFIED" },
    { id: "preview-knife", name: "★ Нож | Aurora", imageUrl: FALLBACK_ART, weight: 10, valueMinor: "129900", currency: "RUB", rarity: "GOLD" },
  ] },
  { id: "preview-static", slug: "static-case", name: "Static Case", priceMinor: "29900", currency: "RUB", imageUrl: FALLBACK_ART, isActive: true, items: [
    { id: "preview-m4", name: "M4A1-S | Player Two", imageUrl: FALLBACK_ART, weight: 60, valueMinor: "24900", currency: "RUB", rarity: "RESTRICTED" },
    { id: "preview-awp", name: "AWP | Neo-Noir", imageUrl: FALLBACK_ART, weight: 30, valueMinor: "69900", currency: "RUB", rarity: "CLASSIFIED" },
    { id: "preview-gloves", name: "★ Перчатки | Fade", imageUrl: FALLBACK_ART, weight: 10, valueMinor: "249900", currency: "RUB", rarity: "GOLD" },
  ] },
  { id: "preview-overdrive", slug: "overdrive-case", name: "Overdrive Case", priceMinor: "59900", currency: "RUB", imageUrl: FALLBACK_ART, isActive: true, items: [
    { id: "preview-deagle", name: "Desert Eagle | Ocean Drive", imageUrl: FALLBACK_ART, weight: 65, valueMinor: "49900", currency: "RUB", rarity: "CLASSIFIED" },
    { id: "preview-bowie", name: "★ Bowie | Lore", imageUrl: FALLBACK_ART, weight: 25, valueMinor: "179900", currency: "RUB", rarity: "COVERT" },
    { id: "preview-karambit", name: "★ Karambit | Doppler", imageUrl: FALLBACK_ART, weight: 10, valueMinor: "499900", currency: "RUB", rarity: "GOLD" },
  ] },
];

/** Distinct rarity tiers present in a case, highest first — the at-a-glance
 * "what could I get" signal shown as a dot row on every case card. */
function rarityTiers(c: CaseDto): string[] {
  const present = new Set(c.items.map((i) => i.rarity));
  return RARITY_RANK.filter((tier) => present.has(tier));
}

export function CaseListPage() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [sort, setSort] = useState<SortMode>("default");

  useEffect(() => {
    setLoading(true);
    api
      .get<CaseDto[]>("/cases")
      .then((data) => {
        setCases(data);
        setUsingFallback(false);
      })
      .catch(() => {
        // Keep the catalog useful while the API is restarting; opening remains demo-only until login.
        setCases(FALLBACK_CASES);
        setUsingFallback(true);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, [t]);

  const sortedCases = useMemo(() => {
    if (sort === "default") return cases;
    const sorted = [...cases];
    sorted.sort((a, b) => {
      const diff = Number(a.priceMinor) - Number(b.priceMinor);
      return sort === "priceAsc" ? diff : -diff;
    });
    return sorted;
  }, [cases, sort]);

  return (
    <div>
      <HeroBanner />
      <StatsBar />

      {usingFallback && (
        <div className="catalog-notice" role="status">
          Каталог работает в демо-режиме: сервис предметов временно обновляется. Реальные открытия и списания сейчас недоступны.
        </div>
      )}

      <div id="collections" className="cases-toolbar">
        <div className="cases-heading-group"><span className="section-kicker">DROPZONE / COLLECTIONS</span><h1 className="section-heading cases-toolbar-heading">{t("home.casesHeading")}</h1><p className="section-intro">{t("home.casesIntro")}</p></div>
        <label className="sort-select-wrap">
          {t("home.sortLabel")}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="default">{t("home.sortDefault")}</option>
            <option value="priceAsc">{t("home.sortPriceAsc")}</option>
            <option value="priceDesc">{t("home.sortPriceDesc")}</option>
          </select>
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="case-grid" aria-busy={loading}>
        {loading && Array.from({ length: 5 }, (_, i) => (
          <div className="case-card case-card-skeleton" key={i} aria-hidden="true" />
        ))}
        {!loading && sortedCases.map((c, i) => {
          const tiers = rarityTiers(c);
          const chase = highestRarity(tiers as CaseDto["items"][number]["rarity"][]);
          return (
            <Link
              to={`/cases/${c.slug}`}
              key={c.id}
              className="case-card"
              style={{ "--index": i, "--rarity-color": chase ? rarityColor(chase) : undefined } as CSSProperties}
            >
              <img src={c.imageUrl} alt={c.name} />
              <h3>{c.name}</h3>
              <div className="case-rarity-dots">
                {tiers.map((tier) => (
                  <span
                    key={tier}
                    className="case-rarity-dot"
                    style={{ "--rarity-color": rarityColor(tier as CaseDto["items"][number]["rarity"]) } as CSSProperties}
                  />
                ))}
              </div>
              <p className="price">{formatMinor(c.priceMinor, c.currency)}</p>
            </Link>
          );
        })}
        {!loading && sortedCases.length === 0 && !error && <p>{t("home.noCasesYet")}</p>}
      </div>

      <RecentDrops />
    </div>
  );
}
