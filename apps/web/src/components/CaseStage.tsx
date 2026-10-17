import type { CSSProperties } from "react";
import { rarityColor } from "../lib/rarity";
import { RARITY_LABELS } from "../lib/rarity";
import type { ItemRarity } from "../lib/types";

interface CaseStageProps {
  caseName: string;
  caseImageUrl: string;
  /** The rarest item in the case, teased in the corner. */
  chase?: { name: string; imageUrl: string; rarity: ItemRarity };
  /** Hidden (not unmounted) while the fullscreen opening overlay is live. */
  hidden?: boolean;
}

/** Case detail visual: the case picture floating over a rarity-coloured glow. */
export function CaseStage({ caseName, caseImageUrl, chase, hidden = false }: CaseStageProps) {
  const color = rarityColor(chase?.rarity ?? "MIL_SPEC");
  const showWeapon = chase && chase.imageUrl !== caseImageUrl;

  return (
    <div
      className="case-stage"
      style={{ "--stage-rarity": color, ...(hidden ? { visibility: "hidden" } : {}) } as CSSProperties}
    >
      <span className="case-stage__glow" aria-hidden="true" />
      <img className="case-stage__case" src={caseImageUrl} alt={caseName} />
      {showWeapon && chase && (
        <figure className="case-stage__weapon">
          <img src={chase.imageUrl} alt="" />
          <figcaption>
            <i aria-hidden="true" />
            {RARITY_LABELS[chase.rarity]} · {chase.name}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
