import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { RecentDropDto } from "../lib/types";

const REFRESH_MS = 15000;

/** Slim site-wide strip of live case-open results, shown above the header on every page. */
export function DropsTicker() {
  const [drops, setDrops] = useState<RecentDropDto[]>([]);

  useEffect(() => {
    function load() {
      api
        .get<RecentDropDto[]>("/cases/recent-drops")
        .then(setDrops)
        .catch(() => undefined);
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  if (drops.length === 0) return null;

  const looped = [...drops, ...drops];

  return (
    <div className="drops-ticker-bar">
      <span className="drops-ticker-label">Live drops</span>
      <div className="drops-ticker-marquee">
        <div className="drops-ticker-track">
          {looped.map((drop, i) => (
            <span
              key={`${drop.id}-${i}`}
              className="drops-ticker-item"
              style={{ "--rarity-color": rarityColor(drop.item.rarity) } as CSSProperties}
            >
              <span className="drops-ticker-user">{drop.userLabel}</span>
              <span className="drops-ticker-sep">unboxed</span>
              <span className="drops-ticker-item-name">{drop.item.name}</span>
              <span className="drops-ticker-value">{formatMinor(drop.item.valueMinor, drop.item.currency)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
