/**
 * Global visual effects: 3D card tilt, magnetic hover, cursor glow.
 * Initialized once from Layout. All effects clean up on destroy.
 */

const TILT_MAX = 12; // degrees
const TILT_PERSPECTIVE = 800;

function applyTilt(el: HTMLElement, x: number, y: number) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx = ((y - cy) / (rect.height / 2)) * -TILT_MAX;
  const ry = ((x - cx) / (rect.width / 2)) * TILT_MAX;
  el.style.setProperty("--tilt-rx", `${rx.toFixed(2)}deg`);
  el.style.setProperty("--tilt-ry", `${ry.toFixed(2)}deg`);
  el.style.setProperty("--tilt-px", `${((x - rect.left) / rect.width * 100).toFixed(1)}%`);
  el.style.setProperty("--tilt-py", `${((y - rect.top) / rect.height * 100).toFixed(1)}%`);
}

function resetTilt(el: HTMLElement) {
  el.style.setProperty("--tilt-rx", "0deg");
  el.style.setProperty("--tilt-ry", "0deg");
}

export function initEffects(): () => void {
  if (typeof window === "undefined") return () => undefined;

  // Respect reduced motion
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq.matches) return () => undefined;

  // ── 3D tilt on case cards ──────────────────────────────────────────────────
  function onMove(e: MouseEvent) {
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>(
      ".case-card-editorial, .collection-route, .inventory-card, .battle-case"
    ) : null;
    if (!target) return;
    applyTilt(target, e.clientX, e.clientY);
  }
  function onLeave(e: MouseEvent) {
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>(
      ".case-card-editorial, .collection-route, .inventory-card, .battle-case"
    ) : null;
    if (target) resetTilt(target);
  }

  document.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("mouseleave", onLeave, true);

  // ── Cursor glow ────────────────────────────────────────────────────────────
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);
  let cx = -200, cy = -200;
  let rafId = 0;

  function tick() {
    glow.style.transform = `translate(${cx}px, ${cy}px)`;
    rafId = requestAnimationFrame(tick);
  }
  function trackCursor(e: MouseEvent) { cx = e.clientX; cy = e.clientY; }
  document.addEventListener("mousemove", trackCursor, { passive: true });
  rafId = requestAnimationFrame(tick);

  // ── Scroll progress bar ───────────────────────────────────────────────────
  function updateScrollProgress() {
    const doc = document.documentElement;
    const progress = doc.scrollTop / (doc.scrollHeight - doc.clientHeight) || 0;
    doc.style.setProperty("--scroll-progress", String(progress.toFixed(4)));
  }
  document.addEventListener("scroll", updateScrollProgress, { passive: true });

  return () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseleave", onLeave, true);
    document.removeEventListener("mousemove", trackCursor);
    document.removeEventListener("scroll", updateScrollProgress);
    cancelAnimationFrame(rafId);
    glow.remove();
  };
}
