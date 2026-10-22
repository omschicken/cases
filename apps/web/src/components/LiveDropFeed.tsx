import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { RecentDropDto } from "../lib/types";

const POLL_MS = 8_000;
const MAX_VISIBLE = 4;
const LIFETIME_MS = 5_000;
const FRESH_ON_LOAD_MS = 60_000;

interface Toast {
  key: string;
  drop: RecentDropDto;
}

/** Bottom-left stream of real wins. No data, no toasts — nothing is invented. */
export function LiveDropFeed() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    let stopped = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function show(drops: RecentDropDto[]) {
      for (const drop of drops) {
        const key = `${drop.id}-${Date.now()}`;
        setToasts((prev) => [...prev, { key, drop }].slice(-MAX_VISIBLE));
        const timer = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.key !== key));
          timers.delete(timer);
        }, LIFETIME_MS);
        timers.add(timer);
      }
    }

    async function poll() {
      if (document.hidden) return;
      try {
        const drops = await api.get<RecentDropDto[]>("/cases/recent-drops");
        if (stopped || !Array.isArray(drops)) return;
        const fresh = drops.filter((d) => !seen.current.has(d.id));
        drops.forEach((d) => seen.current.add(d.id));
        // First poll only surfaces wins from the last minute, never old history.
        const toShow = primed.current
          ? fresh
          : fresh.filter((d) => Date.now() - new Date(d.createdAt).getTime() < FRESH_ON_LOAD_MS);
        primed.current = true;
        show(toShow.reverse().slice(-MAX_VISIBLE)); // oldest first, newest lands on top
      } catch {
        /* transient — try again next tick */
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="live-feed" aria-live="off">
      {toasts.map(({ key, drop }) => (
        <div
          key={key}
          className="live-feed__toast"
          style={{ "--rc": rarityColor(drop.item.rarity as never) } as CSSProperties}
        >
          <img src={drop.item.imageUrl} alt="" />
          <div className="live-feed__text">
            <span className="live-feed__user">{drop.userLabel}</span>
            <span className="live-feed__item">{drop.item.name}</span>
          </div>
          <span className="live-feed__price">{formatMinor(drop.item.valueMinor, drop.item.currency)}</span>
        </div>
      ))}
    </div>
  );
}
