/**
 * PARTICLES — lightweight Canvas particle system for the chest burst.
 *
 * Deliberately not DOM: a few hundred animated nodes would thrash layout.
 * A single canvas, drawn imperatively every frame, costs nothing comparable.
 */

export type ParticleKind = "spark" | "star" | "shard";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  life: number;
  maxLife: number;
  hue: number;
  lightness: number;
}

interface BurstOptions {
  x: number;
  y: number;
  count: number;
  hue: number;
  /** Lightness of the particle color (0-100). */
  lightness?: number;
  /** Outward speed range in px/s. */
  speed?: [number, number];
  /** Lifetime range in seconds. */
  life?: [number, number];
  /** Size range in px. */
  size?: [number, number];
  /** Narrow cone instead of full 360° spread — radians. Omit for full circle. */
  spreadRad?: number;
  /** Center angle of the cone, radians. Default: straight up. */
  angle?: number;
  kinds?: ParticleKind[];
}

const GRAVITY = 480; // px/s^2
const DRAG = 0.985; // per-frame velocity decay

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private rafId = 0;
  private lastTime = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const { innerWidth, innerHeight } = window;
    this.canvas.width = innerWidth * this.dpr;
    this.canvas.height = innerHeight * this.dpr;
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  burst(options: BurstOptions): void {
    const {
      x, y, count, hue,
      lightness = 65,
      speed = [120, 420],
      life = [0.5, 1.1],
      size = [2, 6],
      spreadRad,
      angle = -Math.PI / 2,
      kinds = ["spark", "star", "shard"],
    } = options;

    for (let i = 0; i < count; i++) {
      const dir = spreadRad
        ? angle + rand(-spreadRad / 2, spreadRad / 2)
        : rand(0, Math.PI * 2);
      const v = rand(speed[0], speed[1]);
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      this.particles.push({
        kind,
        x, y,
        vx: Math.cos(dir) * v,
        vy: Math.sin(dir) * v,
        size: rand(size[0], size[1]),
        rotation: rand(0, Math.PI * 2),
        spin: rand(-6, 6),
        life: 0,
        maxLife: rand(life[0], life[1]),
        hue: hue + rand(-12, 12),
        lightness: lightness + rand(-10, 10),
      });
    }

    if (!this.running) this.start();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  clear(): void {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.stop();
    this.clear();
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const { ctx, canvas, dpr } = this;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    let alive = 0;
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      alive++;

      p.vy += GRAVITY * dt;
      p.vx *= DRAG;
      p.vy *= DRAG;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;

      const t = p.life / p.maxLife;
      const fade = 1 - t * t; // ease-out fade
      const color = `hsla(${p.hue}, 85%, ${p.lightness}%, ${fade})`;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      if (p.kind === "spark") {
        const len = p.size * 2.4;
        ctx.lineWidth = Math.max(1, p.size * 0.4);
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
      } else if (p.kind === "star") {
        drawStar(ctx, p.size);
      } else {
        drawShard(ctx, p.size);
      }
      ctx.restore();
    }

    // Drop dead particles periodically rather than every frame for cheapness.
    if (this.particles.length > 0 && alive < this.particles.length * 0.6) {
      this.particles = this.particles.filter((p) => p.life < p.maxLife);
    }

    if (alive > 0 || this.particles.length > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
    }
  };
}

function drawStar(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    const outer = size;
    const inner = size * 0.35;
    const ax = Math.cos(a) * outer;
    const ay = Math.sin(a) * outer;
    const bx = Math.cos(a + Math.PI / 4) * inner;
    const by = Math.sin(a + Math.PI / 4) * inner;
    if (i === 0) ctx.moveTo(ax, ay);
    else ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.closePath();
  ctx.fill();
}

function drawShard(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, size * 0.4);
  ctx.lineTo(-size * 0.5, size * 0.6);
  ctx.closePath();
  ctx.fill();
}
