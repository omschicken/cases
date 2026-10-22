import { useLayoutEffect, useMemo, useRef } from 'react';
import { Euler, ExtrudeGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Shape, Vector3 } from 'three';
import { EdgesGeometry, LineBasicMaterial } from 'three';
import type { BufferGeometry, Group } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { navyStoneTextures } from '../raven/textures';

/**
 * MASTER CASE SKELETON: the one base body every case shares (Raven, Greek, Anubis, Ice, Fire ...). A theme only changes the front relief,
 * ornaments, materials and accent geometry, never this construction. It follows the approved skeleton sheet:
 *   lid (the top cap: rim, seven raised top panels, heavy corner caps) - lock (latch modules over the top rail, two on each long side)
 *   body (central shell: top rail, the big stepped front plate in its frame, narrow plates, lower rail) - bottom (base band) -
 *   corner (eight octagonal guards: four at the top of the posts, four at the foot) - side (four tall edge posts and the end panels) -
 *   handle (a recessed handle ring on each end).
 * `explode` (0..1) pulls the modules apart; `debug` colours them like the sheet; `wire` shows the mesh.
 * Units: 1 = 0.28 m (the box is about 4.1 x 2.9 x 2.1). The origin is the middle of the underside, y up; the long front faces +z; a handle is on each end (-x).
 */
export const CASE_DIM = { w: 5.4, d: 2.5, bottomH: 0.26, bodyH: 1.5, lidH: 0.35 } as const;

export type ModuleKind = 'lid' | 'lock' | 'body' | 'bottom' | 'corner' | 'handle' | 'side';
/** Module colours of the sheet. */
export const MODULE_COLORS: Record<ModuleKind, string> = { lid: '#ff5f6d', lock: '#ffae3a', body: '#4c7dff', bottom: '#2fd5df', corner: '#e1b12f', handle: '#a560ff', side: '#41c96b' };

/** The neutral clay finish of the master skeleton: one soft grey per module, so the form reads and no theme is implied. */
export const CLAY: Record<ModuleKind | 'bolt', string> = { lid: '#a7abb3', lock: '#c0c3c9', body: '#989ca4', bottom: '#898d95', corner: '#858992', handle: '#686d76', side: '#9094a0', bolt: '#6d7077' };

/** What a theme can change on the skeleton (colours here; the front relief and ornaments are separate pieces on top). */
export type Skin = Partial<Record<ModuleKind | 'bolt', string>>;

type V3 = [number, number, number];
const cache = new Map<string, BufferGeometry>();
/** Box of exactly w-h-d with 45- chamfers of size c, box-mapped UVs and a lighter chamfer tint, so the edges catch the light. */
function armourBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const key = [w, h, d, c].map(n => n.toFixed(3)).join('/'); const hit = cache.get(key); if (hit) return hit;
  c = Math.min(c, w / 2.2, h / 2.2, d / 2.2);
  const s = new Shape(); const hw = w / 2 - c, hh = h / 2 - c;
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
  const raw = new ExtrudeGeometry(s, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 6, steps: 1 });
  raw.translate(0, 0, -(d - 2 * c) / 2); const g = toCreasedNormals(raw, 0.75); mapBox(g);
  cache.set(key, g); return g;
}

function mapBox(g: BufferGeometry) {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'); const uv = new Float32Array(pos.count * 2), col = new Float32Array(pos.count * 3); const TILE = 2;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i)); const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (nz >= nx && nz >= ny) { uv[i * 2] = x / TILE; uv[i * 2 + 1] = y / TILE; } else if (nx >= ny) { uv[i * 2] = z / TILE; uv[i * 2 + 1] = y / TILE; } else { uv[i * 2] = x / TILE; uv[i * 2 + 1] = z / TILE; }
    const flat = Math.max(nx, ny, nz) > 0.95; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = flat ? 0.86 : 1.25;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

const polyCache = new Map<string, BufferGeometry>();
/** A plate with an arbitrary outline (points in x,y around the centre), extruded `depth` with a small bevel, facing +z. */
function plate(pts: [number, number][], depth: number, bevel = 0.02): BufferGeometry {
  const key = pts.map(p => p.join(',')).join(';') + '/' + depth + '/' + bevel; const hit = polyCache.get(key); if (hit) return hit;
  const s = new Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath();
  const raw = new ExtrudeGeometry(s, { depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1 });
  raw.translate(0, 0, -(depth - 2 * bevel) / 2); const g = toCreasedNormals(raw, 0.75); mapBox(g); polyCache.set(key, g); return g;
}

/** The big front plate: a wide panel with cut lower corners and a stepped tab on the top edge (half width a, half height b). */
function frontPlate(a: number, b: number, cut: number, tabHalf: number, tabH: number, step: number): [number, number][] {
  return [[-a + cut, -b], [a - cut, -b], [a, -b + cut], [a, b], [tabHalf + step, b], [tabHalf, b + tabH], [-tabHalf, b + tabH], [-tabHalf - step, b], [-a, b], [-a, -b + cut]];
}

/** A rounded-rectangle ring (outer ow-oh, inner iw-ih) extruded `depth`, facing +x: the handle frame. */
function roundedRing(ow: number, oh: number, iw: number, ih: number, depth: number): BufferGeometry {
  const rr = (s: Shape, w: number, h: number, r: number) => {
    const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  };
  const shape = new Shape(); rr(shape, ow, oh, 0.16);
  const hole = new Shape(); rr(hole, iw, ih, 0.09); shape.holes.push(hole);
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals(); mapBox(g); return g;
}

type Mats = Record<ModuleKind | 'bolt', MeshStandardMaterial>;
const GOLD: Record<string, boolean> = { lock: true, corner: true };
/** The look of the concept sheet: dark navy veined stone, brushed gold on the locks and corner guards, and a faint module-coloured wire over each piece. */
function stoneMaterials(wire: boolean): Mats {
  const t = navyStoneTextures(7);
  const mk = (k: ModuleKind | 'bolt') => {
    const col = k === 'bolt' ? '#8f949c' : MODULE_COLORS[k];
    const mat = k === 'bolt' ? new MeshStandardMaterial({ color: '#7d828a', roughness: 0.4, metalness: 0.7 })
      : GOLD[k] ? new MeshStandardMaterial({ vertexColors: true, color: '#c0903c', roughness: 0.36, metalness: 0.78, emissive: col, emissiveIntensity: 0.12, wireframe: wire })
      : new MeshStandardMaterial({ vertexColors: true, map: t.map, bumpMap: t.bump, bumpScale: 0.5, color: '#ffffff', roughness: 0.46, metalness: 0.18, emissive: col, emissiveIntensity: k === 'handle' ? 0.3 : 0.1, wireframe: wire });
    if (k !== 'bolt') mat.userData.wire = new LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 });
    return mat;
  };
  return { lid: mk('lid'), lock: mk('lock'), body: mk('body'), bottom: mk('bottom'), corner: mk('corner'), handle: mk('handle'), side: mk('side'), bolt: mk('bolt') };
}

function makeMaterials(skin: Skin, debug: boolean, wire: boolean): Mats {
  const mk = (k: ModuleKind | 'bolt') => debug && k !== 'bolt'
    ? new MeshStandardMaterial({ color: MODULE_COLORS[k as ModuleKind], roughness: 0.6, metalness: 0.05, flatShading: true, wireframe: wire })
    : new MeshStandardMaterial({ vertexColors: k !== 'bolt', color: skin[k] ?? CLAY[k], roughness: k === 'handle' || k === 'bolt' ? 0.45 : 0.68, metalness: k === 'handle' || k === 'bolt' ? 0.5 : 0.08, wireframe: wire });
  return { lid: mk('lid'), lock: mk('lock'), body: mk('body'), bottom: mk('bottom'), corner: mk('corner'), handle: mk('handle'), side: mk('side'), bolt: mk('bolt') };
}

const edgeCache = new WeakMap<BufferGeometry, EdgesGeometry>();
/** Hard edges of a piece (the coloured outline of the sheet). */
function edgesOf(g: BufferGeometry) { let e = edgeCache.get(g); if (!e) { e = new EdgesGeometry(g, 24); edgeCache.set(g, e); } return e; }

function Box({ p, s, c = 0.04, mat }: { p: V3; s: V3; c?: number; mat: MeshStandardMaterial }) {
  const g = armourBox(s[0], s[1], s[2], c * 5);
  return <><mesh position={p} geometry={g} material={mat} castShadow receiveShadow />{mat.userData.wire && <lineSegments position={p} geometry={edgesOf(g)} material={mat.userData.wire} />}</>;
}
function Plate({ p, pts, depth, bevel, mat, flip = false }: { p: V3; pts: [number, number][]; depth: number; bevel?: number; mat: MeshStandardMaterial; flip?: boolean }) {
  const g = plate(pts, depth, bevel);
  return <><mesh position={p} rotation={[0, flip ? Math.PI : 0, 0]} geometry={g} material={mat} castShadow receiveShadow />{mat.userData.wire && <lineSegments position={p} rotation={[0, flip ? Math.PI : 0, 0]} geometry={edgesOf(g)} material={mat.userData.wire} />}</>;
}

type BoltAxis = 'x' | 'y' | 'z';
/** Hex bolt heads in one draw call: (x, y, z, axis it points along). */
function Bolts({ pts, mat }: { pts: [number, number, number, BoltAxis][]; mat: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new Matrix4(); const q = new Quaternion(); const e = new Euler(); const one = new Vector3(1, 1, 1);
    pts.forEach(([x, y, z, a], i) => { q.setFromEuler(a === 'y' ? e.set(0, 0, 0) : a === 'z' ? e.set(Math.PI / 2, 0, 0) : e.set(0, 0, -Math.PI / 2)); ref.current.setMatrixAt(i, m.compose(new Vector3(x, y, z), q, one)); });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [pts]);
  return <instancedMesh ref={ref} args={[undefined, undefined, pts.length]} material={mat} castShadow receiveShadow frustumCulled={false}><cylinderGeometry args={[0.05, 0.057, 0.05, 6]} /></instancedMesh>;
}

const sg = [-1, 1];

export type Only = ModuleKind | 'lock1' | 'corner1' | 'corner2' | 'handle1' | 'panel1';

/** The plate outline of the big front panel: top edge with a shallow trapezoid notch in the middle, 45 degree cut lower corners. */
function bigPlate(a: number, b: number, cut: number, notchHalf: number, notchDip: number): [number, number][] {
  const n = notchHalf, s = notchHalf - 0.12;
  return [[-a + cut, -b], [a - cut, -b], [a, -b + cut], [a, b], [n, b], [s, b - notchDip], [-s, b - notchDip], [-n, b], [-a, b], [-a, -b + cut]];
}

/** `only` shows just one module kind in place (lid, bottom, body, side ...) or one single piece centred on the origin (lock1, corner1, corner2, handle1, panel1). */
export function CaseSkeleton({ skin = {}, debug = false, wire = false, lidAngle = 0, explode = 0, lidRef, only, stone = false }: { skin?: Skin; debug?: boolean; wire?: boolean; lidAngle?: number; explode?: number; lidRef?: React.RefObject<Group>; only?: Only; stone?: boolean }) {
  const { w, d, bottomH, bodyH, lidH } = CASE_DIM; const hx = w / 2, hz = d / 2; const seam = bottomH + bodyH; const mids = bottomH + bodyH / 2;
  const m = useMemo(() => stone ? stoneMaterials(wire) : makeMaterials(skin, debug, wire), [skin, debug, wire, stone]);
  const e = explode;
  const PW = 0.62, PD = 0.56;                    // footprint of an edge post (x, z)
  const cx = hx - PW / 2, cz = hz - PD / 2;      // centres of the posts
  const PA = 1.7, PY0 = bottomH + 0.14, PY1 = seam - 0.04;   // half width and bottom / top of the big front plate
  const PB = (PY1 - PY0) / 2, PY = (PY1 + PY0) / 2;
  const FRAME = useMemo(() => bigPlate(PA + 0.1, PB + 0.1, 0.3, 0.82, 0.1), [PB]);
  const PLATE = useMemo(() => bigPlate(PA, PB, 0.26, 0.74, 0.09), [PB]);
  const INNER = useMemo(() => bigPlate(PA - 0.14, PB - 0.12, 0.2, 0.7, 0.08), [PB]);
  const LX = 2.15;                                // x of the locks
  const NP = 2.13;                                // x of the narrow panels beside the plate

  const bolts = useMemo(() => {
    const out: [number, number, number, BoltAxis][] = [];
    for (const x of sg) for (const z of sg) {
      out.push([x * (cx - 0.05), bottomH + 0.2, z * (hz + 0.02), 'z'], [x * (hx + 0.02), bottomH + 0.2, z * (cz - 0.05), 'x']);
      out.push([x * LX, seam - 0.74, z * (hz + 0.12), 'z']);
    }
    for (const z of sg) for (const x of sg) for (const y of [PY0 + 0.1, PY1 - 0.12]) out.push([x * (PA - 0.06), y, z * (hz + 0.1), 'z']);
    for (const x of sg) for (const y of [mids - 0.38, mids + 0.3]) for (const dz of sg) out.push([x * (hx + 0.03), y, dz * 0.42, 'x']);
    return out;
  }, [cx, cz, seam, bottomH, hz, hx, PA, PY0, PY1, mids]);
  const lidBolts = useMemo(() => {
    const out: [number, number, number, BoltAxis][] = [];
    for (const x of [-1.8, -0.6, 0.6, 1.8]) for (const z of sg) out.push([x, lidH + 0.03, z * 0.3, 'y']);
    return out;
  }, [lidH]);

  // the lock is 0.8 tall (seam - 0.41 .. seam + 0.4): a stepped top bar, two stacked boxes with inset faces, a tapering hook and two wing straps that lean in at the foot
  const WING_R: [number, number][] = [[-0.05, 0], [0.05, 0], [0.05, -0.45], [-0.02, -0.58], [-0.05, -0.5]];
  const WING_L: [number, number][] = WING_R.map(([a, b]) => [-a, b]);
  const lockJsx = (x: number, z: number) => { const zf = z * (hz + 0.05), top = seam + 0.4, cxl = x * LX; return <>
    <Box p={[cxl, top - 0.075, zf + z * 0.05]} s={[0.5, 0.15, 0.3]} c={0.05} mat={m.lock} />
    <Box p={[cxl, top - 0.01, zf + z * 0.03]} s={[0.36, 0.08, 0.2]} c={0.025} mat={m.lock} />
    <Box p={[cxl, top - 0.28, zf + z * 0.02]} s={[0.38, 0.26, 0.22]} c={0.04} mat={m.lock} />
    <Box p={[cxl, top - 0.28, zf + z * 0.14]} s={[0.26, 0.17, 0.06]} c={0.03} mat={m.lock} />
    <Box p={[cxl, top - 0.535, zf + z * 0.02]} s={[0.38, 0.25, 0.22]} c={0.04} mat={m.lock} />
    <Box p={[cxl, top - 0.535, zf + z * 0.14]} s={[0.26, 0.16, 0.06]} c={0.03} mat={m.lock} />
    <Box p={[cxl, top - 0.74, zf + z * 0.0]} s={[0.3, 0.15, 0.2]} c={0.05} mat={m.lock} />
    {sg.map(s => <Plate key={s} p={[cxl + s * 0.24, top - 0.2, zf + z * 0.02]} pts={s > 0 ? WING_R : WING_L} depth={0.28} bevel={0.02} mat={m.lock} flip={z < 0} />)}
  </>; };
  // top corners: a gold octagon at the front right (and the back right); at the left a red chamfered cap with a small gold bracket under it
  const cornerTopJsx = (x: number, z: number) => x !== 0 ? <>
    <Box p={[x * (hx - 0.46), seam + 0.2, z * (hz - 0.37)]} s={[0.92, 0.46, 0.74]} c={0.2} mat={m.corner} />
    <Box p={[x * (hx - 0.46), seam + 0.3, z * (hz - 0.37)]} s={[0.6, 0.12, 0.5]} c={0.04} mat={m.corner} />
  </> : <>
    <Box p={[x * (hx - 0.31), seam + 0.18, z * (hz - 0.31)]} s={[0.62, 0.5, 0.62]} c={0.14} mat={m.lid} />
    <Box p={[x * (hx - 0.2), seam - 0.26, z * (hz - 0.06)]} s={[0.4, 0.4, 0.1]} c={0.04} mat={m.corner} />
  </>;
  const handleJsx = <>
    <Box p={[hx - 0.0, mids + 0.0, 0]} s={[0.06, 0.42, 0.74]} c={0.01} mat={m.handle} />
    <mesh position={[hx + 0.03, mids + 0.0, 0]} geometry={roundedRing(0.92, 0.64, 0.64, 0.38, 0.1)} material={m.handle} castShadow receiveShadow />
  </>;
  const baseCornerJsx = (x: number, z: number) => <>
    <Box p={[x * (hx - 0.42), 0.25, z * (hz - 0.34)]} s={[0.84, 0.5, 0.68]} c={0.17} mat={m.corner} />
    <Box p={[x * (hx - 0.42), 0.27, z * (hz - 0.34 + 0.0)]} s={[0.5, 0.3, 0.74]} c={0.05} mat={m.corner} />
  </>;
  // a single module on its own, centred on the origin (the "separate modules" row of the sheet)
  if (only === 'lock1') return <group position={[-LX, -(seam - 0.2), -hz]}>{lockJsx(1, 1)}</group>;
  if (only === 'corner1') return <group position={[-(hx - 0.46), -seam, -(hz - 0.37)]}>{cornerTopJsx(1, 1)}</group>;
  if (only === 'corner2') return <group position={[-(hx - 0.42), -0.25, -(hz - 0.34)]}>{baseCornerJsx(1, 1)}</group>;
  if (only === 'handle1') return <group position={[-hx, -mids, 0]}>{handleJsx}</group>;
  if (only === 'panel1') return <group position={[-hx, -mids, 0]}>
    <Box p={[hx - 0.06, mids, 0]} s={[0.1, bodyH - 0.3, 2 * (cz - PD / 2)]} c={0.025} mat={m.side} />
    <Box p={[hx - 0.01, mids - 0.04, 0]} s={[0.06, bodyH - 0.7, 2 * (cz - PD / 2 - 0.06)]} c={0.02} mat={m.side} />
  </group>;
  const show = (k: ModuleKind) => !only || only === k;

  return <group>
    {/* BOTTOM: a low base band, a little proud of the body, with a stepped top edge and an inlaid rail on each long face */}
    <group position={[0, -0.6 * e, 0]} visible={show('bottom')}>
      <Box p={[0, bottomH / 2, 0]} s={[w, bottomH, d]} c={0.07} mat={m.bottom} />
      <Box p={[0, bottomH - 0.02, 0]} s={[w - 0.1, 0.07, d - 0.1]} c={0.025} mat={m.bottom} />
      {sg.map(z => <Box key={`br${z}`} p={[0, bottomH / 2 - 0.01, z * (hz + 0.025)]} s={[w - 2.0, 0.12, 0.06]} c={0.02} mat={m.bottom} />)}
      {sg.map(z => <Box key={`bt${z}`} p={[0, bottomH / 2 - 0.01, z * (hz + 0.06)]} s={[1.5, 0.06, 0.06]} c={0.02} mat={m.bottom} />)}
    </group>

    {/* BODY: the central shell set back from the posts; on each long face the big plate in a frame, narrow plates beside it, the lower rail and the top rail band with its two slotted end blocks */}
    <group visible={show('body')}>
      <Box p={[0, mids, 0]} s={[w - 0.12, bodyH, d - 0.12]} c={0.06} mat={m.body} />
      {sg.map(z => <group key={`face${z}`} position={[0, 0, z * 0.55 * e]}>
        <Plate p={[0, PY, z * (hz - 0.07)]} pts={FRAME} depth={0.06} mat={m.body} flip={z < 0} />
        <Plate p={[0, PY, z * (hz - 0.04)]} pts={PLATE} depth={0.07} mat={m.body} flip={z < 0} />
        <Plate p={[0, PY, z * (hz - 0.01)]} pts={INNER} depth={0.04} bevel={0.012} mat={m.body} flip={z < 0} />
        {sg.map(x => <group key={`np${x}`}>
          <Box p={[x * NP, PY0 + 0.5, z * (hz - 0.04)]} s={[0.4, 1.0, 0.07]} c={0.025} mat={m.body} />
          <Box p={[x * NP, PY0 + 0.4, z * (hz - 0.0)]} s={[0.28, 0.72, 0.04]} c={0.015} mat={m.body} />
        </group>)}
        {/* the rail band: a long low box with a chamfered top edge, a flat grid middle and a raised, slotted block at each end */}
        <Box p={[0, seam + 0.16, z * (hz + 0.0)]} s={[w - 1.3, 0.64, 0.1]} c={0.05} mat={m.body} />
        {sg.map(x => <group key={`rb${x}`}>
          <Box p={[x * 1.5, seam + 0.27, z * (hz + 0.04)]} s={[0.72, 0.62, 0.14]} c={0.08} mat={m.body} />
          <Box p={[x * 1.5, seam + 0.5, z * (hz + 0.12)]} s={[0.42, 0.07, 0.04]} c={0.02} mat={m.bolt} />
        </group>)}
      </group>)}
    </group>

    {/* SIDE: four tall edge posts (the green strips of the sheet), between the base guards and the top guards; on each end a panel between them */}
    <group visible={show('side')}>
      {sg.flatMap(x => sg.map(z => <Box key={`post${x}${z}`} p={[x * cx * (1 + 0.45 * e), mids + 0.02, z * cz * (1 + 0.9 * e)]} s={[PW, bodyH - 0.05, PD]} c={0.1} mat={x < 0 && z > 0 ? m.body : m.side} />))}
      {sg.map(x => <group key={`end${x}`} position={[x * 0.8 * e, 0, 0]} rotation={[0, x < 0 ? Math.PI : 0, 0]}>
        <Box p={[hx - 0.06, mids, 0]} s={[0.1, bodyH - 0.3, 2 * (cz - PD / 2 - 0.0)]} c={0.025} mat={m.side} />
        <Box p={[hx - 0.01, mids - 0.04, 0]} s={[0.06, bodyH - 0.7, 2 * (cz - PD / 2 - 0.06)]} c={0.02} mat={m.side} />
      </group>)}
    </group>

    {/* BASE CORNERS: four octagonal guards at the foot of the posts */}
    {sg.flatMap(x => sg.map(z => <group key={`c${x}${z}`} position={[x * 0.9 * e, -0.3 * e, z * 0.9 * e]} visible={show('corner')}>{baseCornerJsx(x, z)}</group>))}

    {/* LOCKS: two on each long side, beside the big plate: a frame with an upper block astride the rim, two stacked boxes and wing straps */}
    {sg.flatMap(z => sg.map(x => <group key={`l${x}${z}`} position={[0, 0, z * 1.1 * e]} visible={show('lock')}>{lockJsx(x, z)}</group>))}

    {/* HANDLES: a recessed handle on each end: a landscape rounded frame, a dark recess behind it */}
    {sg.map(x => <group key={`h${x}`} position={[x * 1.2 * e, 0, 0]} rotation={[0, x < 0 ? Math.PI : 0, 0]} visible={show('handle')}>{handleJsx}</group>)}
    {!only && <Bolts pts={bolts} mat={m.bolt} />}

    {/* LID (the top cap): a shallow slab with a stepped rim and raised top panels at different heights with open seams, hinge knuckles; the gold corner caps ride with it; hinged on the back */}
    <group position={[0, seam - 0.1 + 0.9 * e, -hz]} visible={show('lid')}>
      <group ref={lidRef} rotation={[-lidAngle, 0, 0]}>
        <group position={[0, 0, hz]}>
          <Box p={[0, 0.17, 0]} s={[w, 0.34, d]} c={0.08} mat={m.lid} />
          {sg.map(z => <Box key={`rf${z}`} p={[0, 0.35, z * (hz - 0.09)]} s={[w - 1.7, 0.12, 0.18]} c={0.04} mat={m.lid} />)}
          {sg.map(x => <Box key={`re${x}`} p={[x * (hx - 0.09), 0.35, 0]} s={[0.18, 0.12, d - 0.7]} c={0.04} mat={m.lid} />)}
          <Box p={[0, 0.4, 0]} s={[2.2, 0.11, d - 1.1]} c={0.04} mat={m.lid} />
          {sg.map(x => <Box key={`pm${x}`} p={[x * 1.82, 0.38, 0]} s={[1.1, 0.09, d - 1.1]} c={0.035} mat={m.lid} />)}
          <Bolts pts={lidBolts} mat={m.bolt} />
        </group>
      </group>
    </group>
    {sg.flatMap(x => sg.map(z => <group key={`tc${x}${z}`} position={[x * 0.9 * e, 0.9 * e, z * 0.9 * e]} visible={show('corner')}>{cornerTopJsx(x, z)}</group>))}
  </group>;
}
