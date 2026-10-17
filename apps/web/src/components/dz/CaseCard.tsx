import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { rarityColor } from "../../lib/rarity";
import { CaseGlyph, caseVisualIdentity } from "../CaseChest";
import { Money } from "../Money";
import type { CaseDto, ItemRarity } from "../../lib/types";

interface CaseCardProps {
  caseDto: CaseDto;
  /** Catalog position — shown as the serial. */
  index: number;
  /** Rarity tiers present in this case, highest first. */
  tiers: ItemRarity[];
  /** Highest tier in the case. */
  chase: ItemRarity | null;
  tier?: "entry" | "core" | "apex";
  rarityLabel: string;
  priceLabel: string;
}

/** Lightweight case box art — designed specifically for the grid card.
 *  Does NOT use CaseChest (which is built for the detail/opening page).  */
function CaseMiniArt({ caseName, caseSlug }: { caseName: string; caseSlug: string }) {
  const { variant, hue } = caseVisualIdentity(caseSlug);
  const mark = caseName.replace(/\s*case$/i, "").slice(0, 3).toUpperCase();
  const label = caseName.replace(/\s*case$/i, "").toUpperCase();

  return (
    <div className="dzc-art" style={{ "--art-hue": hue } as CSSProperties} aria-hidden="true">
      {/* atmosphere glow */}
      <span className="dzc-art__glow" />

      {/* the case box */}
      <div className="dzc-art__box">
        {/* lid */}
        <div className="dzc-art__lid">
          <span className="dzc-art__lid-stripe" />
          <span className="dzc-art__lid-mark">{mark}</span>
        </div>

        {/* body */}
        <div className="dzc-art__body">
          {/* corner brackets */}
          <span className="dzc-art__corner dzc-art__corner--tl" />
          <span className="dzc-art__corner dzc-art__corner--tr" />
          <span className="dzc-art__corner dzc-art__corner--bl" />
          <span className="dzc-art__corner dzc-art__corner--br" />

          {/* centre glyph */}
          <div className="dzc-art__glyph-wrap">
            <span className="dzc-art__glyph-bg" />
            <CaseGlyph variant={variant} />
          </div>

          {/* name band */}
          <div className="dzc-art__band">
            <span className="dzc-art__band-line" />
            <span className="dzc-art__band-text">{label}</span>
            <span className="dzc-art__band-line" />
          </div>
        </div>

        {/* lock clasp */}
        <div className="dzc-art__lock">
          <span className="dzc-art__lock-body" />
          <span className="dzc-art__lock-gem" />
        </div>
      </div>
    </div>
  );
}

/** Case card, 240x300. Top 60% the chest, bottom 40% name, price, action.
 *  Presentation only: no fetches, no state, so a 90-card grid is one render. */
export function CaseCard({ caseDto, index, tiers, tier, priceLabel }: CaseCardProps) {
  const { hue } = caseVisualIdentity(caseDto.slug);
  // A real remote picture beats the generated art; generated data: SVGs don't count.
  const hasPicture = /^https?:\/\//.test(caseDto.imageUrl ?? "");

  return (
    <Link
      to={`/cases/${caseDto.slug}`}
      className="dzc"
      style={{ "--chest-hue": hue } as CSSProperties}
    >
      <div className="dzc__top">
        <span className="dzc__serial">DZ-{String(index + 1).padStart(3, "0")}</span>
        {tier && <span className="dzc__chip">{tier}</span>}
        <div className="dzc__chest">
          {hasPicture ? (
            <img className="dzc__img" src={caseDto.imageUrl} alt="" loading="lazy" />
          ) : (
            <CaseMiniArt caseName={caseDto.name} caseSlug={caseDto.slug} />
          )}
        </div>
      </div>

      <div className="dzc__body">
        <div className="dzc__meta">
          <h3 className="dzc__name">{caseDto.name}</h3>
          <span className="dzc__dots" aria-hidden="true">
            {tiers.map((t) => (
              <i key={t} style={{ background: rarityColor(t) }} />
            ))}
          </span>
        </div>
      </div>

      <div className="dzc__foot">
        <span className="dzc__price">
          <span className="dzc__price-label">{priceLabel}</span>
          <Money minor={caseDto.priceMinor} currency={caseDto.currency} />
        </span>
        <span className="dzc__open">Открыть</span>
      </div>
    </Link>
  );
}

/** Loading placeholder: same box (no layout shift), shimmer instead of grey. */
export function CaseCardSkeleton() {
  return <div className="dzc dzc--skeleton dz-skeleton" aria-hidden="true" />;
}
