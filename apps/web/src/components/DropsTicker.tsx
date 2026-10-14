import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { RecentDropDto } from "../lib/types";

const MAX_DROPS = 24;
const POLL_MS = 30_000; // fallback polling interval when SSE unavailable

/** Slim site-wide strip of live case-open results, shown above the header on every page. */
export function DropsTicker() {
  const { t } = useTranslation();
  const [drops, setDrops] = useState<RecentDropDto[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    function load() {
      api.get<RecentDropDto[]>("/cases/recent-drops").then(setDrops).catch(() => undefined);
    }

    function startSSE() {
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const es = new EventSource(`${apiBase}/cases/drops/stream`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const drop = JSON.parse(e.data) as RecentDropDto;
          setDrops((prev) => [drop, ...prev].slice(0, MAX_DROPS));
        } catch {
          // ignore malformed event
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Fall back to polling until the page reloads or navigates away.
        if (!pollTimer) {
          load();
          pollTimer = setInterval(load, POLL_MS);
        }
      };
    }

    // Seed initial drops from REST, then layer SSE on top.
    load();
    startSSE();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      clearInterval(pollTimer);
    };
  }, []);

  if (drops.length === 0) return null;

  const looped = [...drops, ...drops];

  return (
    <div className="drops-ticker-bar">
      <span className="drops-ticker-label">{t("dropsTicker.label")}</span>
      <div className="drops-ticker-marquee">
        <div className="drops-ticker-track">
          {looped.map((drop, i) => (
            <span
              key={`${drop.id}-${i}`}
              className="drops-ticker-item"
              style={{ "--rarity-color": rarityColor(drop.item.rarity) } as CSSProperties}
            >
              <span className="drops-ticker-user">{drop.userLabel}</span>
              <span className="drops-ticker-sep">{t("dropsTicker.unboxed")}</span>
              <span className="drops-ticker-item-name">{drop.item.name}</span>
              <span className="drops-ticker-value">{formatMinor(drop.item.valueMinor, drop.item.currency)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
