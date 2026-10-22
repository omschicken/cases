import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MathUtils, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { basis, featherGeometry } from './Raven3D';
import { darkStoneTextures } from './textures';
import { CHEST } from './ChestModel';

/**
 * The raven carved on the case, as real geometry: a big round head with an eye and a hooked beak standing out of the front, and a coat
 * of about a thousand overlapping feathers that flow down and to the left from the neck, lift at the tips, and wrap around the left
 * corner of the case. Feathers are small near the head and long at the bottom. Everything is deterministic and drawn in a few draw calls.
 */
const Z0 = CHEST.d / 2 + 0.05, X0 = -CHEST.w / 2 - 0.05, R = 0.2; // the front plane, the left end plane and the radius of the rounded corner
const HEAD_S = -0.95, HEAD_Y = 1.5;                                  // where the head sits on the front face
const UP = new Vector3(0, 1, 0);

/** A point on the case surface as one parameter s along the front and round the left corner, and the height y. */
function surf(s: number, y: number) {
  const cx = X0 + R, cz = Z0 - R;
  if (s >= cx) return { p: new Vector3(s, y, Z0), n: new Vector3(0, 0, 1), t: new Vector3(1, 0, 0) };
  const a = cx - s;
  if (a <= (Math.PI * R) / 2) { const th = a / R; return { p: new Vector3(cx - R * Math.sin(th), y, cz + R * Math.cos(th)), n: new Vector3(-Math.sin(th), 0, Math.cos(th)), t: new Vector3(Math.cos(th), 0, Math.sin(th)) }; }
  return { p: new Vector3(X0, y, cz - (a - (Math.PI * R) / 2)), n: new Vector3(-1, 0, 0), t: new Vector3(0, 0, 1) };
}

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** The plumage: rows from the top of the body to the bottom, each feather oriented along the flow of the coat. */
function buildCoat() {
  const r = rng(2024); const mats: Matrix4[] = []; const tints: number[] = [];
  const body = { cs: -1.55, cy: 1.0, rs: 1.3, ry: 1.05 };
  const along = new Vector3(), nor = new Vector3(), t = new Vector3();
  let row = 0; const total = 22;
  for (let y = 1.62; y > 0.1; row++) {
    const down = MathUtils.clamp((1.62 - y) / 1.5, 0, 1); y -= MathUtils.lerp(0.12, 0.26, down) * (0.9 + r() * 0.2);
    let s = 0.1;
    while (s > -2.95) {
      const dHead = Math.hypot(s - HEAD_S, (y - HEAD_Y) * 1.1);
      const L = 0.32 + 0.58 * MathUtils.clamp(dHead / 1.7, 0, 1) + (r() - 0.5) * 0.08; const W = L * 0.36;
      s -= W * (0.75 + r() * 0.25);
      const e = ((s - body.cs) / body.rs) ** 2 + ((y - body.cy) / body.ry) ** 2;
      if (e > 1 || dHead < 0.4 || y < 0.1) continue;
      const sf = surf(s + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.03);
      const dome = 0.3 * Math.sqrt(Math.max(0, 1 - e)); // the body is raised in the middle
      const off = dome + 0.02 + (total - row) * 0.004 + r() * 0.01;
      // flow: out from the neck, bent down and to the left
      const rx = s - HEAD_S, ry = y - HEAD_Y; const rl = Math.hypot(rx, ry) || 1;
      let fx = (rx / rl) * 0.55 - 0.3, fy = (ry / rl) * 0.55 - 0.75; const fl = Math.hypot(fx, fy); fx /= fl; fy /= fl;
      t.copy(sf.t).multiplyScalar(fx).addScaledVector(UP, fy);
      along.copy(t).addScaledVector(sf.n, 0.42 + r() * 0.14).normalize(); // tips stand off the body, so the layers read in the light
      nor.copy(sf.n).addScaledVector(along, -sf.n.dot(along)).normalize();
      mats.push(basis(sf.p.clone().addScaledVector(sf.n, off), along, nor, L)); tints.push(0.5 + r() * 0.5);
    }
  }
  return { mats, tints };
}

/** Small feathers on the head, laid backwards over the skull (not on the face). */
function buildHeadFeathers() {
  const r = rng(77); const mats: Matrix4[] = []; const rad = new Vector3(0.41, 0.36, 0.4);
  const back = new Vector3(-1, -0.35, -0.1); const nor = new Vector3(), pos = new Vector3(), dir = new Vector3();
  for (let ring = 0; ring < 9; ring++) {
    const u = MathUtils.lerp(-0.85, 0.8, ring / 8); const rr = Math.sqrt(1 - u * u); const count = Math.max(8, Math.round(22 * rr));
    for (let j = 0; j < count; j++) {
      const th = (j / count) * Math.PI * 2 + ring * 0.7;
      pos.set(rad.x * u, rad.y * rr * Math.sin(th), rad.z * rr * Math.cos(th));
      nor.set(pos.x / rad.x ** 2, pos.y / rad.y ** 2, pos.z / rad.z ** 2).normalize();
      if (nor.x > 0.5 && Math.abs(nor.y) < 0.55) continue; // the face and the beak base stay bare
      dir.copy(back).addScaledVector(nor, -back.dot(nor)).normalize().lerp(nor, 0.2).normalize();
      mats.push(basis(pos.clone().addScaledVector(nor, 0.01), dir, nor, 0.15 + r() * 0.04));
    }
  }
  return mats;
}

export function RavenSculpt() {
  const stone = useMemo(() => darkStoneTextures(3, 1), []);
  const coat = useMemo(buildCoat, []); const headF = useMemo(buildHeadFeathers, []);
  const geo = useMemo(() => {
    // each feather is dark at its root and catches the light along its edges and tip (vertex tint), like the carved feathers of the original
    const g = featherGeometry(1, 0.36, 0.22); const p = g.getAttribute('position'); const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = Math.abs(p.getX(i)) / 0.2; const v = 0.28 + 0.5 * y * y + 0.5 * Math.min(1, x) * y; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
    g.setAttribute('color', new Float32BufferAttribute(col, 3)); return g;
  }, []);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, map: stone.map, bumpMap: stone.bump, bumpScale: 1.4, roughness: 0.5, metalness: 0.3, side: DoubleSide }), [stone]);
  const coatRef = useRef<InstancedMesh>(null!); const headRef = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    const c = new Color(); const r = rng(9);
    coat.mats.forEach((m, i) => { coatRef.current.setMatrixAt(i, m); coatRef.current.setColorAt(i, c.setHSL(0.6, 0.05, 0.28 + coat.tints[i] * 0.45).multiplyScalar(1.6 + r() * 0.5)); });
    coatRef.current.instanceMatrix.needsUpdate = true; if (coatRef.current.instanceColor) coatRef.current.instanceColor.needsUpdate = true;
    headF.forEach((m, i) => { headRef.current.setMatrixAt(i, m); headRef.current.setColorAt(i, c.setHSL(0.6, 0.05, 0.3 + r() * 0.35).multiplyScalar(1.6)); });
    headRef.current.instanceMatrix.needsUpdate = true; if (headRef.current.instanceColor) headRef.current.instanceColor.needsUpdate = true;
  }, [coat, headF]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __ravenReady?: boolean }).__ravenReady = true; }, []); // dev harness: scene fully built
  const head = surf(HEAD_S, HEAD_Y).p;
  const dark = <meshStandardMaterial color="#5d5a56" map={stone.map} bumpMap={stone.bump} bumpScale={1.2} roughness={0.5} metalness={0.3} />;
  return <group>
    {/* the carved body under the feathers, so no gap ever shows the case through the coat */}
    <mesh position={[-1.6, 0.95, Z0 - 0.04]} scale={[1.22, 1.0, 0.3]} castShadow receiveShadow><sphereGeometry args={[1, 40, 28]} />{dark}</mesh>
    <mesh position={[X0 + 0.02, 0.9, Z0 - 0.95]} scale={[0.2, 0.95, 0.85]} castShadow receiveShadow><sphereGeometry args={[1, 24, 20]} />{dark}</mesh>
    <instancedMesh ref={coatRef} args={[geo, mat, coat.mats.length]} castShadow receiveShadow frustumCulled={false} />
    {/* the head: a round skull, a hooked beak, a heavy brow and a bright eye */}
    <group position={[head.x, head.y, head.z + 0.3]}>
      <mesh scale={[1.12, 0.98, 1.08]} castShadow receiveShadow><sphereGeometry args={[0.36, 36, 28]} />{dark}</mesh>
      <instancedMesh ref={headRef} args={[geo, mat, headF.length]} castShadow receiveShadow frustumCulled={false} />
      <mesh position={[0.64, -0.1, 0.05]} rotation={[0, 0, -Math.PI / 2 - 0.2]} castShadow><coneGeometry args={[0.15, 0.64, 24]} /><meshStandardMaterial color="#3d3b38" roughness={0.4} metalness={0.4} /></mesh>
      <mesh position={[0.93, -0.25, 0.05]} rotation={[0, 0, -Math.PI / 2 - 0.85]} castShadow><coneGeometry args={[0.07, 0.2, 16]} /><meshStandardMaterial color="#2d2b29" roughness={0.35} metalness={0.4} /></mesh>
      <mesh position={[0.58, -0.22, 0.05]} rotation={[0, 0, -Math.PI / 2 - 0.1]} castShadow><coneGeometry args={[0.11, 0.5, 20]} /><meshStandardMaterial color="#363432" roughness={0.45} metalness={0.35} /></mesh>
      <mesh position={[0.16, 0.2, 0.3]} scale={[1.5, 0.5, 1]} rotation={[0, 0, -0.2]} castShadow><sphereGeometry args={[0.09, 14, 10]} />{dark}</mesh>
      <mesh position={[0.16, 0.11, 0.33]}><sphereGeometry args={[0.065, 20, 16]} /><meshStandardMaterial color="#050505" roughness={0.04} metalness={0.5} /></mesh>
      <mesh position={[0.185, 0.14, 0.385]}><sphereGeometry args={[0.018, 8, 8]} /><meshBasicMaterial color="#eef2fa" /></mesh>
    </group>
  </group>;
}
