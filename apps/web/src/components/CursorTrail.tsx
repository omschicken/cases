import { useEffect, useRef } from "react";

const POINTS = 7;

/** Six or seven small accent dots trailing the pointer, each following the
 *  one before it, opacity falling off down the chain. Canvas, full page,
 *  pointer-events none. Skipped for touch and reduced motion. */
export function CursorTrail() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pts = Array.from({ length: POINTS }, () => ({ x: -50, y: -50 }));
    let mx = -50, my = -50, raf = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let px = mx, py = my;
      pts.forEach((p, i) => {
        p.x += (px - p.x) * 0.35;
        p.y += (py - p.y) * 0.35;
        px = p.x; py = p.y;
        const k = 1 - i / POINTS;
        ctx.globalAlpha = 0.55 * k * k;
        ctx.fillStyle = "#7C6BFF";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1 + 2.2 * k, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="dz-trail" aria-hidden="true" />;
}
