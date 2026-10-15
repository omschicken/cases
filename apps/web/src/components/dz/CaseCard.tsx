import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { formatMinor } from "../../lib/money";
import { rarityColor } from "../../lib/rarity";
import { CaseChest } from "../CaseChest";
import type { CaseDto, ItemRarity } from "../../lib/types";

interface CaseCardProps {
  caseDto: CaseDto;
  /** Catalog position — shown as the specimen designation. */
  index: number;
  /** Rarity tiers present in this case, highest first. */
  tiers: ItemRarity[];
  /** Highest tier in the case; drives every light on the card. */
  chase: ItemRarity | null;
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
  caseDto, index, tiers, chase, tier, rarityLabel, priceLabel,
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
          <CaseChest caseName={caseDto.name} caseSlug={caseDto.slug} className="dz-case-card__chest" />
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
