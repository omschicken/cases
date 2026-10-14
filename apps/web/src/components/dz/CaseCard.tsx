import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { formatMinor } from "../../lib/money";
import { rarityColor } from "../../lib/rarity";
import type { CaseDto, ItemRarity } from "../../lib/types";

interface CaseCardProps {
  caseDto: CaseDto;
  /** Catalog position — shown as the specimen designation. */
  index: number;
  /** Rarity tiers present in this case, highest first. */
  tiers: ItemRarity[];
  /** Highest tier in the case; drives every light on the card. */
  chase: ItemRarity | null;
  /** Art for the cell — the case's headline item. */
  artUrl?: string;
  tier?: "entry" | "core" | "apex";
  rarityLabel: string;
  priceLabel: string;
}

/**
 * DROP SIGNATURE case card — a case presented as a specimen in its own cell.
 *
 * Pure presentation over data the caller already has. It triggers no fetches
 * and owns no state, so a 90-card grid stays one render.
 */
export function CaseCard({
  caseDto, index, tiers, chase, artUrl, tier, rarityLabel, priceLabel,
}: CaseCardProps) {
  const accent = chase ? rarityColor(chase) : undefined;

  return (
    <Link
      to={`/cases/${caseDto.slug}`}
      className="dz-case-card"
      style={accent ? ({ "--dz-rarity": accent } as CSSProperties) : undefined}
    >
      <div className="dz-case-card__plate">
        <span>DZ-{String(index + 1).padStart(3, "0")}</span>
        {tier && (
          <span className={`dz-case-card__tier dz-case-card__tier--${tier}`}>
            {tier}
          </span>
        )}
      </div>

      <div className="dz-case-card__cell">
        <div className="dz-case-card__object">
          {artUrl
            ? <img src={artUrl} alt="" loading="lazy" decoding="async" />
            : <CaseGlyph slug={caseDto.slug} />}
        </div>
        <span className="dz-case-card__fixture" aria-hidden="true" />
        <span className="dz-case-card__scan" aria-hidden="true" />
        <span className="dz-case-card__bracket dz-case-card__bracket--tl" aria-hidden="true" />
        <span className="dz-case-card__bracket dz-case-card__bracket--br" aria-hidden="true" />
      </div>

      <div className="dz-case-card__copy">
        <div className="dz-case-card__rarity">
          <span>{rarityLabel}</span>
          <span className="dz-case-card__dots" aria-hidden="true">
            {tiers.map((t, i) => (
              <span
                key={t}
                className="dz-case-card__dot"
                style={{
                  "--dz-dot": rarityColor(t),
                  "--dz-dot-i": tiers.length - 1 - i,
                } as CSSProperties}
              />
            ))}
          </span>
        </div>
        <h3 className="dz-case-card__name">{caseDto.name}</h3>
      </div>

      <div className="dz-case-card__foot">
        <span className="dz-case-card__price">
          <span>{priceLabel}</span>
          <strong>{formatMinor(caseDto.priceMinor, caseDto.currency)}</strong>
        </span>
        <span className="dz-case-card__action" aria-hidden="true">↗</span>
      </div>
    </Link>
  );
}

/** Fallback mark when a case has no usable item art, derived from the slug so
 *  a case always looks the same. Deliberately plain: a wrong-looking stand-in
 *  is worse than an honest one. */
function CaseGlyph({ slug }: { slug: string }) {
  const seed = [...slug].reduce((v, c) => ((v * 31) + c.charCodeAt(0)) >>> 0, 7);
  const rotation = seed % 4;
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ width: "58%", opacity: 0.5 }}>
      <rect
        x="10" y="18" width="44" height="30" rx="3"
        stroke="var(--dz-rarity)" strokeWidth="1.5"
        transform={`rotate(${rotation * 1.5} 32 33)`}
      />
      <path d="M10 28h44M24 18v30" stroke="var(--dz-rarity)" strokeWidth="1" opacity="0.5" />
      <circle cx="32" cy="38" r="4" stroke="var(--dz-rarity)" strokeWidth="1.5" />
    </svg>
  );
}

/** Placeholder card for the loading grid — identical box, so no CLS. */
export function CaseCardSkeleton() {
  return (
    <div className="dz-case-card dz-case-card--skeleton" aria-hidden="true">
      <div className="dz-case-card__plate"><span>DZ-•••</span></div>
      <div className="dz-case-card__cell" />
      <div className="dz-case-card__copy">
        <h3 className="dz-case-card__name" />
      </div>
    </div>
  );
}
