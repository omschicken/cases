import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { rarityColor } from "../../lib/rarity";
import { CaseChest, caseVisualIdentity } from "../CaseChest";
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

/** Case card, 240x300. Top 60% the chest, bottom 40% name, price, action.
 *  Presentation only: no fetches, no state, so a 90-card grid is one render. */
export function CaseCard({ caseDto, index, tiers, tier, priceLabel }: CaseCardProps) {
  const { hue } = caseVisualIdentity(caseDto.slug);

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
          <CaseChest caseName={caseDto.name} caseSlug={caseDto.slug} className="dzc__chest-art" />
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
        <div className="dzc__row">
          <span className="dzc__price" aria-label={priceLabel}>
            <Money minor={caseDto.priceMinor} currency={caseDto.currency} />
          </span>
          <span className="dzc__open">Открыть</span>
        </div>
      </div>
    </Link>
  );
}

/** Loading placeholder: same box (no layout shift), shimmer instead of grey. */
export function CaseCardSkeleton() {
  return <div className="dzc dzc--skeleton dz-skeleton" aria-hidden="true" />;
}
