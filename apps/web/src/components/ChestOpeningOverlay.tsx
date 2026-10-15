import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ParticleSystem } from "../lib/particles";
import { playCrack, playEruption, playReveal, playTension } from "../lib/openingSound";
import { CaseGlyph } from "./CaseChest";

interface ChestOpeningOverlayProps {
  mark: string;
  serial: string;
  variant: number;
  hue: number;
  saturation: number;
  lightness: number;
  /** Null until the server (or the demo roll) has decided the outcome. */
  itemImageUrl: string | null;
  itemName?: string;
  itemRarity?: string;
  /** Fires once the whole burst → reveal → settle sequence has finished. */
  onDone: () => void;
}

/**
 * CHEST OPENING OVERLAY — fullscreen GSAP + Canvas burst/reveal.
 *
 * Mounted via portal to document.body whenever CaseChest has opening=true.
 * Owns its own timeline: tension → crack → eruption → (hold for the item,
 * if it isn't known yet) → reveal → settle → onDone.
 *
 * Pure layout lives in CSS; every bit of motion is GSAP acting directly on
 * refs, so there are no @keyframes to keep in sync with this timeline.
 */
export function ChestOpeningOverlay({
  mark, serial, variant, hue, saturation, lightness,
  itemImageUrl, itemName, itemRarity, onDone,
}: ChestOpeningOverlayProps) {
  const stageRef   = useRef<HTMLDivElement>(null);
  const chestRef   = useRef<HTMLDivElement>(null);
  const lidRef     = useRef<HTMLDivElement>(null);
  const lockRef    = useRef<HTMLDivElement>(null);
  const beamRef    = useRef<HTMLDivElement>(null);
  const flashRef   = useRef<HTMLDivElement>(null);
  const itemRef    = useRef<HTMLDivElement>(null);
  const itemImgRef = useRef<HTMLImageElement>(null);
  const nameRef    = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  const itemReadyRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const waitTweenRef = useRef<gsap.core.Tween | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Build and run the timeline once on mount.
  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const t = window.setTimeout(() => onDoneRef.current(), 60);
      return () => window.clearTimeout(t);
    }

    const canvas = canvasRef.current;
    const particles = canvas ? new ParticleSystem(canvas) : null;
    particlesRef.current = particles;

    function onResize() { particles?.resize(); }
    window.addEventListener("resize", onResize);

    function burstFromChest(count: number, speed: [number, number]) {
      const rect = chestRef.current?.getBoundingClientRect();
      if (!particles || !rect) return;
      particles.burst({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height * 0.4,
        count,
        hue,
        speed,
        spreadRad: Math.PI * 1.6,
        angle: -Math.PI / 2,
      });
    }

    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: () => onDoneRef.current(),
    });
    timelineRef.current = tl;

    // ── TENSION (0 – 0.3s) ────────────────────────────────────────────
    tl.call(() => playTension())
      .to(chestRef.current, { scale: 1.08, duration: 0.3, ease: "power1.inOut" }, 0)
      .to(chestRef.current, {
        keyframes: [
          { x: 0, y: 0, rotation: 0, duration: 0 },
          { x: -2, y: 1, rotation: -0.4, duration: 0.05 },
          { x: 3, y: -1, rotation: 0.5, duration: 0.05 },
          { x: -3, y: 1, rotation: -0.6, duration: 0.05 },
          { x: 2, y: -2, rotation: 0.4, duration: 0.05 },
          { x: 0, y: 0, rotation: 0, duration: 0.05 },
        ],
      }, 0.05)
      .to(lockRef.current, { scale: 1.12, duration: 0.15, repeat: 1, yoyo: true }, 0.08)

      // ── CRACK (0.3 – 0.6s) ──────────────────────────────────────────
      .addLabel("crack", 0.3)
      .call(() => playCrack(), [], "crack")
      .to(lockRef.current, { opacity: 0, scale: 1.5, duration: 0.18, ease: "power2.in" }, "crack")
      .to(lidRef.current, { rotateX: -30, duration: 0.3, ease: "back.out(1.6)" }, "crack")

      // ── ERUPTION (0.6 – 0.9s) ───────────────────────────────────────
      .addLabel("eruption", 0.6)
      .call(() => { playEruption(); burstFromChest(90, [160, 460]); }, [], "eruption")
      .to(lidRef.current, { rotateX: -96, duration: 0.3 }, "eruption")
      .to(beamRef.current, { opacity: 1, scaleY: 1, duration: 0.3, ease: "power2.out" }, "eruption")
      .to(flashRef.current, { opacity: 0.9, duration: 0.08, yoyo: true, repeat: 1 }, "eruption+=0.15")

      // ── Hold point: reveal only plays once the item is known ────────
      .addLabel("awaitItem", 0.9)
      .call(() => {
        if (!itemReadyRef.current) {
          tl.pause();
          waitTweenRef.current = gsap.to(beamRef.current, {
            opacity: 0.55, duration: 0.7, repeat: -1, yoyo: true, ease: "sine.inOut",
          });
        }
      }, [], "awaitItem")

      // ── REVEAL (0.9 – 1.4s) ──────────────────────────────────────────
      // itemImgRef/nameRef only exist once the item prop is set, which is
      // exactly when this label resumes — so their tweens are built here,
      // on the fly, rather than captured (as null) at timeline-construction time.
      .call(() => { playReveal(itemRarity); burstFromChest(60, [80, 240]); }, [], "awaitItem")
      .to(beamRef.current, { opacity: 0.4, duration: 0.3 }, "awaitItem")
      .fromTo(itemRef.current,
        { opacity: 0, scale: 0.5, y: 24 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.4)" },
        "awaitItem+=0.05")
      .call(() => {
        if (itemImgRef.current) {
          gsap.fromTo(itemImgRef.current, { rotateY: 0 }, { rotateY: 360, duration: 0.9, ease: "power2.out" });
        }
        if (nameRef.current) {
          gsap.to(nameRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", delay: 0.3 });
        }
      }, [], "awaitItem+=0.05")

      // ── SETTLE (1.4 – 1.8s) ──────────────────────────────────────────
      .addLabel("settle", "awaitItem+=0.5")
      .to(beamRef.current, { opacity: 0, duration: 0.35 }, "settle")
      .to(chestRef.current, { opacity: 0.25, duration: 0.35 }, "settle")
      .call(() => { particles?.stop(); }, [], "settle+=0.3");

    return () => {
      tl.kill();
      waitTweenRef.current?.kill();
      window.removeEventListener("resize", onResize);
      particles?.destroy();
    };
    // Timeline is built once; itemImageUrl/itemRarity changes are handled
    // by the effect below instead of rebuilding the whole sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume a paused timeline the moment the item becomes known.
  useEffect(() => {
    itemReadyRef.current = Boolean(itemImageUrl);
    if (itemImageUrl && timelineRef.current?.paused()) {
      waitTweenRef.current?.kill();
      gsap.set(beamRef.current, { opacity: 1 });
      timelineRef.current.play();
    }
  }, [itemImageUrl]);

  const cssVars = {
    "--chest-hue": hue,
    "--chest-sat": `${saturation}%`,
    "--chest-lit": `${lightness}%`,
  } as CSSProperties;

  return createPortal(
    <div className="chest-burst-overlay" role="presentation">
      <canvas ref={canvasRef} className="chest-burst-canvas" aria-hidden="true" />
      <div className="chest-burst-stage" style={cssVars} ref={stageRef}>
        <div className="chest-burst-flash" ref={flashRef} aria-hidden="true" />
        <div className="chest-burst-beam" ref={beamRef} aria-hidden="true" />

        <div className="chest-burst-chest" ref={chestRef} aria-hidden="true">
          <div className="chest-burst-lid" ref={lidRef}>
            <span className="chest-burst-lid-mark">{mark}</span>
            <span className="chest-burst-lid-serial">#{serial}</span>
          </div>
          <div className="chest-burst-lock" ref={lockRef}>
            <span className="chest-burst-lock-gem" />
          </div>
          <div className="chest-burst-body">
            <div className="chest-burst-glyph-wrap">
              <CaseGlyph variant={variant} />
            </div>
          </div>
        </div>

        <div className="chest-burst-item" ref={itemRef}>
          <span className="chest-burst-item-glow" aria-hidden="true" />
          {itemImageUrl && <img ref={itemImgRef} src={itemImageUrl} alt={itemName ?? ""} />}
        </div>

        {itemName && (
          <div className="chest-burst-name" ref={nameRef}>{itemName}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
