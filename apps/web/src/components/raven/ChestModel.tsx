import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import { CanvasTexture, DoubleSide, Euler, ExtrudeGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Shape, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry, Group } from 'three';
import { darkStoneTextures } from './textures';
import { useReferenceMaps } from './referenceMaps';
import type { RefMaps } from './referenceMaps';

/**
 * CASECROW raven case. 1 unit ≈ 0.28 m.
 * Body footprint 4.45 (x) × 2.18 (z). The +z face is the long front (raven relief + logo plate),
 * the +x face is the short end with the carry handle. The lid hinges on the back-top edge (group "lid").
 * Built from real armour: chamfered boxes for the shell, the corner posts and blocks, the bands, the lid, the raised ribs and the clasps,
 * hex bolts, a recessed handle with its stands. Every part has its own box-mapped UVs (texture density is the same on every face), the
 * chamfers are lighter like worn edges, and nothing is projected from a camera. The only picture on the case is the logo, a clean decal.
 */
export const CHEST = { w: 4.45, d: 2.18, bodyH: 1.7, lidH: 0.55 } as const;

type V3 = [number, number, number];

const cache = new Map<string, BufferGeometry>();
/** Box of exactly w×h×d with 45° chamfered edges of size c, with box-mapped UVs and a wear tint on the chamfers. */
function armourBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const key = [w, h, d, c].map(n => n.toFixed(3)).join('/');
  let g = cache.get(key);
  if (g) return g;
  c = Math.min(c, w / 2.2, h / 2.2, d / 2.2);
  const s = new Shape(); const hw = w / 2 - c, hh = h / 2 - c;
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
  g = new ExtrudeGeometry(s, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -(d - 2 * c) / 2); g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'); const uv = new Float32Array(pos.count * 2), col = new Float32Array(pos.count * 3);
  const TILE = 1.6; // world units per texture repeat
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i)); const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (nz >= nx && nz >= ny) { uv[i * 2] = x / TILE; uv[i * 2 + 1] = y / TILE; } else if (nx >= ny) { uv[i * 2] = z / TILE; uv[i * 2 + 1] = y / TILE; } else { uv[i * 2] = x / TILE; uv[i * 2 + 1] = z / TILE; }
    const flat = Math.max(nx, ny, nz) > 0.95; const t = flat ? 0.7 : 1.9; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t; // chamfers read lighter, like worn edges
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  cache.set(key, g); return g;
}

let metal: MeshStandardMaterial | null = null; let plate: MeshStandardMaterial | null = null;
/** Worn dark stone-metal for the armour, and a smoother, slightly warmer satin for the panels that carry the logo and the handle. */
function materials() {
  if (!metal) {
    const t = darkStoneTextures(3, 1);
    metal = new MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.6, color: '#ffffff', vertexColors: true, roughness: 0.56, metalness: 0.38 });
    plate = new MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.7, color: '#8f8a84', vertexColors: true, roughness: 0.7, metalness: 0.18 });
  }
  return { metal: metal!, plate: plate! };
}

function Part({ p, s, c = 0.04, panel = false }: { p: V3; s: V3; c?: number; panel?: boolean }) {
  const m = materials();
  return <mesh position={p} geometry={armourBox(s[0], s[1], s[2], c)} material={panel ? m.plate : m.metal} castShadow receiveShadow />;
}

type BoltAxis = 'x' | 'y' | 'z';
/** Hex bolt heads, one draw call. Each is (x, y, z, axis it points along). */
function Bolts({ pts }: { pts: [number, number, number, BoltAxis][] }) {
  const ref = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new Matrix4(); const q = new Quaternion(); const e = new Euler(); const one = new Vector3(1, 1, 1);
    pts.forEach(([x, y, z, a], i) => { q.setFromEuler(a === 'y' ? e.set(0, 0, 0) : a === 'z' ? e.set(Math.PI / 2, 0, 0) : e.set(0, 0, -Math.PI / 2)); ref.current.setMatrixAt(i, m.compose(new Vector3(x, y, z), q, one)); });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [pts]);
  return <instancedMesh ref={ref} args={[undefined, undefined, pts.length]} castShadow receiveShadow frustumCulled={false}>
    <cylinderGeometry args={[0.05, 0.056, 0.05, 6]} /><meshStandardMaterial color="#8c8983" metalness={0.85} roughness={0.36} />
  </instancedMesh>;
}

/** The logo, cut cleanly out of the reference (bright raven on the dark panel) into an alpha decal: no projection, no background. */
function Logo({ maps, position, size }: { maps: RefMaps; position: V3; size: [number, number] }) {
  const tex = useMemo(() => {
    const img = maps.image; const k = img.naturalWidth / 1254;
    const sx = 575 * k, sy = 490 * k, sw = 300 * k, sh = 315 * k;
    const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh); const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const data = g.getImageData(0, 0, c.width, c.height); const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3; const a = Math.min(1, Math.max(0, (l - 108) / 52)); // bright shape -> opaque, dark panel -> clear
      d[i] = 236; d[i + 1] = 230; d[i + 2] = 218; d[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
    }
    g.putImageData(data, 0, 0);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; return t;
  }, [maps]);
  return <mesh position={position} renderOrder={2}>
    <planeGeometry args={size} /><meshStandardMaterial map={tex} color="#a9a499" transparent depthWrite={false} roughness={0.78} metalness={0.05} polygonOffset polygonOffsetFactor={-2} side={DoubleSide} />
  </mesh>;
}

export const ChestModel = forwardRef<Group, { lidRef: React.RefObject<Group>; latchRef: React.RefObject<Group> }>(function ChestModel({ lidRef, latchRef }, ref) {
  const { w, d, bodyH, lidH } = CHEST;
  const hx = w / 2, hz = d / 2;
  const maps = useReferenceMaps();
  const sx = [-1, 1];
  const cornerX = hx - 0.2, cornerZ = hz - 0.2;

  const bodyBolts = useMemo(() => {
    const out: [number, number, number, BoltAxis][] = [];
    for (const x of sx) for (const z of sx) {
      const bx = x * cornerX, bz = z * cornerZ;
      out.push([bx, bodyH - 0.17, z * (cornerZ + 0.33), 'z'], [x * (cornerX + 0.33), bodyH - 0.17, bz, 'x']); // top blocks, on the face and on the end
      if (!(x === -1 && z === 1)) out.push([bx, 0.21, z * (cornerZ + 0.33), 'z'], [x * (cornerX + 0.33), 0.21, bz, 'x']); // bottom blocks
    }
    for (const px of [-0.25, 1.75]) for (const py of [0.32, 1.5]) out.push([px, py, hz + 0.085, 'z']); // corners of the logo frame
    for (const pz of [-0.5, 0.5]) for (const py of [0.45, 1.4]) out.push([hx + 0.085, py, pz, 'x']); // corners of the handle frame
    return out;
  }, [cornerX, cornerZ, bodyH, hx, hz]); // eslint-disable-line react-hooks/exhaustive-deps

  const lidBolts = useMemo(() => {
    const out: [number, number, number, BoltAxis][] = [];
    for (const x of sx) for (const z of sx) out.push([x * (hx - 0.12), lidH + 0.085, hz + z * (hz - 0.12), 'y']);
    for (const x of [-1.5, -0.5, 0.5, 1.5]) for (const z of sx) out.push([x, lidH + 0.12, hz + z * (d / 2 - 0.3), 'y']);
    return out;
  }, [hx, hz, lidH, d]); // eslint-disable-line react-hooks/exhaustive-deps

  return <group ref={ref}>
    {/* body shell, a band under the lid and a skirt at the foot */}
    <Part p={[0, bodyH / 2, 0]} s={[w, bodyH, d]} c={0.07} />
    <Part p={[0, bodyH - 0.09, 0]} s={[w + 0.1, 0.18, d + 0.1]} c={0.05} />
    <Part p={[0, 0.12, 0]} s={[w + 0.1, 0.24, d + 0.1]} c={0.05} />
    {/* corner posts and bulky corner blocks (the front-left corner is wrapped by the raven) */}
    {sx.flatMap(x => sx.map(z => <group key={`${x}${z}`}>
      {!(x === -1 && z === 1) && <Part p={[x * cornerX, bodyH / 2, z * cornerZ]} s={[0.5, bodyH - 0.4, 0.5]} c={0.09} />}
      {!(x === -1 && z === 1) && <Part p={[x * cornerX, 0.21, z * cornerZ]} s={[0.66, 0.42, 0.66]} c={0.1} />}
      <Part p={[x * cornerX, bodyH - 0.17, z * cornerZ]} s={[0.66, 0.34, 0.66]} c={0.1} />
    </group>))}
    {/* the front plate for the logo, in a raised frame */}
    <Part p={[0.75, 0.91, hz + 0.012]} s={[2.0, 1.17, 0.025]} c={0.008} panel />
    <Part p={[0.75, 1.5, hz + 0.03]} s={[2.09, 0.09, 0.09]} c={0.03} />
    <Part p={[0.75, 0.32, hz + 0.03]} s={[2.09, 0.09, 0.09]} c={0.03} />
    <Part p={[-0.25, 0.91, hz + 0.03]} s={[0.09, 1.27, 0.09]} c={0.03} />
    <Part p={[1.75, 0.91, hz + 0.03]} s={[0.09, 1.27, 0.09]} c={0.03} />
    {maps && <Logo maps={maps} position={[0.95, 0.9, hz + 0.034]} size={[1.08, 1.13]} />}
    {/* the handle end: a recessed panel in a frame, two stands and the bar */}
    <Part p={[hx + 0.012, 0.925, 0]} s={[0.025, 0.93, 0.96]} c={0.008} panel />
    <Part p={[hx + 0.03, 1.4, 0]} s={[0.09, 0.09, 1.1]} c={0.03} />
    <Part p={[hx + 0.03, 0.45, 0]} s={[0.09, 0.09, 1.1]} c={0.03} />
    <Part p={[hx + 0.03, 0.925, -0.5]} s={[0.09, 0.95, 0.09]} c={0.03} />
    <Part p={[hx + 0.03, 0.925, 0.5]} s={[0.09, 0.95, 0.09]} c={0.03} />
    <Part p={[hx + 0.13, 0.925, -0.34]} s={[0.2, 0.15, 0.1]} c={0.03} />
    <Part p={[hx + 0.13, 0.925, 0.34]} s={[0.2, 0.15, 0.1]} c={0.03} />
    <mesh position={[hx + 0.2, 0.925, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><capsuleGeometry args={[0.05, 0.62, 4, 12]} /><meshStandardMaterial color="#2a2927" roughness={0.45} metalness={0.7} /></mesh>
    <Bolts pts={bodyBolts} />
    {/* open-state interior: plain dark lining */}
    <mesh position={[0, bodyH + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w - 0.1, d - 0.1]} /><meshStandardMaterial color="#14130f" roughness={0.95} /></mesh>
    <mesh position={[0, bodyH + 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w - 0.75, d - 0.75]} /><meshStandardMaterial color="#060606" roughness={1} /></mesh>
    {/* lid: a thick faceted slab hinged on the back-top edge, with a raised plate, segmented ribs and heavy corner caps */}
    <group ref={lidRef} position={[0, bodyH, -hz]}>
      <Part p={[0, lidH / 2, hz]} s={[w + 0.12, lidH, d + 0.12]} c={0.12} />
      <mesh position={[0, -0.006, hz]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w + 0.08, d + 0.08]} /><meshStandardMaterial color="#0d0c0b" roughness={0.95} /></mesh>
      <Part p={[0, lidH + 0.03, hz]} s={[w - 1.3, 0.07, d - 0.7]} c={0.03} panel />
      {[-1.5, -0.5, 0.5, 1.5].map(x => <Part key={x} p={[x, lidH + 0.05, hz]} s={[0.34, 0.1, d - 0.3]} c={0.035} />)}
      {sx.flatMap(x => sx.map(z => <Part key={`${x}${z}`} p={[x * (hx - 0.12), (lidH + 0.08) / 2, hz + z * (hz - 0.12)]} s={[0.62, lidH + 0.08, 0.62]} c={0.11} />))}
      <Bolts pts={lidBolts} />
    </group>
    {/* clasps over the seam on the front: they flip open when the case unlocks */}
    <group ref={latchRef} position={[0, bodyH + 0.05, hz + 0.1]}>
      {[1.05, 1.5].map(x => <group key={x}>
        <Part p={[x, 0.03, 0.04]} s={[0.3, 0.5, 0.12]} c={0.035} />
        <Part p={[x, -0.08, 0.115]} s={[0.2, 0.14, 0.05]} c={0.02} panel />
      </group>)}
      <Bolts pts={[[1.05, 0.2, 0.115, 'z'], [1.5, 0.2, 0.115, 'z']]} />
    </group>
  </group>;
});
