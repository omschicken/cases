import type { CSSProperties } from "react";

type CaseChestProps = {
  caseName: string;
  caseSlug: string;
  itemImageUrl?: string;
  className?: string;
  opening?: boolean;
};

/** Stable visual identity: a case keeps the same treatment in every view. */
export function caseVisualIdentity(caseSlug: string) {
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

function CaseGlyph({ variant }: { variant: number }) {
  const shapes = [
    <path key="flame" d="M30 4c3 12-2 16-7 23-4 5-4 11 1 15-1-8 7-11 7-19 10 9 15 17 13 25-2 10-11 16-21 15C11 62 4 53 7 42c2-8 8-14 14-20-1 9 3 13 9 14-4-11 3-18 0-32Z" />,
    <path key="bolt" d="M36 3 11 34h17l-5 27 30-36H35L36 3Z" />,
    <g key="orbit"><circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="15"/><circle cx="32" cy="32" r="5"/><path d="M32 1v11M32 52v11M1 32h11M52 32h11"/></g>,
    <path key="shard" d="M32 3 8 22l9 28 15 11 15-11 9-28L32 3ZM8 22l24 7 24-7M32 3v26m0 32V29M17 50l15-21 15 21" />,
    <g key="signal"><path d="M7 48h8V31H7v17Zm14 0h8V18h-8v30Zm14 0h8V25h-8v23Zm14 0h8V8h-8v40Z"/><path d="M5 56h54"/></g>,
    <path key="crown" d="m5 18 13 14 14-23 14 23 13-14-6 34H11L5 18Zm7 42h40M19 43h26" />,
  ];
  return <svg className="case-chest-glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden="true">{shapes[variant]}</svg>;
}

/** Decorative case preview. It never represents an opening or its result. */
export function CaseChest({ caseName, caseSlug, itemImageUrl, className = "", opening = false }: CaseChestProps) {
  const { seed, variant, hue, finish } = caseVisualIdentity(caseSlug);
  const mark = caseName.replace(/\s*case$/i, "").slice(0, 3).toUpperCase();
  const nameplate = caseName.replace(/\s*case$/i, "").toUpperCase();
  const serial = String(seed % 1000).padStart(3, "0");

  return (
    <div className={`case-chest case-chest-v${variant} case-chest-f${finish} ${opening ? "case-chest-is-opening" : ""} ${className}`} style={{ "--chest-hue": hue } as CSSProperties} aria-hidden="true">
      <span className="case-chest-aura" />
      {opening && <><span className="case-chest-flare" /><span className="case-chest-scan" /></>}
      {itemImageUrl && <img className="case-chest-reveal" src={itemImageUrl} alt="" />}
      <div className="case-chest-assembly">
        <div className="case-chest-lid">
          <span className="case-chest-lid-ridge" />
          <span className="case-chest-lid-mark">{mark}</span>
        </div>
        <div className="case-chest-body">
          <span className="case-chest-finish" />
          <span className="case-chest-corner case-chest-corner-left" />
          <span className="case-chest-corner case-chest-corner-right" />
          <span className="case-chest-lock"><span /></span>
          <CaseGlyph variant={variant} />
          <span className="case-chest-nameplate">{nameplate}</span>
          <span className="case-chest-stripe case-chest-stripe-left" />
          <span className="case-chest-stripe case-chest-stripe-right" />
          <span className="case-chest-serial">DZ / {serial}</span>
        </div>
        <div className="case-chest-shadow" />
      </div>
    </div>
  );
}
