import type { ReactNode } from "react";

type GameEmptyStateProps = {
  variant: "contracts" | "upgrade-source" | "upgrade-target" | "cards";
  label: string;
  title: string;
  description: string;
  action?: ReactNode;
};

/** A mark per variant, so an empty panel still says which panel it is. */
const MARKS: Record<GameEmptyStateProps["variant"], string> = {
  contracts: "◫",
  "upgrade-source": "◇",
  "upgrade-target": "◈",
  cards: "▣",
};

/**
 * Empty state for the game surfaces. Built on the shared dz-empty so an empty
 * Contracts panel, an empty Upgrade target and an empty archive all read as
 * the same product; each kept its own markup and spacing before.
 */
export function GameEmptyState({ variant, label, title, description, action }: GameEmptyStateProps) {
  return (
    <div className="dz-empty">
      <span className="dz-empty__mark" aria-hidden="true">{MARKS[variant]}</span>
      <span className="dz-kicker">{label}</span>
      <h2 className="dz-empty__title">{title}</h2>
      <p className="dz-empty__body">{description}</p>
      {action}
    </div>
  );
}
