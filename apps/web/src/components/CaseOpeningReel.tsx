import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaseItem } from "../lib/types";
import { isChaseRarity, rarityColor } from "../lib/rarity";

const FULL_SPIN  = { length: 56, targetIndex: 48, durationMs: 6500 };
const QUICK_SPIN = { length: 18, targetIndex: 14, durationMs: 1200 };

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
  quick?: boolean;
}

export function CaseOpeningReel({
  poolItems, winningItem, onFinished, quick = false,
}: CaseOpeningReelProps) {
  const viewportRef  = useRef<HTMLDivElement>(null);
  const targetRef    = useRef<HTMLDivElement>(null);
  const finishedRef  = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const [transform, setTransform]     = useState(0);
  const [spinning,  setSpinning]      = useState(false);
  const [landed,    setLanded]        = useState(false);
  // brief "about to land" state for pre-land glow
  const [nearEnd,   setNearEnd]       = useState(false);

  const { length: REEL_LENGTH, targetIndex: TARGET_INDEX, durationMs: SPIN_DURATION_MS } =
    quick ? QUICK_SPIN : FULL_SPIN;

  const reel = useMemo(() => {
    const items: CaseItem[] = [];
    for (let i = 0; i < REEL_LENGTH; i++)
      items.push(i === TARGET_INDEX ? winningItem : weightedSample(poolItems));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  onFinishedRef.current = onFinished;

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLanded(true);
    onFinishedRef.current();
  }

  useLayoutEffect(() => {
    finishedRef.current = false;
    setTransform(0);
    setLanded(false);
    setNearEnd(false);

    let raf2 = 0, nearEndTimer = 0, finishTimer = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const viewportWidth = viewportRef.current?.clientWidth ?? 0;
        const target        = targetRef.current;
        if (!viewportWidth || !target) return;

        const offset = target.offsetLeft + target.offsetWidth / 2 - viewportWidth / 2;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (reducedMotion) { setTransform(-offset); setSpinning(false); requestAnimationFrame(finish); return; }
        setTransform(-offset);

        setSpinning(true);
        // Trigger pre-land glow ~600 ms before the end
        nearEndTimer  = window.setTimeout(() => setNearEnd(true),  SPIN_DURATION_MS - 600);
        finishTimer   = window.setTimeout(finish, SPIN_DURATION_MS + 260);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(nearEndTimer);
      window.clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chase = isChaseRarity(winningItem.rarity);

  return (
    <div
      className={[
        "case-reel-wrap",
        spinning  ? "case-reel-spinning"  : "",
        landed    ? "case-reel-landed"    : "",
        nearEnd   ? "case-reel-near-end"  : "",
        chase     ? "case-reel-chase"     : "",
      ].join(" ")}
      style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties}
      aria-label={landed ? "Результат открытия" : "Открытие кейса"}
    >
      {/* Pre-reveal screen pulse layer */}
      {nearEnd && !landed && (
        <div className="reel-pre-flash" style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties} />
      )}

      <div className="case-reel-viewport" ref={viewportRef}>
        <div
          className="case-reel-track"
          style={{
            transform: `translateX(${transform}px)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.05, 0, 0.12, 1)`
              : "none",
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === "transform" && e.target === e.currentTarget) finish();
          }}
        >
          {reel.map((item, i) => (
            <div
              className={[
                "reel-item",
                landed && i === TARGET_INDEX             ? "reel-item-landed"       : "",
                landed && chase && i === TARGET_INDEX   ? "reel-item-chase-landed"  : "",
              ].join(" ")}
              key={i}
              ref={i === TARGET_INDEX ? targetRef : undefined}
              style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}
            >
              <div className="reel-item-inner">
                <img src={item.imageUrl} alt={item.name} />
                <span className="reel-item-name">{item.name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Center indicator */}
        <div className="case-reel-indicator" aria-hidden="true">
          <span className="reel-indicator-line" />
          <span className="reel-indicator-top"  />
          <span className="reel-indicator-bot"  />
          {landed && <span className="reel-indicator-pulse" style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties} />}
        </div>

        {/* Edge fades */}
        <div className="reel-fade-left"  aria-hidden="true" />
        <div className="reel-fade-right" aria-hidden="true" />
      </div>

      {/* Post-land effects — shown for ALL rarities, intensity scales via CSS */}
      {landed && (
        <>
          <div className={`reel-flash${chase ? " reel-flash-chase" : ""}`} style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties} />
          <div className="reel-burst" style={{ "--rarity-color": rarityColor(winningItem.rarity) } as CSSProperties} />
          <div className="reel-particles" aria-hidden="true">
            {Array.from({ length: chase ? 20 : 8 }, (_, i) => (
              <span
                key={i}
                className="reel-particle"
                style={{
                  "--p-i":     i,
                  "--p-angle": `${(i / (chase ? 20 : 8)) * 360}deg`,
                  "--p-dist":  `${(chase ? 60 : 30) + Math.random() * (chase ? 80 : 40)}px`,
                  "--rarity-color": rarityColor(winningItem.rarity),
                } as CSSProperties}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
