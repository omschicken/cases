import { forwardRef, useMemo } from 'react';
import { ExtrudeGeometry, Shape } from 'three';
import type { BufferGeometry, Group } from 'three';
import { darkStoneTextures } from './textures';
import { bakeProjectedUV, heroCamera, subdivide, useReferenceMaps } from './referenceMaps';
import { CAMERA } from './sceneConfig';

/**
 * CASECROW raven case. 1 unit ≈ 0.28 m.
 * Body footprint 4.45 (x) × 2.18 (z). The +z face is the long front (raven relief + logo plate),
 * the +x face is the short end with the carry handle. The lid hinges on the back-top edge (group "lid").
 * All hard parts are chamfered boxes: the reference case is a faceted armoured shell, not a rounded one.
 * Surface detail (panel seams, logo, handle, bolts, wear) is the reference's own, baked onto these parts through UVs,
 * so it can never drift against the geometry: no separate decals or marker meshes sit on top of it.
 */
export const CHEST = { w: 4.45, d: 2.18, bodyH: 1.7, lidH: 0.55 } as const;

type V3 = [number, number, number];
type Kind = 'stone' | 'armor';

const cache = new Map<string, BufferGeometry>();
/** Box of exactly w×h×d with 45° chamfered edges of size c. */
function chamferBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const key = [w, h, d, c].map(n => n.toFixed(3)).join('/');
  let g = cache.get(key);
  if (!g) {
    c = Math.min(c, w / 2.2, h / 2.2, d / 2.2);
    const s = new Shape(); const hw = w / 2 - c, hh = h / 2 - c;
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
    g = new ExtrudeGeometry(s, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1, steps: 1 });
    g.translate(0, 0, -(d - 2 * c) / 2); g.computeVertexNormals(); cache.set(key, g);
  }
  return g;
}

/** Chamfered box, finely tessellated once per size (parts of the same size share the work). */
const fine = new Map<string, BufferGeometry>();
function fineChamferBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const key = [w, h, d, c].map(n => n.toFixed(3)).join('/');
  let g = fine.get(key);
  if (!g) { g = subdivide(chamferBox(w, h, d, c), 0.16); fine.set(key, g); }
  return g;
}

function Mat({ kind, plain = false }: { kind: Kind; plain?: boolean }) {
  const tex = useMemo(() => darkStoneTextures(kind === 'stone' ? 3 : 9, kind === 'stone' ? 1.5 : 2), [kind]);
  const ref = useReferenceMaps();
  // `plain` parts (the raised ribs and plates on the lid) use dark worn metal: the projected reference texture is only right from the hero view and showed as pale flat slabs from the site camera
  if (ref && !plain) return <meshStandardMaterial map={ref.body} normalMap={ref.normal} normalScale={[0.7, 0.7] as unknown as never}
    color={kind === 'armor' ? '#f1ede6' : '#ffffff'} roughness={kind === 'armor' ? 0.5 : 0.62} metalness={kind === 'armor' ? 0.5 : 0.25} />;
  // fallback while the reference textures are still being prepared
  return <meshStandardMaterial map={tex.map} bumpMap={tex.bump} bumpScale={kind === 'stone' ? 2.4 : 1.6}
    color={kind === 'armor' ? '#9a968f' : '#ffffff'} roughness={kind === 'armor' ? 0.46 : 0.6} metalness={kind === 'armor' ? 0.6 : 0.3} />;
}

const HERO = heroCamera(CAMERA.position, CAMERA.target, CAMERA.fov);
const ZERO: V3 = [0, 0, 0];

function P({ p, s, c = 0.03, k, o = ZERO, plain = false }: { p: V3; s: V3; c?: number; k: Kind; o?: V3; plain?: boolean }) {
  const geometry = useMemo(
    () => bakeProjectedUV(fineChamferBox(s[0], s[1], s[2], c), [p[0] + o[0], p[1] + o[1], p[2] + o[2]], HERO),
    [s[0], s[1], s[2], c, p[0], p[1], p[2], o[0], o[1], o[2]], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <mesh position={p} geometry={geometry} castShadow receiveShadow><Mat kind={k} plain={plain} /></mesh>;
}

export const ChestModel = forwardRef<Group, { lidRef: React.RefObject<Group>; latchRef: React.RefObject<Group> }>(function ChestModel({ lidRef, latchRef }, ref) {
  const { w, d, bodyH, lidH } = CHEST;
  const hx = w / 2, hz = d / 2;
  const sx = [-1, 1];
  const LID: V3 = [0, bodyH, -hz];
  return <group ref={ref}>
    {/* body shell */}
    <P p={[0, bodyH / 2, 0]} s={[w, bodyH, d]} c={0.06} k="stone" />
    {/* corner posts: full-height chamfered armour */}
    {sx.flatMap(x => sx.map(z => <group key={`${x}${z}`}>
      <P p={[x * (hx - 0.12), bodyH / 2, z * (hz - 0.12)]} s={[0.42, bodyH - 0.06, 0.42]} c={0.07} k="armor" />
      {!(x === -1 && z === 1) && <P p={[x * (hx - 0.12), 0.2, z * (hz - 0.12)]} s={[0.5, 0.4, 0.5]} c={0.08} k="armor" />}
      <P p={[x * (hx - 0.12), bodyH - 0.1, z * (hz - 0.12)]} s={[0.5, 0.26, 0.5]} c={0.07} k="armor" />
    </group>))}
    {/* open-state interior: the projected texture is only valid from the hero view, so the opened top is plain dark lining */}
    <mesh position={[0, bodyH + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w - 0.1, d - 0.1]} /><meshStandardMaterial color="#14130f" roughness={0.95} /></mesh>
    <mesh position={[0, bodyH + 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w - 0.75, d - 0.75]} /><meshStandardMaterial color="#060606" roughness={1} /></mesh>
    {/* carry handle frame on the +x end */}
    <P p={[hx + 0.012, bodyH * 0.58, 0]} s={[0.07, 0.86, 0.9]} c={0.025} k="armor" />
    {/* lid: faceted slab hinged on the back-top edge */}
    <group ref={lidRef} position={[0, bodyH, -hz]}>
      <P p={[0, lidH * 0.5, hz]} s={[w + 0.12, lidH, d + 0.12]} c={0.14} k="stone" o={LID} />
      {/* underside of the lid, seen when it is open */}
      <mesh position={[0, -0.006, hz]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w + 0.08, d + 0.08]} /><meshStandardMaterial color="#0d0c0b" roughness={0.95} /></mesh>
      {/* raised segmented ribs across the lid */}
      {[-1.75, -0.55, 0.65, 1.75].map(x => <P key={x} p={[x, lidH + 0.05, hz]} s={[0.32, 0.12, d - 0.2]} c={0.04} k="armor" o={LID} plain />)}
      {[-0.7, 0.9].map(x => <P key={x} p={[x, lidH + 0.03, hz]} s={[1.05, 0.08, d - 0.7]} c={0.03} k="stone" o={LID} plain />)}
      {/* end caps of the lid, over the corner posts */}
      {sx.flatMap(x => sx.map(z => <P key={`${x}${z}`} p={[x * (hx - 0.1), lidH * 0.5, hz + z * (hz - 0.1)]} s={[0.5, lidH + 0.04, 0.5]} c={0.1} k="armor" o={LID} />))}
    </group>
    {/* latch pivot kept for the unlock animation; the latch plates are part of the baked surface detail */}
    <group ref={latchRef} position={[0, bodyH + 0.05, hz + 0.1]} />
  </group>;
});
