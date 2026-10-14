import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMinor } from "../../lib/money";
import { RARITY_RANK, rarityColor } from "../../lib/rarity";
import type { CaseDto } from "../../lib/types";
import { DropChamber } from "./DropChamber";

interface DropHeroProps {
  featuredCase?: CaseDto;
  catalogStatus?: "loading" | "empty" | "error";
}

/**
 * DROP HERO — the featured case suspended in THE DROP CHAMBER.
 *
 * Replaces the rotating carousel with a single focused object. Reuses the
 * existing home.hero.* translation keys so no locale needs re-translating.
 */
export function DropHero({ featuredCase, catalogStatus = "loading" }: DropHeroProps) {
  const { t } = useTranslation();

  const featuredItem = featuredCase?.items.reduce<CaseDto["items"][number] | undefined>(
    (best, item) => {
      if (!best) return item;
      const diff = RARITY_RANK.indexOf(item.rarity) - RARITY_RANK.indexOf(best.rarity);
      return diff < 0 || (diff === 0 && BigInt(item.valueMinor) > BigInt(best.valueMinor))
        ? item
        : best;
    },
    undefined,
  );

  // Offline-preview cases ship inline data: placeholders; showing one would
  // present a stand-in as real artwork.
  const artUrl = featuredItem && !featuredItem.imageUrl.startsWith("data:image")
    ? featuredItem.imageUrl
    : undefined;

  const accent = featuredItem ? rarityColor(featuredItem.rarity) : undefined;
  const unavailable = catalogStatus === "error";

  return (
    <section className="dz-hero" aria-labelledby="dz-hero-title">
      <div className="dz-hero__copy">
        <span className="dz-hero__eyebrow">{t("home.hero.slide1.eyebrow")}</span>
        <h1 id="dz-hero-title" className="dz-hero__title">
          {t("home.hero.slide1.title")}
        </h1>
        <p className="dz-hero__lede">{t("home.hero.slide1.subtitle")}</p>
        <div className="dz-hero__actions">
          <Link to="/#collections" className="dz-hero__cta">
            {t("home.hero.slide1.cta")}
            <span aria-hidden="true">↗</span>
          </Link>
          <span className="dz-hero__proof">{t("home.hero.fairness")}</span>
        </div>
      </div>

      <div className="dz-hero__stage">
        <DropChamber
          className="dz-hero__chamber"
          state={featuredCase ? "armed" : "idle"}
          rarityColor={accent}
          depth={210}
          hudLeft={featuredCase ? "DZ / 001" : unavailable ? "API / WAIT" : "DZ / 000"}
          hudRight="CS / 2"
          status={featuredCase ? t("home.hero.featured") : undefined}
        >
          <div className="dz-hero__art">
            {artUrl
              ? <img src={artUrl} alt={featuredItem?.name ?? ""} />
              : <ChamberEmptyMark />}
          </div>
        </DropChamber>

        <div className="dz-hero__readout">
          <span>
            <span className="dz-hero__readout-label">
              {featuredItem ? t("home.hero.topDrop") : t("home.casesHeading")}
            </span>
            <span className="dz-hero__readout-name">
              {featuredItem?.name
                ?? (unavailable
                  ? t("home.hero.loadingArt")
                  : catalogStatus === "empty"
                    ? t("home.noCasesYet")
                    : t("common.loading"))}
            </span>
          </span>
          {featuredItem && (
            <span className="dz-hero__readout-value">
              {formatMinor(featuredItem.valueMinor, featuredItem.currency)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/** Shown when the chamber has nothing in it — loading, empty, or offline.
 *  An empty lit cell is an honest state, so it needs no fake case. */
function ChamberEmptyMark() {
  return (
    <svg viewBox="0 0 120 90" fill="none" aria-hidden="true" style={{ width: "62%", opacity: 0.32 }}>
      <rect x="20" y="26" width="80" height="44" rx="3" stroke="var(--dz-text-4)" strokeWidth="1.5" strokeDasharray="5 4" />
      <path d="M20 40h80" stroke="var(--dz-text-4)" strokeWidth="1" opacity="0.6" />
      <circle cx="60" cy="55" r="6" stroke="var(--dz-text-4)" strokeWidth="1.5" />
    </svg>
  );
}
