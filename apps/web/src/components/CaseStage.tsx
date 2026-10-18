import type { CSSProperties } from "react";
import { rarityColor } from "../lib/rarity";
import { RARITY_LABELS } from "../lib/rarity";
import type { ItemRarity } from "../lib/types";
import { CaseMiniArt } from "./dz/CaseCard";
import { caseVisualIdentity } from "./CaseChest";

interface CaseStageProps {
  caseName: string;
  caseSlug?: string;
  caseImageUrl: string;
  /** The rarest item in the case, teased in the corner. */
  chase?: { name: string; imageUrl: string; rarity: ItemRarity };
  /** Hidden (not unmounted) while the fullscreen opening overlay is live. */
  hidden?: boolean;
}

/** True when the URL is an inline data URL or a placeholder — use CSS art instead. */
function isPlaceholder(url: string): boolean {
  return url.startsWith("data:") || /placehold(er)?\.co/i.test(url);
}

/** Case detail visual: the case picture floating over a rarity-coloured glow. */
export function CaseStage({ caseName, caseSlug, caseImageUrl, chase, hidden = false }: CaseStageProps) {
  const color = rarityColor(chase?.rarity ?? "MIL_SPEC");
  const showWeapon = chase && chase.imageUrl !== caseImageUrl;
  const slug = caseSlug ?? caseName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const useCssArt = isPlaceholder(caseImageUrl);
  const { hue } = caseVisualIdentity(slug);

  return (
    <div
      className="case-stage"
      style={{ "--stage-rarity": color, "--chest-hue": hue, ...(hidden ? { visibility: "hidden" } : {}) } as CSSProperties}
    >
      <span className="case-stage__glow" aria-hidden="true" />
      {useCssArt ? (
        <div className="case-stage__css-art">
          <CaseMiniArt caseName={caseName} caseSlug={slug} />
        </div>
      ) : (
        <img className="case-stage__case" src={caseImageUrl} alt={caseName} />
      )}
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
