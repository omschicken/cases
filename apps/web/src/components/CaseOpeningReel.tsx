import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaseItem } from "../lib/types";
import { rarityColor } from "../lib/rarity";

const ITEM_WIDTH = 148;
const GAP = 12;
const ITEM_STEP = ITEM_WIDTH + GAP;
const REEL_LENGTH = 50;
const TARGET_INDEX = 44;
const SPIN_DURATION_MS = 6000;

/** Visual-only filler for the spinning reel — the real result already came
 * from the server before this component mounts. Sampling by the same
 * weights as the actual odds just makes the blur feel authentic. */
function weightedSample(items: CaseItem[]): CaseItem {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

interface CaseOpeningReelProps {
  poolItems: CaseItem[];
  winningItem: CaseItem;
  onFinished: () => void;
}

/**
 * Renders once per case-open (parent remounts it via a changing `key`).
 * The winning item is already fixed server-side — this just builds a
 * plausible-looking filler strip around it and animates the strip so the
 * indicator lands on that item.
 */
export function CaseOpeningReel({ poolItems, winningItem, onFinished }: CaseOpeningReelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const reel = useMemo(() => {
    const items: CaseItem[] = [];
    for (let i = 0; i < REEL_LENGTH; i++) {
      items.push(i === TARGET_INDEX ? winningItem : weightedSample(poolItems));
    }
    return items;
    // Built once for this mount — a fresh spin gets a fresh component via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    setTransform(0);
    // Measuring clientWidth is deferred to the first animation frame rather
    // than read synchronously here — on some mobile browsers the viewport's
    // layout isn't reliably settled yet at this exact point right after a
    // client-side route change, and a stale/zero width would fling the
    // track to a huge, blank offset instead of landing on the target item.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const viewportWidth = viewportRef.current?.clientWidth || 600;
        const jitter = (Math.random() - 0.5) * ITEM_WIDTH * 0.5;
        const targetCenter = TARGET_INDEX * ITEM_STEP + ITEM_WIDTH / 2 + jitter;
        const offset = targetCenter - viewportWidth / 2;

        setSpinning(true);
        setTransform(-offset);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="case-reel-wrap">
      <div className="case-reel-viewport" ref={viewportRef}>
        <div
          className="case-reel-track"
          style={{
            transform: `translateX(${transform}px)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.1, 0, 0.15, 1)`
              : "none",
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === "transform") onFinished();
          }}
        >
          {reel.map((item, i) => (
            <div
              className="reel-item"
              key={i}
              style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}
            >
              <img src={item.imageUrl} alt={item.name} />
              <span className="reel-item-name">{item.name}</span>
            </div>
          ))}
        </div>
        <div className="case-reel-indicator" />
      </div>
    </div>
  );
}
