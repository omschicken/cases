import type { CSSProperties, ReactNode } from "react";
import { rarityColor } from "../../lib/rarity";
import type { ItemRarity } from "../../lib/types";

interface ItemCardProps {
  name: string;
  imageUrl: string;
  rarity: ItemRarity;
  rarityLabel: string;
  /** Formatted price or range — already localised by the caller. */
  value: string;
  /** Top-right badge: a drop chance, a count, anything short. */
  badge?: string;
  /** Secondary line under the value (acquired date, wear, etc). */
  meta?: string;
  /** Wear conditions, shown as short codes. */
  wear?: string[];
  /** Buttons or links for this surface. */
  actions?: ReactNode;
}

/**
 * The item card used by the inventory, a case's drop table, contracts and
 * upgrades. Presentation only — every surface keeps its own behaviour and
 * passes it in through `actions`.
 */
export function ItemCard({
  name, imageUrl, rarity, rarityLabel, value, badge, meta, wear, actions,
}: ItemCardProps) {
  return (
    <article
      className="dz-item-card"
      style={{ "--dz-rarity": rarityColor(rarity) } as CSSProperties}
    >
      <div className="dz-item-card__cell">
        <img src={imageUrl} alt={name} loading="lazy" decoding="async" />
        {badge && <span className="dz-item-card__badge">{badge}</span>}
      </div>
      <div className="dz-item-card__body">
        <span className="dz-item-card__rarity">{rarityLabel}</span>
        <h3 className="dz-item-card__name">{name}</h3>
        <p className="dz-item-card__value">{value}</p>
        {wear && wear.length > 0 && (
          <span className="dz-item-card__wear">
            {wear.map((w, i) => <span key={`${w}-${i}`}>{w}</span>)}
          </span>
        )}
        {meta && <span className="dz-item-card__meta">{meta}</span>}
      </div>
      {actions && <div className="dz-item-card__actions">{actions}</div>}
    </article>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="dz-item-card dz-item-card--skeleton" aria-hidden="true">
      <div className="dz-item-card__cell" />
      <div className="dz-item-card__body">
        <h3 className="dz-item-card__name" />
      </div>
    </div>
  );
}
