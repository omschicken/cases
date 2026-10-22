import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, SpriteMaterial } from 'three';
import type { Sprite } from 'three';
import type { Hit } from './physics';

/**
 * Dust thrown up where the case hits the stone: soft puffs fly out of the case's footprint, slow down in the air, grow and fade.
 * One burst per strong impact, scaled by the impact speed. Everything is a pure function of time since the drop began.
 */
const PER_HIT = 18, MAX_HITS = 4, LIFE = 1.7, DRAG = 2.2;

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export type DropLog = { start: number; hits: Hit[] };

export function Dust({ dropRef }: { dropRef: React.MutableRefObject<DropLog> }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new CanvasTexture(c);
  }, []);
  const particles = useMemo(() => Array.from({ length: MAX_HITS * PER_HIT }, (_, i) => {
    const r = rng(900 + i * 17); const a = ((i % PER_HIT) / PER_HIT) * Math.PI * 2 + r() * 0.3;
    return { mat: new SpriteMaterial({ map: tex, color: '#dccbb2', transparent: true, depthWrite: false, opacity: 0 }), a, out: 1.4 + r() * 2.6, up: 0.7 + r() * 1.3, size: 0.5 + r() * 0.9, hit: Math.floor(i / PER_HIT) };
  }), [tex]);
  const sprites = useRef<(Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const { start, hits } = dropRef.current; const age = clock.elapsedTime - start;
    particles.forEach((p, i) => {
      const s = sprites.current[i]; if (!s) return;
      const h = hits[p.hit]; const a = h ? age - h.t : -1;
      if (!h || a < 0 || a > LIFE) { s.visible = false; return; }
      s.visible = true;
      const k = (1 - Math.exp(-DRAG * a)) / DRAG; const power = Math.min(1, 0.25 + h.speed / 24);
      s.position.set(Math.cos(p.a) * (2.25 + p.out * k * power), 0.06 + p.up * k * power, Math.sin(p.a) * (1.1 + p.out * k * power * 0.9) + 0.1);
      const sc = (0.35 + 1.5 * Math.pow(a / LIFE, 0.55)) * p.size * (0.6 + power * 0.7); s.scale.set(sc, sc, 1);
      p.mat.opacity = 0.42 * power * Math.pow(1 - a / LIFE, 1.6);
    });
  });
  return <group name="dust">{particles.map((p, i) => <sprite key={i} ref={el => { sprites.current[i] = el; }} material={p.mat} visible={false} renderOrder={3} />)}</group>;
}
