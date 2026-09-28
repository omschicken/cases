import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaseItem } from "../lib/types";
import { isChaseRarity, rarityColor } from "../lib/rarity";

const ITEM_WIDTH = 148;
const GAP = 12;
const ITEM_STEP = ITEM_WIDTH + GAP;

// Two spin configs: the full theatrical reel for a first-time/occasional
// open, and a short one for grinders who just want the result. Distance
// scales down with duration so "quick" still reads as a scroll, not a jump-cut.
const FULL_SPIN = { length: 50, targetIndex: 44, durationMs: 6000 };
const QUICK_SPIN = { length: 14, targetIndex: 10, durationMs: 1100 };

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
  /** Short, low-ceremony spin for repeat openers — skips most of the reel. */
  quick?: boolean;
}

/**
 * Renders once per case-open (parent remounts it via a changing `key`).
 * The winning item is already fixed server-side — this just builds a
 * plausible-looking filler strip around it and animates the strip so the
 * indicator lands on that item.
 */
export function CaseOpeningReel({ poolItems, winningItem, onFinished, quick = false }: CaseOpeningReelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const { length: REEL_LENGTH, targetIndex: TARGET_INDEX, durationMs: SPIN_DURATION_MS } = quick
    ? QUICK_SPIN
    : FULL_SPIN;

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
    setLanded(false);
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
  }, [quick]);

  const chase = isChaseRarity(winningItem.rarity);

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
            if (e.propertyName === "transform") {
              setLanded(true);
              onFinished();
            }
          }}
        >
          {reel.map((item, i) => (
            <div
              className={`reel-item ${landed && chase && i === TARGET_INDEX ? "reel-item-chase-landed" : ""}`}
              key={i}
              style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}
            >
              <img src={item.imageUrl} alt={item.name} />
              <span className="reel-item-name">{item.name}</span>
            </div>
          ))}
        </div>
        <div className="case-reel-indicator" />
        {/* Reserved for the top rarity tiers only — a burst on every open
            would dull it, so this only fires for Classified and above.
            Echoes CS2's own crate-unlock beat: a screen flash plus a ray burst. */}
        {landed && chase && (
          <>
            <div className="reel-flash" style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties} />
            <div className="reel-burst" style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties} />
          </>
        )}
      </div>
    </div>
  );
}
