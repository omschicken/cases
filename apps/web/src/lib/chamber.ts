/**
 * Pointer parallax for THE DROP CHAMBER.
 *
 * One document-level listener drives every chamber on the page. Each chamber
 * registers itself and receives --dz-px / --dz-py in the range -1..1,
 * relative to its own box.
 *
 * Why it is built this way rather than a listener per component:
 *  - 90 case cards would otherwise mean 90 mousemove listeners.
 *  - Writes are batched into one rAF, so N chambers still cost one style
 *    flush per frame instead of N.
 *  - Off-screen chambers are skipped via IntersectionObserver, so a long
 *    catalog does no parallax work for cards nobody can see.
 */

interface Registered {
  el: HTMLElement;
  /** Updated by the IntersectionObserver; off-screen chambers are skipped. */
  visible: boolean;
  /** Cached box, refreshed on scroll/resize rather than per pointer event,
   *  since getBoundingClientRect in a mousemove forces layout every frame. */
  rect: DOMRect | null;
}

const registry = new Map<HTMLElement, Registered>();

let pointerX = 0;
let pointerY = 0;
let frame = 0;
let listening = false;
let observer: IntersectionObserver | null = null;
let reduced = false;

function measure() {
  for (const entry of registry.values()) {
    entry.rect = entry.visible ? entry.el.getBoundingClientRect() : null;
  }
}

function apply() {
  frame = 0;
  for (const entry of registry.values()) {
    if (!entry.visible || !entry.rect) continue;
    const { rect, el } = entry;
    if (!rect.width || !rect.height) continue;

    // -1..1 from the element's own centre, clamped so a pointer far outside
    // a small card does not drive the parallax past its designed range.
    const nx = Math.max(-1, Math.min(1, ((pointerX - rect.left) / rect.width - 0.5) * 2));
    const ny = Math.max(-1, Math.min(1, ((pointerY - rect.top) / rect.height - 0.5) * 2));

    el.style.setProperty("--dz-px", nx.toFixed(3));
    el.style.setProperty("--dz-py", ny.toFixed(3));
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(apply);
}

function onPointerMove(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
  schedule();
}

function onViewportChange() {
  measure();
  schedule();
}

function ensureListening() {
  if (listening) return;
  listening = true;

  reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  observer = new IntersectionObserver(
    (entries) => {
      for (const record of entries) {
        const entry = registry.get(record.target as HTMLElement);
        if (!entry) continue;
        entry.visible = record.isIntersecting;
        entry.rect = record.isIntersecting ? record.boundingClientRect : null;
      }
    },
    { rootMargin: "120px" },
  );

  for (const entry of registry.values()) observer.observe(entry.el);

  // Pointer parallax is a pointer affordance; coarse pointers get the
  // chamber's static composition, which is designed to stand on its own.
  if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }
  window.addEventListener("scroll", onViewportChange, { passive: true });
  window.addEventListener("resize", onViewportChange, { passive: true });
}

function teardownIfEmpty() {
  if (registry.size || !listening) return;
  listening = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("scroll", onViewportChange);
  window.removeEventListener("resize", onViewportChange);
  observer?.disconnect();
  observer = null;
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

/** Register a chamber element. Returns the matching unregister function. */
export function registerChamber(el: HTMLElement): () => void {
  ensureListening();

  const entry: Registered = { el, visible: true, rect: null };
  registry.set(el, entry);
  observer?.observe(el);
  schedule();

  return () => {
    observer?.unobserve(el);
    registry.delete(el);
    el.style.removeProperty("--dz-px");
    el.style.removeProperty("--dz-py");
    teardownIfEmpty();
  };
}
