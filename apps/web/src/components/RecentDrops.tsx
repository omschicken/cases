import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { RecentDropDto } from "../lib/types";

const REFRESH_MS = 15000;

export function RecentDrops() {
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

  // Doubled list + a CSS keyframe that scrolls exactly -50% gives a
  // seamless infinite loop without any JS-driven animation.
  const looped = [...drops, ...drops];

  return (
    <div className="drops-section">
      <h3 className="drops-heading">Recent drops</h3>
      <div className="drops-marquee">
        <div className="drops-track">
          {looped.map((drop, i) => (
            <div
              key={`${drop.id}-${i}`}
              className="drop-card"
              style={{ "--rarity-color": rarityColor(drop.item.rarity) } as CSSProperties}
            >
              <img src={drop.item.imageUrl} alt={drop.item.name} />
              <div className="drop-card-info">
                <span className="drop-item-name">{drop.item.name}</span>
                <span className="drop-item-value">{formatMinor(drop.item.valueMinor, drop.item.currency)}</span>
                <span className="drop-user">{drop.userLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
