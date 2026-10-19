import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { rarityColor } from "../../lib/rarity";
import type { ItemRarity } from "../../lib/types";
import { EditorialItemImage } from "../editorial/EditorialItemImage";

interface SelectableItemProps {
  name: string;
  imageUrl?: string;
  value: string;
  rarity?: ItemRarity;
  rarityLabel?: string;
  /** Short line above the name — a drop count, a case size. */
  note?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** Accessible description of what picking this does. */
  label?: string;
}

/**
 * A pickable tile, shared by Contracts (multi-select), Upgrade (source and
 * target) and Battles (case choice).
 *
 * A real button with aria-pressed, so selection is announced and keyboard
 * reachable. Selection is carried by the tick, the border weight and the lift
 * together — never by colour alone, which a rarity-tinted border would be.
 */
export function SelectableItem({
  name, imageUrl, value, rarity, rarityLabel, note,
  selected, disabled = false, onSelect, label,
}: SelectableItemProps) {
  return (
    <button
      type="button"
      className={`dz-pick${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      style={rarity ? ({ "--dz-rarity": rarityColor(rarity) } as CSSProperties) : undefined}
    >
      <span className="dz-pick__tick" aria-hidden="true">✓</span>
      {note && <span className="dz-pick__rarity">{note}</span>}
      <EditorialItemImage className="dz-pick__art" name={name} imageUrl={imageUrl} decorative />
      {rarityLabel && <span className="dz-pick__rarity">{rarityLabel}</span>}
      <span className="dz-pick__name">{name}</span>
      <span className="dz-pick__value">{value}</span>
    </button>
  );
}

interface GateProps {
  kicker: string;
  title: string;
  body: string;
  action: ReactNode;
}

/** Shown where a game needs an account — a considered screen, not a redirect. */
export function Gate({ kicker, title, body, action }: GateProps) {
  return (
    <div className="dz-gate">
      <span className="dz-gate__kicker">{kicker}</span>
      <h1 className="dz-gate__title">{title}</h1>
      <p className="dz-gate__body">{body}</p>
      {action}
    </div>
  );
}

/** Numbered step label — the spine of a multi-step game screen. */
export function Step({ label, count }: { label: string; count?: ReactNode }) {
  return (
    <div className="dz-step">
      <span>{label}</span>
      {count !== undefined && <span className="dz-step__count">{count}</span>}
    </div>
  );
}

/** A result banner. Win and loss share one layout; only colour and wording
 *  differ, because both are the same server roll. */
export function Outcome({
  won, label, name, meta, imageUrl, action,
}: {
  won: boolean;
  label: string;
  name: string;
  meta?: string;
  imageUrl?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`dz-outcome dz-outcome--${won ? "won" : "lost"}`} role="status" aria-live="polite">
      <EditorialItemImage className="dz-outcome__art" name={name} imageUrl={imageUrl} decorative loading="eager" />
      <div>
        <span className="dz-outcome__label">{label}</span>
        <h2 className="dz-outcome__name">{name}</h2>
        {meta && <span className="dz-outcome__meta">{meta}</span>}
      </div>
      {action}
    </section>
  );
}

/** Convenience link styled as the commit action, for outcome banners. */
export function OutcomeLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="dz-btn">{children}</Link>;
}
