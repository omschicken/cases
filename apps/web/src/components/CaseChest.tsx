import type { CSSProperties } from "react";
import { ChestOpeningOverlay } from "./ChestOpeningOverlay";
import { rarityColor } from "../lib/rarity";
import type { ItemRarity } from "../lib/types";

type CaseChestProps = {
  caseName: string;
  caseSlug: string;
  itemImageUrl?: string;
  itemName?: string;
  itemRarity?: string;
  className?: string;
  opening?: boolean;
  /** Chest is frozen-open after the burst, during the showcase phase. */
  open?: boolean;
  /** Detail-page scene only: a weapon teased above the closed chest. */
  previewItemUrl?: string;
  previewRarity?: string;
  /** Called once the burst/reveal sequence inside the overlay has settled. */
  onRevealed?: () => void;
};

/** Stable visual identity: a case keeps the same treatment in every view. */
export function caseVisualIdentity(rawSlug: string) {
  // re-issued cases ("…-v2", "…-v3") keep the look of the original
  const caseSlug = rawSlug.replace(/-v\d+$/, "");
  const seed = [...caseSlug].reduce((value, letter) => ((value * 31) + letter.charCodeAt(0)) >>> 0, 7);
  const firstCases: Record<string, number> = {
    "ignition-case": 0, "static-case": 1, "overdrive-case": 2,
    "meltdown-case": 3, "blacklight-case": 4, "sovereign-case": 5,
  };
  const variant = firstCases[caseSlug] ?? seed % 6;
  const palette = [26, 271, 42, 9, 208, 217][variant];
  const hue = firstCases[caseSlug] === undefined ? seed % 360 : (palette + Math.floor(seed % 19) - 9 + 360) % 360;
  return { seed, variant, hue, finish: Math.floor(seed / 7) % 4 };
}

/** Main glyph SVG per variant */
export function CaseGlyph({ variant }: { variant: number }) {
  const shapes = [
    // 0 — flame
    <path key="flame" d="M32 6c4 14-3 18-8 26-4 6-3 13 2 17-2-9 8-12 8-21 11 10 17 19 14 28-2 11-12 18-23 17C13 72 5 62 8 50c2-9 9-15 15-22-1 10 4 14 9 16-4-12 3-21 0-38Z" strokeWidth="2"/>,
    // 1 — bolt
    <path key="bolt" d="M38 4 12 36h18l-5 24 30-36H36L38 4Z" strokeWidth="2.5"/>,
    // 2 — orbit rings
    <g key="orbit"><circle cx="32" cy="32" r="22" strokeWidth="2"/><circle cx="32" cy="32" r="13" strokeWidth="1.5"/><circle cx="32" cy="32" r="4" fill="currentColor" strokeWidth="0"/><path d="M32 4v7M32 53v7M4 32h7M53 32h7" strokeWidth="1.5"/></g>,
    // 3 — shard / diamond
    <path key="shard" d="M32 5 10 24l8 24 14 11 14-11 8-24L32 5ZM10 24l22 8 22-8M32 5v27m0 33V32M19 52l13-20 13 20" strokeWidth="2"/>,
    // 4 — reactor core (hex frame, lens, crosshair ticks)
    <g key="core"><path d="M32 5 54 18v28L32 59 10 46V18L32 5Z" strokeWidth="2"/><circle cx="32" cy="32" r="10" strokeWidth="2"/><circle cx="32" cy="32" r="3.5" fill="currentColor" strokeWidth="0"/><path d="M32 5v12M32 47v12M10 18l11 6.5M54 18l-11 6.5M10 46l11-6.5M54 46l-11-6.5" strokeWidth="1.5"/></g>,
    // 5 — crown
    <path key="crown" d="M6 20 20 36l12-24 12 24 14-16-6 32H10L6 20Zm6 40h40M20 44h24" strokeWidth="2.5"/>,
  ];
  return (
    <svg className="case-chest-glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden="true">
      {shapes[variant]}
    </svg>
  );
}

/** Orbit ring particles (pure CSS, decorative) */
function OrbitRing({ radius, count, delay }: { radius: number; count: number; delay: number }) {
  return (
    <div className="case-orbit-ring" style={{ "--orbit-r": `${radius}px`, "--orbit-count": count, "--orbit-delay": `${delay}s` } as CSSProperties} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="case-orbit-dot" style={{ "--dot-i": i } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * Decorative case preview — never represents an opening result on its own.
 *
 * Idle and frozen-open ("showcase") states render in place, as before.
 * The actual burst/reveal sequence is a separate fullscreen overlay
 * (ChestOpeningOverlay) so it gets the whole screen instead of this
 * component's small footprint — this element just hides while that's live.
 */
export function CaseChest({
  caseName, caseSlug, itemImageUrl, itemName, itemRarity, className = "",
  opening = false, open = false, previewItemUrl, previewRarity, onRevealed,
}: CaseChestProps) {
  const { seed, variant, hue, finish } = caseVisualIdentity(caseSlug);
  const mark = caseName.replace(/\s*case$/i, "").slice(0, 3).toUpperCase();
  const serial = String(seed % 10000).padStart(4, "0");
  const saturation = [65, 72, 58, 80, 55, 70][variant];
  const lightness  = [52, 60, 48, 55, 58, 65][finish % 4];

  const cls = `case-chest case-chest-v${variant} case-chest-f${finish} ${open ? "case-chest-is-open" : ""} ${className}`;
  // The detail page gets the full scene (vignette, particles, fog, weapon);
  // grid cards and the hero keep the lightweight chest.
  const scene = className.includes("case-chest-detail");
  const cssVars = {
    "--chest-hue": hue,
    "--chest-sat": `${saturation}%`,
    "--chest-lit": `${lightness}%`,
    ...(scene && previewRarity ? { "--scene-rarity": rarityColor(previewRarity as ItemRarity) } : {}),
  } as CSSProperties;

  return (
    <>
      <div
        className={cls}
        style={opening ? ({ ...cssVars, visibility: "hidden" } as CSSProperties) : cssVars}
        aria-hidden="true"
      >
        {scene && (
          <>
            <span className="case-chest-vignette" />
            <span className="case-chest-fog" />
            <span className="case-chest-particles">
              {Array.from({ length: 14 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    "--px": `${(i * 37 + seed) % 100}%`,
                    "--ps": `${2 + ((i * 5 + seed) % 3)}px`,
                    "--pd": `${7 + ((i * 3 + seed) % 6)}s`,
                    "--pl": `${-((i * 1.3) % 9)}s`,
                  } as CSSProperties}
                />
              ))}
            </span>
          </>
        )}

        {/* Atmospheric glow */}
        <span className="case-chest-aura" />
        <span className="case-chest-atmosphere" />

        {/* Orbit decoration */}
        <OrbitRing radius={42} count={6} delay={0} />
        <OrbitRing radius={58} count={4} delay={-1.2} />

        {/* Interior light during the frozen-open showcase state */}
        {open && <span className="case-chest-interior-light" />}

        {/* Revealed item floats above the chest */}
        {itemImageUrl && <img className="case-chest-reveal" src={itemImageUrl} alt="" />}

        {/* Weapon teased above the closed chest, lit in its rarity colour */}
        {scene && previewItemUrl && !itemImageUrl && (
          <div className="case-chest-weapon" aria-hidden="true">
            <span className="case-chest-weapon-glow" />
            <img src={previewItemUrl} alt="" />
            <span className="case-chest-weapon-shadow" />
          </div>
        )}

        {/* The case body */}
        <div className="case-chest-assembly">
          {/* Top lid */}
          <div className="case-chest-lid">
            <div className="case-chest-lid-inner">
              <span className="case-chest-lid-stripe" />
              <span className="case-chest-lid-mark">{mark}</span>
              <span className="case-chest-lid-serial">#{serial}</span>
            </div>
            <span className="case-chest-lid-edge" />
          </div>

          {/* Lock clasp */}
          <div className="case-chest-lock">
            <span className="case-chest-lock-body" />
            <span className="case-chest-lock-shackle" />
            <span className="case-chest-lock-gem" />
          </div>

          {/* Main body */}
          <div className="case-chest-body">
            <span className="case-chest-body-shine" />
            <span className="case-chest-body-grid" />

            {/* Corner accents */}
            <span className="case-chest-corner case-chest-corner-tl" />
            <span className="case-chest-corner case-chest-corner-tr" />
            <span className="case-chest-corner case-chest-corner-bl" />
            <span className="case-chest-corner case-chest-corner-br" />

            {/* Center glyph */}
            <div className="case-chest-glyph-wrap">
              <span className="case-chest-glyph-bg" />
              <CaseGlyph variant={variant} />
            </div>

            {/* Name band */}
            <div className="case-chest-nameband">
              <span className="case-chest-nameband-line" />
              <span className="case-chest-nameband-text">{caseName.replace(/\s*case$/i, "").toUpperCase()}</span>
              <span className="case-chest-nameband-line" />
            </div>
          </div>

          {scene && <span className="case-chest-gap-light" />}

          {/* Ground shadow */}
          <div className="case-chest-shadow" />
        </div>
      </div>

      {opening && onRevealed && (
        <ChestOpeningOverlay
          mark={mark}
          serial={serial}
          variant={variant}
          hue={hue}
          saturation={saturation}
          lightness={lightness}
          itemImageUrl={itemImageUrl ?? null}
          itemName={itemName}
          itemRarity={itemRarity}
          onDone={onRevealed}
        />
      )}
    </>
  );
}
