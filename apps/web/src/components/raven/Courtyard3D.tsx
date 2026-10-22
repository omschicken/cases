import { useLayoutEffect, useMemo, useRef } from 'react';
import { MeshReflectorMaterial, RoundedBox, Sparkles } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, CatmullRomCurve3, Color, DoubleSide, InstancedMesh, Matrix4, Quaternion, Shape, ShapeGeometry, TubeGeometry, Vector3 } from 'three';
import { marbleTextures } from './textures';
import { HangingBranch, OliveTree } from './Foliage';

/**
 * The courtyard of the reference scene, built from real geometry in the case's own axes (front of the case = +z):
 * a two-step marble platform, a polished floor, tall marble columns at the right, a pale back wall, lower blocks and a planter
 * with an olive at the left. Sunlight comes from the upper left; invisible foliage casts the dappled shadows on the stone.
 */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

type Tex = ReturnType<typeof marbleTextures>;
type V3 = [number, number, number];

/** Marble box. `uv` scales the texture so big faces keep the same vein density as small ones. */
function Slab({ pos, size, tex, tint = '#fff8ee', glow = 0.28, rough = 0.95, coat = 0.4 }: { pos: V3; size: V3; tex: Tex; tint?: string; glow?: number; rough?: number; coat?: number }) {
  // bevelled edges catch the sun like real cut stone; the polished face carries a clear coat
  return <RoundedBox args={size} radius={Math.min(0.09, Math.min(...size) / 5)} smoothness={4} position={pos} castShadow receiveShadow>
    <meshPhysicalMaterial map={tex.map} bumpMap={tex.bump} bumpScale={1.2} roughnessMap={tex.rough} roughness={rough} metalness={0} clearcoat={coat} clearcoatRoughness={coat > 0.6 ? 0.1 : 0.34} color={tint}
      emissiveMap={tex.map} emissive="#efe4d3" emissiveIntensity={glow * 0.16} sheen={0.35} sheenColor="#fff1dd" sheenRoughness={0.6} />
  </RoundedBox>;
}

function leafGeometry(length: number, width: number) {
  const s = new Shape(); s.moveTo(0, 0); s.bezierCurveTo(width, length * 0.2, width * 0.85, length * 0.75, 0, length); s.bezierCurveTo(-width * 0.85, length * 0.75, -width, length * 0.2, 0, 0);
  return new ShapeGeometry(s, 4);
}

/** Olive plant: curved branches (tubes) carrying instanced lens-shaped leaves. */
function Olive({ position, scale = 1, seed = 41, branches: nb = 12, height = 1 }: { position: V3; scale?: number; seed?: number; branches?: number; height?: number }) {
  const leaves = useRef<InstancedMesh>(null!);
  const { branches, leafMatrices } = useMemo(() => {
    const r = rng(seed); const bs: TubeGeometry[] = []; const mats: Matrix4[] = [];
    const q = new Quaternion(); const up = new Vector3(0, 1, 0);
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * Math.PI * 2 + r() * 0.5, spread = 0.7 + r() * 0.7, h = (1.2 + r() * 1.0) * height;
      const pts = [new Vector3(0, 0, 0), new Vector3(Math.cos(a) * spread * 0.35, h * 0.4, Math.sin(a) * spread * 0.35), new Vector3(Math.cos(a) * spread * 0.8, h * 0.75, Math.sin(a) * spread * 0.8), new Vector3(Math.cos(a) * spread * 1.2, h, Math.sin(a) * spread * 1.2)];
      const curve = new CatmullRomCurve3(pts);
      bs.push(new TubeGeometry(curve, 14, 0.03, 5, false));
      for (let l = 0; l < 110; l++) {
        const t = 0.2 + r() * 0.8; const p = curve.getPoint(t); const tan = curve.getTangent(t);
        const dir = new Vector3(r() - 0.5, r() * 0.7 - 0.1, r() - 0.5).add(tan.clone().multiplyScalar(0.6)).normalize();
        q.setFromUnitVectors(up, dir); const s = 0.8 + r() * 0.8;
        mats.push(new Matrix4().compose(p.add(new Vector3((r() - 0.5) * 0.1, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1)), q, new Vector3(s, s, s)));
      }
    }
    return { branches: bs, leafMatrices: mats };
  }, [seed, nb, height]);
  const leafGeo = useMemo(() => leafGeometry(0.26, 0.034), []);
  useLayoutEffect(() => {
    const r = rng(seed + 5); const tint = new Color();
    leafMatrices.forEach((m, i) => { leaves.current.setMatrixAt(i, m); leaves.current.setColorAt(i, tint.setHSL(0.17 + r() * 0.06, 0.3 + r() * 0.14, 0.4 + r() * 0.18)); });
    leaves.current.instanceMatrix.needsUpdate = true; if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true;
  }, [leafMatrices, seed]);
  return <group position={position} scale={scale}>
    <mesh position={[0, -0.35, 0]} castShadow receiveShadow><cylinderGeometry args={[0.5, 0.38, 0.7, 28]} /><meshStandardMaterial color="#e3d3bd" roughness={0.85} /></mesh>
    {branches.map((g, i) => <mesh key={i} geometry={g} castShadow><meshStandardMaterial color="#6a5239" roughness={0.9} /></mesh>)}
    <instancedMesh ref={leaves} args={[leafGeo, undefined, leafMatrices.length]} castShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.65} side={DoubleSide} />
    </instancedMesh>
  </group>;
}

/**
 * A big olive canopy: arching branches from `start` towards `end`, carrying many golden-green leaves.
 * The leaves cast the real dappled shadow on the wall and the stone; far canopies sit behind the scene, near ones (out of focus) frame it.
 */
function Canopy({ start, end, seed, leaves = 1400, size = 1, droop = 1, branches = 7, leafLength = 0.34, shade = 1 }: { start: V3; end: V3; seed: number; leaves?: number; size?: number; droop?: number; branches?: number; leafLength?: number; shade?: number }) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => leafGeometry(leafLength, leafLength * 0.15), [leafLength]);
  const { tubes, mats } = useMemo(() => {
    const r = rng(seed); const s = new Vector3(...start), e = new Vector3(...end);
    const tubes: TubeGeometry[] = []; const mats: Matrix4[] = []; const q = new Quaternion(); const up = new Vector3(0, 1, 0);
    for (let b = 0; b < branches; b++) {
      const mid = s.clone().lerp(e, 0.5 + (r() - 0.5) * 0.2); mid.y += 0.8 * droop * (0.4 + r()); mid.z += (r() - 0.5) * 2.4;
      const tip = e.clone().add(new Vector3((r() - 0.5) * 3, -r() * 1.8 * droop, (r() - 0.5) * 2.4));
      const curve = new CatmullRomCurve3([s.clone(), mid, tip]);
      tubes.push(new TubeGeometry(curve, 16, 0.05 * size, 5, false));
      const n = Math.floor(leaves / branches);
      for (let l = 0; l < n; l++) {
        const t = 0.12 + r() * 0.88; const p = curve.getPoint(t); const tan = curve.getTangent(t);
        const dir = new Vector3(r() - 0.5, r() * 0.9 - 0.45, r() - 0.5).add(tan.clone().multiplyScalar(0.5)).normalize();
        q.setFromUnitVectors(up, dir); const sc = (0.7 + r() * 0.9) * size;
        mats.push(new Matrix4().compose(p.add(new Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5)), q, new Vector3(sc, sc, sc)));
      }
    }
    return { tubes, mats };
  }, [start, end, seed, branches, leaves, size, droop]);
  useLayoutEffect(() => {
    const r = rng(seed + 9); const tint = new Color();
    mats.forEach((m, i) => { ref.current.setMatrixAt(i, m); ref.current.setColorAt(i, tint.setHSL(0.14 + r() * 0.08, 0.34 + r() * 0.2, (0.3 + r() * 0.26) * shade)); });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [mats, seed, shade]);
  return <group>
    {tubes.map((g, i) => <mesh key={i} geometry={g} castShadow><meshStandardMaterial color="#5c4631" roughness={0.9} /></mesh>)}
    <instancedMesh ref={ref} args={[geo, undefined, mats.length]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial color="#ffffff" roughness={0.55} side={DoubleSide} emissive="#3d3510" emissiveIntensity={0.35} />
    </instancedMesh>
  </group>;
}

/**
 * Invisible foliage between the sun and `aim`: it draws nothing, but its shadow falls on the stone as dappled sunlight.
 * `hole` keeps a clear patch in the middle (so the case stays in plain sun).
 */
export function LeafShadows({ aim = [0, 0, 0], hole = 0, spread = 4.2, count = 460, seed = 1234 }: { aim?: V3; hole?: number; spread?: number; count?: number; seed?: number }) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => leafGeometry(0.5, 0.11), []);
  useLayoutEffect(() => {
    const r = rng(seed); const q = new Quaternion(); const m = new Matrix4(); const toSun = new Vector3(-7, 10, 3.5).normalize();
    const side = new Vector3().crossVectors(toSun, new Vector3(0, 1, 0)).normalize(); const up = new Vector3().crossVectors(side, toSun).normalize();
    const centre = new Vector3(...aim).addScaledVector(toSun, 7);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = hole + Math.sqrt(r()) * spread;
      const p = centre.clone().addScaledVector(side, Math.cos(a) * d * 1.25).addScaledVector(up, Math.sin(a) * d * 0.8).addScaledVector(toSun, (r() - 0.5) * 1.2);
      q.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize());
      ref.current.setMatrixAt(i, m.compose(p, q, new Vector3(1.2, 1.2, 1.2)));
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [aim, hole, spread, count, seed]);
  return <instancedMesh ref={ref} args={[geo, undefined, count]} castShadow>
    <meshBasicMaterial colorWrite={false} depthWrite={false} side={DoubleSide} />
  </instancedMesh>;
}

/** The platform the case stands on (top at y = 0): an upper step and a wider lower step in front. */
export const PLATFORM = { top: 0, upper: { pos: [0.4, -0.75, -0.2] as V3, size: [7.6, 1.5, 4.6] as V3 }, lower: { pos: [0.4, -1.45, 1.1] as V3, size: [10.2, 1.5, 7.2] as V3 } };

/** The podium: two thick slabs of veined, polished marble (a wide low one in front of a higher one), bevelled edges, no extra trim. */
export function Platform() {
  const tex = useMemo(() => marbleTextures(3, 1.6, 2.8), []);
  const u = PLATFORM.upper, l = PLATFORM.lower;
  return <group>
    <Slab pos={u.pos} size={u.size} tex={tex} tint="#ffeede" glow={0.3} rough={0.62} coat={0.9} />
    <Slab pos={l.pos} size={l.size} tex={tex} tint="#fbe9d8" glow={0.3} rough={0.62} coat={0.9} />
  </group>;
}

/** Polished marble floor: large veined slabs, a glossy surface that mirrors the sunlit blocks and the dappled light. */
function Floor() {
  const t = useMemo(() => marbleTextures(21, 7, 0.8), []);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]} receiveShadow>
    <planeGeometry args={[90, 90]} />
    <MeshReflectorMaterial map={t.map} bumpMap={t.bump} bumpScale={0.25} color="#efe0d1" roughness={0.05} metalness={0}
      mirror={1} blur={[60, 20]} mixBlur={0.5} mixStrength={2.6} mixContrast={1.0} resolution={1024} depthScale={0.1} minDepthThreshold={0.4} maxDepthThreshold={1.3} />
  </mesh>;
}

/** Square pillar with a plinth, a cornice and shallow vertical grooves. */
function Pillar({ pos, w = 2.6, h = 8.4, d = 2.6, tex }: { pos: V3; w?: number; h?: number; d?: number; tex: Tex }) {
  const [x, y, z] = pos; const base = y - h / 2;
  // a plain, massive block: a smooth shaft on a low plinth (the reference's columns have no ornament)
  return <group>
    <Slab pos={[x, y, z]} size={[w, h, d]} tex={tex} tint="#fff3e6" glow={0.3} />
    <Slab pos={[x, base + 0.25, z]} size={[w + 0.3, 0.5, d + 0.3]} tex={tex} tint="#fbeedd" glow={0.26} />
  </group>;
}

/** Arched niche recessed into the back wall: a darker, softly lit marble panel. */
function Niche({ x, y = 1.4, w = 2.6, h = 5.2, z = -7.1, tex }: { x: number; y?: number; w?: number; h?: number; z?: number; tex: Tex }) {
  const shape = useMemo(() => { const s = new Shape(); const r = w / 2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.closePath(); return s; }, [w, h]);
  return <group position={[x, y, z]}>
    <mesh position={[0, 0, 0.02]} receiveShadow><shapeGeometry args={[shape, 24]} /><meshStandardMaterial map={tex.map} roughness={0.9} color="#d9c4a6" emissiveMap={tex.map} emissive="#cdb394" emissiveIntensity={0.12} /></mesh>
    <mesh position={[0, 0, 0.0]} scale={[1.14, 1.05, 1]} receiveShadow><shapeGeometry args={[shape, 24]} /><meshStandardMaterial color="#fff0dc" roughness={0.8} emissive="#fff0dc" emissiveIntensity={0.14} /></mesh>
  </group>;
}

/** Long, faint beams of sunlight through the leaves: additive planes along the sun direction. */
function LightShafts() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.18, 'rgba(0,0,0,0.0)'); v.addColorStop(0.55, 'rgba(0,0,0,0.55)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, 64, 256);
    return new CanvasTexture(c);
  }, []);
  const dir = useMemo(() => new Vector3(7, -10, -3.5).normalize(), []);
  const items = useMemo(() => {
    const r = rng(17); const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().negate());
    return Array.from({ length: 7 }, (_, i) => ({ p: new Vector3(-7 + i * 2.2 + r() * 1.2, 7.5 + r() * 2, -2.5 + r() * 3).add(dir.clone().multiplyScalar(-1)), w: 0.7 + r() * 1.4, o: 0.05 + r() * 0.07, q }));
  }, [dir]);
  return <group>{items.map((s, i) => <mesh key={i} position={s.p} quaternion={s.q}>
    <planeGeometry args={[s.w, 17]} /><meshBasicMaterial map={tex} transparent opacity={s.o} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} color="#fff0cf" toneMapped={false} />
  </mesh>)}</group>;
}

/** Invisible pergola above the courtyard: only its slatted shadow reaches the stone (stripes of sun and shade). */
function PergolaShadow() {
  const toSun = new Vector3(-7, 10, 3.5).normalize();
  const centre = toSun.clone().multiplyScalar(9);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), toSun);
  return <group position={centre} quaternion={q}>
    {/* irregular beams (uneven spacing and width, a slight fan) so the stripes read as old timber, not a pattern */}
    {[[-8.1, .5, .47], [-5.2, .95, .52], [-3.3, .38, .5], [-0.4, .72, .46], [2.3, .42, .53], [4.4, 1.05, .49], [7.9, .55, .51]].map(([x, w, r], i) =>
      <mesh key={i} position={[x, 0, 0]} rotation={[0, r, 0]} castShadow><boxGeometry args={[w, 0.2, 30]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>)}
    {[[-2.5, .22], [3.1, .3]].map(([z, w], i) => // two thin cross rafters that break the stripes into dappled blocks
      <mesh key={`c${i}`} position={[0, 0, z * 3]} rotation={[0, 0.5 + Math.PI / 2 - 0.12, 0]} castShadow><boxGeometry args={[w, 0.2, 30]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>)}
  </group>;
}

export function Courtyard3D() {
  const tex = useMemo(() => marbleTextures(9, 1.8), []);
  return <group>
    <Floor />
    {/* pale back wall with three arched niches */}
    <mesh position={[0, 4, -7.6]} receiveShadow><boxGeometry args={[70, 14, 0.5]} /><meshStandardMaterial map={tex.map} bumpMap={tex.bump} bumpScale={1} roughnessMap={tex.rough} roughness={0.95} color="#fff4e4" emissiveMap={tex.map} emissive="#f3e8d8" emissiveIntensity={0.16} /></mesh>
    <Niche x={-1.2} tex={tex} w={3.2} h={6.2} y={1.2} /><Niche x={-7.6} tex={tex} w={2.8} h={5.6} /><Niche x={4.6} tex={tex} w={2.8} h={5.6} />
    {/* tall pillars at the right: big, bright faces against deep shadow slots */}
    <Pillar pos={[5.8, 3.6, -3.4]} w={3.5} h={9.2} d={3.3} tex={tex} />
    <Pillar pos={[10.4, 3.6, -4.2]} w={3.8} h={9.2} d={3.7} tex={tex} />
    {/* large masses at the left: a tall block behind, a broad planter block in front of it, a low step */}
    <Slab pos={[-10.2, 2.4, -5.0]} size={[4.0, 6.8, 3.4]} tex={tex} tint="#fbf0e0" glow={0.2} />
    <Slab pos={[-6.6, 0.9, -2.8]} size={[4.6, 3.4, 3.0]} tex={tex} tint="#fff8ee" glow={0.22} />
    <Slab pos={[-6.6, 2.72, -2.8]} size={[5.0, 0.26, 3.4]} tex={tex} tint="#fffaf2" glow={0.28} />
    <Slab pos={[-3.2, -0.3, -4.0]} size={[4.2, 1.6, 2.2]} tex={tex} tint="#fff8ee" glow={0.2} />
    <Slab pos={[2.2, -0.55, -4.3]} size={[5.4, 1.0, 1.5]} tex={tex} tint="#fff8ee" glow={0.2} />
    {/* low blocks stepping down to the left across the polished floor, as in the reference */}
    <Slab pos={[-5.0, -1.98, 3.4]} size={[4.2, 0.44, 2.4]} tex={tex} tint="#fff3e6" glow={0.25} rough={0.6} coat={0.8} />
    <Slab pos={[-6.4, -1.78, 1.5]} size={[3.0, 0.84, 1.8]} tex={tex} tint="#fff3e6" glow={0.25} rough={0.6} coat={0.8} />
    <Slab pos={[-8.0, -1.55, -0.2]} size={[3.0, 1.3, 2.2]} tex={tex} tint="#fff3e6" glow={0.25} rough={0.6} coat={0.8} />
    {/* planting: a large olive on the broad block, a second tall one behind, shrubs on the low walls and by the pillars */}
    <OliveTree position={[-6.6, 2.85, -2.8]} scale={1.9} seed={41} stems={4} height={1.3} />
    <OliveTree position={[-10.2, 5.8, -5.0]} scale={1.5} seed={7} stems={3} height={1.2} />
    <OliveTree position={[-3.2, 0.5, -4.0]} scale={1.0} seed={19} stems={3} height={1.0} />
    <OliveTree position={[2.2, -0.05, -4.3]} scale={0.8} seed={23} stems={3} height={0.9} />
    {/* one soft olive canopy hanging over the left block, like the plant at the top left of the reference (small leaves, many of them) */}
    <HangingBranch start={[-13, 6.6, -5.2]} end={[-3.6, 5.3, -4.4]} seed={8} branches={9} />
    <PergolaShadow />
    <LightShafts />
    <Sparkles count={90} scale={[16, 7, 9]} position={[0, 2.6, 0]} size={2.4} speed={0.12} opacity={0.65} color="#fff1d0" />
  </group>;
}
