import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseItem } from "../lib/types";
import { EditorialItemImage } from "./editorial/EditorialItemImage";

export const REEL_MS = 5200;
const CARD_W = 150;
const GAP = 10;
const STRIP_LENGTH = 58;
const WIN_INDEX = 47;

/** Weapon / finish split, without the wear suffix. */
function shortName(name: string) {
  const [weapon, ...rest] = name.replace(/ \([^)]*\)$/, "").replace(/^★ /, "").split(" | ");
  return { weapon, finish: rest.join(" | ") };
}

/** Visual filler: rarer drops show up less often, but still often enough to tease. */
function buildStrip(items: CaseItem[], winner: CaseItem): CaseItem[] {
  const weights = items.map((i) => Math.sqrt(Math.max(i.weight, 0.0001)));
  const total = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let roll = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  const strip = Array.from({ length: STRIP_LENGTH }, pick);
  strip[WIN_INDEX] = winner;
  return strip;
}

interface CaseReelProps {
  items: CaseItem[];
  winner: CaseItem;
}

/** Horizontal roulette: starts instantly, glides and settles on the (already decided) winner. */
export function CaseReel({ items, winner }: CaseReelProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState(0);
  const [running, setRunning] = useState(false);
  const [landed, setLanded] = useState(false);
  const strip = useMemo(() => buildStrip(items, winner), [items, winner]);
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useLayoutEffect(() => {
    const width = viewport.current?.clientWidth ?? 600;
    // Land somewhere inside the winning card, never dead centre, like a real wheel.
    const jitter = (Math.random() - 0.5) * CARD_W * 0.6;
    setTarget(WIN_INDEX * (CARD_W + GAP) + CARD_W / 2 - width / 2 + jitter);
    if (reduceMotion) {
      setRunning(true);
      setLanded(true);
      return;
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setRunning(true)));
    const timer = window.setTimeout(() => setLanded(true), REEL_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [strip, reduceMotion]);

  const trackStyle: CSSProperties = {
    transform: `translateX(${running ? -target : 0}px)`,
    transition: running && !reduceMotion ? `transform ${REEL_MS}ms cubic-bezier(.1,.7,.08,1)` : "none",
  };

  return (
    <div className="dz-reel" ref={viewport} aria-hidden="true">
      <div className="dz-reel__track" style={trackStyle}>
        {strip.map((item, index) => {
          const { weapon, finish } = shortName(item.name);
          return (
            <div
              key={index}
              className={`dz-reel__card${landed && index === WIN_INDEX ? " is-won" : ""}`}
              style={{ "--rc": rarityColor(item.rarity), width: CARD_W } as CSSProperties}
            >
              <EditorialItemImage name={item.name} imageUrl={item.imageUrl} decorative loading="eager" />
              <small>{weapon}</small>
              <strong>{finish}</strong>
              <em>{formatMinor(item.valueMinor, item.currency)}</em>
            </div>
          );
        })}
      </div>
      <span className="dz-reel__marker" />
    </div>
  );
}
