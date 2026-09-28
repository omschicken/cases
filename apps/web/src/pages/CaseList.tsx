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

/** Distinct rarity tiers present in a case, highest first — the at-a-glance
 * "what could I get" signal shown as a dot row on every case card. */
function rarityTiers(c: CaseDto): string[] {
  const present = new Set(c.items.map((i) => i.rarity));
  return RARITY_RANK.filter((tier) => present.has(tier));
}

export function CaseListPage() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("default");

  useEffect(() => {
    api
      .get<CaseDto[]>("/cases")
      .then(setCases)
      .catch(() => setError(t("home.couldNotLoadCases")));
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

      <div className="cases-toolbar">
        <h1 className="section-heading cases-toolbar-heading">{t("home.casesHeading")}</h1>
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
      <div className="case-grid">
        {sortedCases.map((c, i) => {
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
        {sortedCases.length === 0 && !error && <p>{t("home.noCasesYet")}</p>}
      </div>

      <RecentDrops />
    </div>
  );
}
