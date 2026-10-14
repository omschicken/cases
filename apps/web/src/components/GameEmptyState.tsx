import type { ReactNode } from "react";

type GameEmptyStateProps = {
  variant: "contracts" | "upgrade-source" | "upgrade-target" | "cards";
  label: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function GameEmptyState({ variant, label, title, description, action }: GameEmptyStateProps) {
  return <div className={`game-empty game-empty--${variant}`}>
    <div className="game-empty-copy">
      <span className="game-empty-label">{label}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="game-empty-action">{action}</div>}
    </div>
    <div className="game-empty-art" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
