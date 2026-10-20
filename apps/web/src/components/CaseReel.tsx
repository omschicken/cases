import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseItem } from "../lib/types";
import { EditorialItemImage } from "./editorial/EditorialItemImage";
import { REEL_MS, RESULT_HOLD_MS, reelProgress } from "../lib/reelMotion";

const STRIP_LENGTH = 44;
const WIN_INDEX = 35;
const START_INDEX = 4;

function shortName(name: string) {
  const [weapon, ...rest] = name.replace(/ \([^)]*\)$/, "").replace(/^★ /, "").split(" | ");
  return { weapon, finish: rest.join(" | ") };
}

function buildStrip(items: CaseItem[], winner: CaseItem): CaseItem[] {
  const pool = items.length ? items : [winner];
  const weights = pool.map((item) => Math.max(0, item.weight));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const pick = () => {
    if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll < 0) return pool[i];
    }
    return pool[pool.length - 1];
  };
  const strip = Array.from({ length: STRIP_LENGTH }, pick);
  strip[WIN_INDEX] = winner;
  return strip;
}

interface CaseReelProps {
  items: CaseItem[];
  winner: CaseItem;
  onComplete: () => void;
  preview?: boolean;
  onTick?: () => void;
}

/** The server's winner is fixed before this purely visual sequence starts. */
export function CaseReel({ items, winner, onComplete, preview = false, onTick }: CaseReelProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const completeRef = useRef(onComplete);
  const tickRef = useRef(onTick);
  const [phase, setPhase] = useState<"running" | "settling" | "landed">("running");
  const strip = useMemo(() => buildStrip(items, winner), [items, winner]);

  useLayoutEffect(() => { completeRef.current = onComplete; tickRef.current = onTick; }, [onComplete, onTick]);

  useLayoutEffect(() => {
    const frame = viewport.current;
    const rail = track.current;
    if (!frame || !rail) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let tween: gsap.core.Tween | undefined;
    let timer: number | undefined;
    let progress = 0;
    let finished = false;
    let settling = false;
    let metrics = { width: 0, step: 0, card: 0 };
    setPhase("running");

    const position = () => {
      const from = START_INDEX * metrics.step + metrics.card / 2;
      const to = WIN_INDEX * metrics.step + metrics.card / 2;
      rail.style.transform = `translate3d(${metrics.width / 2 - from - (to - from) * progress}px, 0, 0)`;
      frame.style.setProperty("--reel-progress", String(progress));
    };
    const measure = () => {
      const first = rail.children[0] as HTMLElement;
      const second = rail.children[1] as HTMLElement;
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      metrics = { width: frame.getBoundingClientRect().width, card: firstRect.width, step: secondRect.left - firstRect.left };
      position();
    };
    const land = () => {
      if (finished) return;
      finished = true;
      progress = 1;
      position();
      setPhase("landed");
      timer = window.setTimeout(() => completeRef.current(), motion.matches ? 0 : RESULT_HOLD_MS);
    };
    const onMotionChange = () => {
      if (motion.matches && !preview) { tween?.kill(); land(); }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    motion.addEventListener("change", onMotionChange);
    if (preview) { /* Static collection preview never completes an opening. */ }
    else if (motion.matches) land();
    else {
      const playhead = { position: 0 };
      let lastCard = START_INDEX;
      tween = gsap.to(playhead, {
        position: 1,
        duration: REEL_MS / 1000,
        ease: reelProgress,
        onUpdate: () => {
          progress = playhead.position;
          position();
          const card = Math.floor(START_INDEX + (WIN_INDEX - START_INDEX) * progress);
          if (card !== lastCard) { tickRef.current?.(); lastCard = card; }
          if (progress >= 0.97 && !settling) { settling = true; setPhase("settling"); }
        },
        onComplete: land,
      });
    }
    return () => {
      tween?.kill();
      window.clearTimeout(timer);
      observer.disconnect();
      motion.removeEventListener("change", onMotionChange);
    };
  }, [strip, preview]);

  return (
    <div className={`dz-reel is-${phase}`} ref={viewport} aria-hidden="true">
      <div className="dz-reel__window">
        <div className="dz-reel__track" ref={track}>
          {strip.map((item, index) => {
            const { weapon, finish } = shortName(item.name);
            return (
              <div key={index} className={`dz-reel__card${phase === "landed" && index === WIN_INDEX ? " is-won" : ""}`}
                style={{ "--rc": rarityColor(item.rarity) } as CSSProperties}>
                <span className="dz-reel__edition">CS2 / {String(index + 1).padStart(2, "0")}</span>
                <EditorialItemImage name={item.name} imageUrl={item.imageUrl} decorative loading={index < 8 || index >= WIN_INDEX - 3 ? "eager" : "lazy"} />
                <small>{weapon}</small>
                <strong>{finish || weapon}</strong>
                <em>{formatMinor(item.valueMinor, item.currency)}</em>
              </div>
            );
          })}
        </div>
      </div>
      <span className="dz-reel__focus" />
      <span className="dz-reel__marker" />
      <span className="dz-reel__progress" />
    </div>
  );
}
