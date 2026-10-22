import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { registerChamber } from "../../lib/chamber";

export type ChamberState = "idle" | "armed" | "cycling" | "revealed";

interface DropChamberProps {
  /** The suspended object — a case, an item, whatever the scene is about. */
  children: ReactNode;
  state?: ChamberState;
  /** Drives every light in the cell. Defaults to the brand amber. */
  rarityColor?: string;
  /** Short technical read-outs. Decorative density only: never put a price,
   *  a name, or anything actionable here — it renders at 0.68rem. */
  hudLeft?: string;
  hudRight?: string;
  /** Status line, e.g. "READY" / "CYCLING". */
  status?: string;
  /** Interior depth in px. Smaller reads tighter, for cards. */
  depth?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * THE DROP CHAMBER — a containment cell rendered with CSS 3D planes.
 *
 * Presentational only. It knows nothing about opening a case, so it can be
 * reused for an item reveal, an upgrade, or a contract without dragging any
 * transaction logic along with it.
 */
export function DropChamber({
  children,
  state = "idle",
  rarityColor,
  hudLeft,
  hudRight,
  status,
  depth = 180,
  className = "",
  style,
}: DropChamberProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => registerChamber(ref.current!), []);

  const stateClass =
    state === "idle" ? "" : ` is-${state}`;

  return (
    <div
      ref={ref}
      className={`dz-chamber${stateClass}${className ? ` ${className}` : ""}`}
      style={{
        "--dz-chamber-depth": `${depth}px`,
        ...(rarityColor ? { "--dz-rarity": rarityColor } : null),
        ...style,
      } as CSSProperties}
    >
      <div className="dz-chamber__cell" aria-hidden="true">
        <div className="dz-chamber__wall dz-chamber__wall--back" />
        <div className="dz-chamber__wall dz-chamber__wall--left" />
        <div className="dz-chamber__wall dz-chamber__wall--right" />
        <div className="dz-chamber__floor" />
        <div className="dz-chamber__beam" />
        <div className="dz-chamber__contact" />
      </div>

      <div className="dz-chamber__fixture" aria-hidden="true" />
      <div className="dz-chamber__dust" aria-hidden="true" />

      <div className="dz-chamber__object">{children}</div>

      <div className="dz-chamber__frame" aria-hidden="true">
        <span className="dz-chamber__bracket dz-chamber__bracket--tl" />
        <span className="dz-chamber__bracket dz-chamber__bracket--tr" />
        <span className="dz-chamber__bracket dz-chamber__bracket--bl" />
        <span className="dz-chamber__bracket dz-chamber__bracket--br" />
      </div>

      {(hudLeft || hudRight || status) && (
        <div className="dz-chamber__hud" aria-hidden="true">
          {hudLeft && <span className="dz-chamber__hud-tl">{hudLeft}</span>}
          {hudRight && <span className="dz-chamber__hud-tr">{hudRight}</span>}
          {status && (
            <span className="dz-chamber__hud-bl">
              <span className="dz-chamber__status">{status}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
