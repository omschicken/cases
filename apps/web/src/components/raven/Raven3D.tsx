import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, MathUtils, Matrix4, Object3D, Shape, ShapeGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { Phase } from './machine';

/**
 * The live raven for the opening sequence: layered feathers (instanced), articulated wings (shoulder, wrist, fingered primaries),
 * a fanning tail, legs that tuck and reach, head with beak and eye.
 * Local space: +z is the direction the bird faces, +y up, origin between the feet (so it can be placed straight onto the lid).
 */

/** One feather: a leaf-shaped card that curls slightly towards its tip. */
export function featherGeometry(length: number, width: number, curl: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width * 0.62, length * 0.12, width * 0.55, length * 0.72, 0, length);
  s.bezierCurveTo(-width * 0.55, length * 0.72, -width * 0.62, length * 0.12, 0, 0);
  const g = new ShapeGeometry(s, 6);
  const p = g.getAttribute('position'); const uv = new Float32Array(p.count * 2);
  // the card curls towards its tip and is cupped across the vane (so a feather seen edge-on still has some depth and catches light, not a hairline)
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / length; const x = p.getX(i) / width; p.setZ(i, -curl * y * y * length + x * x * width * 0.9); uv[i * 2] = p.getX(i) / (width * 1.3) + 0.5; uv[i * 2 + 1] = y; } // u across the vane, v along the quill
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

let barbs: CanvasTexture | null = null;
/** Feather surface: a pale shaft down the middle and fine barbs sweeping out to both edges and forward to the tip (dark blue-black, with a blue sheen on the barbs). */
function barbTexture() {
  if (barbs) return barbs;
  const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#0a0c11'; g.fillRect(0, 0, 128, 512);
  g.lineCap = 'round';
  for (let y = 0; y < 560; y += 3.2) {
    for (const s of [-1, 1]) {
      g.strokeStyle = `rgba(${34 + (y % 7) * 4},${44 + (y % 5) * 4},${68 + (y % 3) * 6},${0.28 + ((y * 7) % 10) / 50})`; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * 30, y - 8, 64 + s * 62, y - 44); g.stroke();
    }
  }
  const sh = g.createLinearGradient(58, 0, 70, 0); sh.addColorStop(0, 'rgba(90,98,115,0)'); sh.addColorStop(0.5, 'rgba(100,108,124,0.8)'); sh.addColorStop(1, 'rgba(90,98,115,0)');
  g.fillStyle = sh; g.fillRect(58, 0, 12, 512);
  const edge = g.createLinearGradient(0, 0, 128, 0); edge.addColorStop(0, 'rgba(0,0,0,0.5)'); edge.addColorStop(0.2, 'rgba(0,0,0,0)'); edge.addColorStop(0.8, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = edge; g.fillRect(0, 0, 128, 512);
  barbs = new CanvasTexture(c); barbs.colorSpace = SRGBColorSpace; barbs.anisotropy = 8;
  return barbs;
}

const _o = new Object3D();
const _m = new Matrix4();
const _x = new Vector3(), _y = new Vector3(), _z = new Vector3();

/** Matrix with feather length along `along`, card facing `normal`, base at `at`. */
export function basis(at: Vector3, along: Vector3, normal: Vector3, scale = 1): Matrix4 {
  _y.copy(along).normalize(); _z.copy(normal).normalize(); _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z).setPosition(at);
  if (scale !== 1) _m.multiply(_o.matrix.identity().makeScale(scale, scale, scale));
  return _m.clone();
}

const FEATHER_MATERIAL = { roughness: 0.35, metalness: 0.15, sheen: 1, sheenColor: '#42557a', sheenRoughness: 0.4, clearcoat: 0.3 } as const;

/** Body plumage: rows of overlapping feathers laid backwards over an ellipsoid. */
function BodyFeathers() {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => featherGeometry(0.15, 0.072, 0.25), []);
  useLayoutEffect(() => {
    const centre = new Vector3(0, 0.31, 0), r = new Vector3(0.205, 0.205, 0.42); // a rounder, chubbier body
    let n = 0;
    for (let u = -0.82; u <= 0.88; u += 0.088) {
      const ring = Math.sqrt(1 - u * u); const count = Math.max(10, Math.round(28 * ring));
      for (let j = 0; j < count; j++) {
        const th = (j / count) * Math.PI * 2 + (u * 7.3);
        const pos = new Vector3(r.x * ring * Math.cos(th), centre.y + r.y * ring * Math.sin(th), r.z * u);
        const nor = new Vector3(pos.x / (r.x * r.x), (pos.y - centre.y) / (r.y * r.y), pos.z / (r.z * r.z)).normalize();
        const back = new Vector3(0, 0, -1); back.sub(nor.clone().multiplyScalar(back.dot(nor))).normalize();
        const along = back.clone().lerp(nor, 0.22).normalize();
        ref.current.setMatrixAt(n++, basis(pos, along, nor, 0.9 + ((j * 7 + n) % 5) * 0.05));
      }
    }
    ref.current.count = n; ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[geo, undefined, 640]} castShadow>
    <meshPhysicalMaterial color="#0b0d11" roughness={0.38} metalness={0.15} sheen={1} sheenColor="#3b4c6b" sheenRoughness={0.45} clearcoat={0.25} side={DoubleSide} />
  </instancedMesh>;
}

/** Small fluffy feathers on the head (the back and the crown) and a soft ruff around the neck: what makes the bird look round and cuddly. */
function Fluff({ centre, radius, scale: sc, rings, count, along: down, length, width, from, to }: { centre: Vector3; radius: Vector3; scale?: number; rings: number; count: number; along: Vector3; length: number; width: number; from: number; to: number }) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => featherGeometry(length, width, 0.3), [length, width]);
  useLayoutEffect(() => {
    let n = 0;
    for (let r = 0; r < rings; r++) {
      const u = MathUtils.lerp(from, to, rings === 1 ? 0 : r / (rings - 1)); const ring = Math.sqrt(1 - u * u);
      for (let j = 0; j < count; j++) {
        const th = (j / count) * Math.PI * 2 + r * 0.9;
        const pos = new Vector3(radius.x * ring * Math.cos(th), radius.y * ring * Math.sin(th), radius.z * u).add(centre);
        const nor = new Vector3((pos.x - centre.x) / (radius.x ** 2), (pos.y - centre.y) / (radius.y ** 2), (pos.z - centre.z) / (radius.z ** 2)).normalize();
        const dir = down.clone().sub(nor.clone().multiplyScalar(down.dot(nor))).normalize().lerp(nor, 0.3).normalize();
        ref.current.setMatrixAt(n++, basis(pos, dir, nor, (sc ?? 1) * (0.85 + ((j * 5 + r * 3) % 5) * 0.07)));
      }
    }
    ref.current.count = n; ref.current.instanceMatrix.needsUpdate = true;
  }, [centre, radius, sc, rings, count, down, from, to]);
  return <instancedMesh ref={ref} args={[geo, undefined, rings * count]} castShadow>
    <meshPhysicalMaterial color="#0b0d11" roughness={0.4} metalness={0.12} sheen={1} sheenColor="#4a5d80" sheenRoughness={0.45} side={DoubleSide} />
  </instancedMesh>;
}

const HEAD_C = new Vector3(0, 0, 0), HEAD_R = new Vector3(0.145, 0.14, 0.15), BACK = new Vector3(0, -0.25, -1), NECK_C = new Vector3(0, 0.46, 0.33), NECK_R = new Vector3(0.1, 0.15, 0.1), DOWN_BACK = new Vector3(0, -1, -0.5);

/** What the animation drives on one wing. */
type WingRig = { shoulder: Group; wrist: Group; primaries: InstancedMesh };

const WRIST_X = 0.38; // the arm (secondaries) runs from the shoulder to here, the hand (primaries) continues
const _at = new Vector3(), _along = new Vector3(), _up = new Vector3(0, 1, 0);

/**
 * The ten primaries ("fingers") are re-laid every frame: `spread` opens or closes the fan, `bend` lifts their tips (air load on the
 * down-stroke) or lets them hang (up-stroke). The outer feathers bend most.
 */
function layPrimaries(mesh: InstancedMesh, spread: number, bend: number, lenScale = 1) {
  for (let i = 0; i < 10; i++) {
    const k = i / 9; const a = 0.14 - (0.14 + 0.95) * spread * k;
    _along.set(Math.cos(a), bend * (0.2 + k * 0.8) * (1 - 0.45 * k), -Math.sin(a));
    mesh.setMatrixAt(i, basis(_at.set(i * 0.02, 0, -i * 0.013), _along, _up, (1 - Math.abs(k - 0.25) * 0.28) * lenScale)); // the longest fingers are the 3rd and 4th
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Colour variation per feather (dark blue-black, a few a little browner and lighter), set once. */
function tintFeathers(mesh: InstancedMesh, count: number, seed: number) {
  const c = new Color(); let s = seed;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) mesh.setColorAt(i, c.setHSL(0.6 - r() * 0.45 * (r() > 0.8 ? 1 : 0.15), 0.18 + r() * 0.25, 0.5 + r() * 0.5));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** Wing in its open pose: arm along +x, three rows of coverts, secondaries, then the fingered primaries on the wrist. Mirrored for the left wing. */
function Wing({ side, rig }: { side: 1 | -1; rig: (r: WingRig | null) => void }) {
  const shoulder = useRef<Group>(null!); const wrist = useRef<Group>(null!);
  const inner = useRef<InstancedMesh>(null!); const prim = useRef<InstancedMesh>(null!);
  const tex = useMemo(barbTexture, []);
  const secondary = useMemo(() => featherGeometry(0.52, 0.115, 0.1), []);
  const primary = useMemo(() => featherGeometry(0.84, 0.15, 0.1), []);
  // a dark panel under the arm (shoulder to wrist, up to the secondaries' tips) so the inner wing is solid and never shows gaps or a bare bone
  const panel = useMemo(() => {
    const s = new Shape(); s.moveTo(0, -0.05); s.lineTo(WRIST_X, -0.06); s.lineTo(WRIST_X + 0.02, 0.4); s.lineTo(0.03, 0.46); s.closePath();
    const g = new ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; // (shape y becomes -z: the panel trails behind the arm)
  }, []);
  useLayoutEffect(() => {
    let n = 0;
    for (let i = 0; i < 10; i++) { // secondaries along the trailing edge of the arm, fanned a little and getting shorter towards the body
      const a = 0.16 - i * 0.05;
      inner.current.setMatrixAt(n++, basis(new Vector3(0.02 + i * 0.037, 0, -0.025 - i * 0.004), new Vector3(Math.sin(a) * 0.55, 0.025, -1), new Vector3(0, 1, 0), 1 - i * 0.018));
    }
    for (let row = 0; row < 3; row++) for (let i = 0; i < 10; i++) { // coverts: shingled rows over the arm, shorter towards the leading edge
      inner.current.setMatrixAt(n++, basis(new Vector3(0.015 + i * 0.037, 0.011 * (row + 1), 0.05 + row * 0.055 - i * 0.004), new Vector3(0.1 - row * 0.02, 0.04, -1), new Vector3(0, 1, 0), 0.9 - row * 0.2));
    }
    inner.current.count = n; inner.current.instanceMatrix.needsUpdate = true;
    tintFeathers(inner.current, n, 31 + side); tintFeathers(prim.current, 10, 77 + side);
    layPrimaries(prim.current, 1, 0);
    rig({ shoulder: shoulder.current, wrist: wrist.current, primaries: prim.current });
  }, [rig, side]);
  const mat = <meshPhysicalMaterial map={tex} bumpMap={tex} bumpScale={1.4} color="#ffffff" emissive="#0b1220" emissiveIntensity={0.4} {...FEATHER_MATERIAL} sheen={0.5} clearcoat={0.15} side={DoubleSide} />;
  return <group ref={shoulder} position={[side * 0.17, 0.4, 0.04]} scale={[side, 1, 1]}>
    <mesh geometry={panel} position={[0, -0.008, 0]} castShadow><meshStandardMaterial color="#07080b" roughness={0.6} side={DoubleSide} /></mesh>
    <instancedMesh ref={inner} args={[secondary, undefined, 40]} castShadow frustumCulled={false}>{mat}</instancedMesh>
    <group ref={wrist} position={[WRIST_X, 0, 0]}>
      <instancedMesh ref={prim} args={[primary, undefined, 10]} castShadow frustumCulled={false}>{mat}</instancedMesh>
    </group>
  </group>;
}

/** Tail: nine feathers fanning from the rump; the group pivots at the rump so the whole tail can fan and dip. */
function Tail({ tailRef }: { tailRef: (g: Group | null) => void }) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => featherGeometry(0.46, 0.085, 0.08), []);
  useLayoutEffect(() => {
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.075;
      ref.current.setMatrixAt(i, basis(new Vector3(0, Math.abs(i - 4) * -0.004, 0), new Vector3(Math.sin(a), -0.12, -Math.cos(a)), new Vector3(0, 1, 0.1)));
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <group ref={tailRef} position={[0, 0.3, -0.38]}>
    <instancedMesh ref={ref} args={[geo, undefined, 9]} castShadow>
      <meshPhysicalMaterial color="#090b0f" roughness={0.4} metalness={0.12} sheen={1} sheenColor="#3b4c6b" side={DoubleSide} />
    </instancedMesh>
  </group>;
}

function Head({ headRef }: { headRef: (g: Group | null) => void }) {
  const dark = <meshPhysicalMaterial color="#0b0d11" roughness={0.4} metalness={0.15} sheen={1} sheenColor="#3b4c6b" clearcoat={0.2} />;
  return <group ref={headRef} position={[0, 0.6, 0.43]}>
    {/* a big round head, a short stout beak and large glossy eyes: the cute proportions */}
    <mesh scale={[1.02, 1, 1.05]} castShadow><sphereGeometry args={[0.14, 32, 24]} />{dark}</mesh>
    <Fluff centre={HEAD_C} radius={HEAD_R} rings={5} count={16} along={BACK} length={0.075} width={0.045} from={-0.55} to={0.45} />
    <mesh position={[0, -0.012, 0.185]} rotation={[Math.PI / 2 - 0.1, 0, 0]} castShadow><coneGeometry args={[0.066, 0.26, 20]} /><meshStandardMaterial color="#0a0b0d" roughness={0.28} metalness={0.2} /></mesh>
    <mesh position={[0, -0.04, 0.165]} rotation={[Math.PI / 2 - 0.06, 0, 0]} castShadow><coneGeometry args={[0.05, 0.2, 16]} /><meshStandardMaterial color="#0a0b0d" roughness={0.35} /></mesh>
    <mesh position={[0, -0.0, 0.1]} scale={[1, 0.6, 0.9]} castShadow><sphereGeometry args={[0.052, 12, 10]} /><meshStandardMaterial color="#111216" roughness={0.6} /></mesh>
    {[-1, 1].map(s => <group key={s} position={[s * 0.1, 0.035, 0.085]}>
      <mesh scale={[0.8, 1.05, 1]}><sphereGeometry args={[0.038, 20, 16]} /><meshStandardMaterial color="#020203" roughness={0.03} metalness={0.5} /></mesh>
      <mesh position={[s * 0.006, 0.015, 0.027]}><sphereGeometry args={[0.0125, 10, 10]} /><meshBasicMaterial color="#f2f6ff" /></mesh>
      <mesh position={[-s * 0.007, -0.011, 0.03]}><sphereGeometry args={[0.0055, 8, 8]} /><meshBasicMaterial color="#cfd9ee" /></mesh>
      <mesh position={[s * 0.004, 0.036, 0.004]} rotation={[0, 0, s * 0.25]} scale={[1.1, 0.35, 0.8]}><sphereGeometry args={[0.03, 12, 8]} /><meshStandardMaterial color="#0b0d11" roughness={0.5} /></mesh>
    </group>)}
  </group>;
}

const PERCH_YAW = 1.12; // faces +x like the raven in the relief, a three-quarter view from the camera
const ease = (x: number) => { const t = MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
/** Builds distance(p) in 0..1 from a speed profile v(p): the integral of the speed, normalised, read back from a table. */
function distanceCurve(speed: (p: number) => number) {
  const N = 128; const table = new Float32Array(N + 1);
  for (let i = 1; i <= N; i++) table[i] = table[i - 1] + speed((i - 0.5) / N);
  const total = table[N];
  return (p: number) => { const x = MathUtils.clamp(p, 0, 1) * N; const i = Math.min(N - 1, Math.floor(x)); return (table[i] + (table[i + 1] - table[i]) * (x - i)) / total; };
}

const BIRD_SCALE = 1.5; // the bird is drawn a little larger than life so it reads in the wide frame
const bump = (x: number, a: number, b: number) => ease((x - a) / (b - a)) * (1 - ease((x - b) / (b - a))); // rises on [a, b], falls on [b, 2b - a]

/**
 * One wingbeat as a function of phase (0..1): a fast, powerful down-stroke with the wing fully extended and the fingers lifted by the air,
 * then an up-stroke in which the hand folds at the wrist, the fan closes and the feathers hang. `amp` scales the whole stroke (0 = glide).
 */
function stroke(phase: number, amp: number, floor = -0.7) {
  const f = phase - Math.floor(phase); const DOWN = 0.44;
  let lift: number, flex: number, spread: number, bend: number;
  // `floor` is the lowest the wing may go (raised near the case, so the wingtips never reach the lid)
  if (f < DOWN) { const u = ease(f / DOWN); lift = MathUtils.lerp(0.95, floor, u); flex = 0; spread = 1; bend = 0.45 * Math.sin(Math.PI * (f / DOWN)); }
  else { const v = (f - DOWN) / (1 - DOWN); const s = Math.sin(Math.PI * v); lift = MathUtils.lerp(floor, 0.95, ease(v)); flex = 0.95 * s; spread = 1 - 0.5 * s; bend = -0.3 * s; }
  const glide = 0.14; // dihedral of a gliding wing
  return { lift: MathUtils.lerp(glide, lift, amp), flex: flex * amp, spread: MathUtils.lerp(1, spread, amp), bend: bend * amp };
}

export function Raven3D({ phase, progress, perchY }: { phase: Phase; progress: React.MutableRefObject<number>; perchY: number }) {
  const root = useRef<Group>(null!); const head = useRef<Group>(null!); const tail = useRef<Group>(null!);
  const wings = useRef<(WingRig | null)[]>([null, null]); const legs = useRef<Group[]>([]);
  const body = useRef<Group>(null!); const torso = useRef<Group>(null!);
  const state = useRef({ flap: 0, yaw: PERCH_YAW, bank: 0, last: '' });
  // flight lines: a descending approach from the upper left that dips below the perch to flare up onto it, and a climb out to the upper right
  const paths = useMemo(() => ({
    // both lines run at about 70° to the camera axis, so the wings are seen in three-quarter view the whole way (not edge-on)
    // (the approach stays above the lid until the very end and comes down onto the perch from above and behind, so no part of the bird goes through the case)
    // it enters from the left edge of the frame (not from the top) just above the planter, glides across and descends in one long curve
    arrive: new CatmullRomCurve3([[-9.5, perchY + 0.85, -1.2], [-6, perchY + 0.78, -1.0], [-3.6, perchY + 0.66, -0.75], [-1.9, perchY + 0.46, -0.4], [-0.6, perchY + 0.22, -0.12], [0.1, perchY, 0.05]].map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal'),
    // it climbs away to the right and stays in view until it leaves the frame at the right edge
    depart: new CatmullRomCurve3([[0.1, perchY, 0.05], [0.9, perchY + 0.12, 0.3], [2.6, perchY + 0.16, 0.9], [5, perchY + 0.1, 1.6], [10, perchY - 0.05, 2.6]].map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal'),
  }), [perchY]);
  const tan = useMemo(() => new Vector3(), []); const pt = useMemo(() => new Vector3(), []);
  // distance travelled along the line as a function of time, from a speed profile (so the speed changes smoothly): cruise, then ease off to the perch
  const along = useMemo(() => ({
    arrive: distanceCurve(p => MathUtils.lerp(1, 0.08, ease((p - 0.45) / 0.55))),
    depart: distanceCurve(p => MathUtils.lerp(0.12, 1, ease(p / 0.65))),
  }), []);
  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(Math.max(dtRaw, 1 / 240), 1 / 20); const t = clock.elapsedTime; const p = progress.current; const st = state.current;
    const arriving = phase === 'ravenArrive', leaving = phase === 'ravenDepart', flying = arriving || leaving;
    const hidden = ['loading', 'caseDrop', 'unlock', 'lidOpen', 'resultReveal', 'complete'].includes(phase);
    root.current.visible = !hidden;
    if (st.last !== phase) { st.last = phase; st.flap = 0.3; st.bank = 0; }
    let x = 0.1, y = perchY, z = 0.05, yaw = PERCH_YAW, pitch = 0, roll = 0;
    let amp = 0, freq = 3.2, fold = 1, legAngle = 0, flare = 0, bob = 0, floor = -0.7;
    if (arriving || leaving) {
      const curve = arriving ? paths.arrive : paths.depart;
      const s = arriving ? along.arrive(p) : along.depart(p);
      curve.getPointAt(MathUtils.clamp(s, 0, 1), pt); curve.getTangentAt(MathUtils.clamp(s, 0.001, 0.999), tan);
      x = pt.x; y = pt.y; z = pt.z;
      const heading = Math.atan2(tan.x, tan.z); const climb = Math.atan2(tan.y, Math.hypot(tan.x, tan.z));
      if (arriving) {
        flare = bump(p, 0.62, 0.84);                                        // the braking pitch-up before touchdown
        const glide = bump(p, 0.2, 0.34);                                  // a stretch of soaring on open wings mid-approach
        const touch = ease((p - 0.86) / 0.14);                               // wings fold and settle at the end
        yaw = MathUtils.lerp(heading, PERCH_YAW, ease((p - 0.66) / 0.28));
        pitch = -(climb * 0.8 + 0.55 * flare * (1 - touch));
        amp = MathUtils.lerp(0.72, 1.1, ease((p - 0.55) / 0.3)) * (1 - 0.85 * glide) * (1 - touch);
        freq = MathUtils.lerp(2.8, 3.8, ease((p - 0.45) / 0.4));
        floor = MathUtils.lerp(-0.7, -0.02, ease((p - 0.68) / 0.16));       // wings stay up near the case
        fold = touch;
        legAngle = p < 0.4 ? 1.2 : p < 0.78 ? MathUtils.lerp(1.2, -0.55, ease((p - 0.4) / 0.38)) : MathUtils.lerp(-0.55, 0, ease((p - 0.78) / 0.22));
        y -= 0.05 * Math.sin(Math.PI * MathUtils.clamp((p - 0.9) / 0.1, 0, 1)); // legs take the weight (back to zero exactly at the perch)
      } else {
        const crouch = bump(p, 0, 0.09);                                     // sink, then spring
        yaw = MathUtils.lerp(PERCH_YAW, heading, ease(p / 0.3));
        pitch = -(climb * 0.9 + 0.3 * (1 - ease(p / 0.5)));
        amp = 1.25 * (1 - 0.3 * ease((p - 0.3) / 0.5)) * ease((p - 0.04) / 0.12);
        freq = MathUtils.lerp(4.2, 3.1, ease((p - 0.1) / 0.6));
        floor = MathUtils.lerp(-0.02, -0.7, ease((p - 0.14) / 0.28));       // first strokes stay clear of the lid
        fold = 1 - ease((p - 0.05) / 0.12);
        legAngle = p < 0.14 ? MathUtils.lerp(0, -0.35, ease(p / 0.14)) : MathUtils.lerp(-0.35, 1.25, ease((p - 0.14) / 0.3));
        y -= 0.07 * crouch;
      }
      // banking follows how fast the heading turns (a right turn lowers the right wing)
      const rate = MathUtils.clamp((yaw - st.yaw) / dt, -3, 3);
      st.bank = MathUtils.damp(st.bank, MathUtils.clamp(-rate * 0.1, -0.5, 0.5), 5, dt); roll = st.bank;
      st.yaw = yaw;
      st.flap += freq * dt * (amp > 0.05 ? 1 : 0);
    } else {
      y = perchY + Math.sin(t * 2) * 0.006; st.yaw = PERCH_YAW; // breathing
    }
    const beat = stroke(st.flap, amp, floor);
    // the body rises as the wings come down and sinks on the up-stroke
    bob = flying ? Math.cos(2 * Math.PI * (st.flap - 0.08)) * -0.035 * Math.min(1, amp) : 0;
    root.current.rotation.order = 'YXZ'; root.current.position.set(x, y, z); root.current.rotation.set(pitch, yaw, roll);
    body.current.position.y = bob;
    wings.current.forEach((w, i) => {
      if (!w) return; const s = i ? -1 : 1; const open = 1 - fold;
      w.shoulder.rotation.y = s * fold * (Math.PI / 2 - 0.14);                       // folded: wing lies back along the body
      w.shoulder.rotation.z = s * open * beat.lift;                                   // open: flapping
      w.shoulder.rotation.x = open * (0.06 + 0.12 * flare);
      w.wrist.rotation.y = beat.flex * open + fold * 0.5;                              // the hand folds back at the wrist on the up-stroke
      layPrimaries(w.primaries, MathUtils.lerp(beat.spread, 0.2, fold), beat.bend * open, MathUtils.lerp(1, 0.52, fold)); // folded: the long fingers tuck so the tips end at the tail
    });
    tail.current.rotation.x = MathUtils.damp(tail.current.rotation.x, -(0.16 + 0.85 * flare + (flying ? 0.05 * Math.sin(2 * Math.PI * st.flap) : 0)), 5, dt);
    tail.current.scale.x = MathUtils.damp(tail.current.scale.x, 1 + 0.55 * flare, 5, dt);
    legs.current.forEach(l => { if (l) l.rotation.x = flying ? MathUtils.damp(l.rotation.x, legAngle, 6, dt) : MathUtils.damp(l.rotation.x, 0, 4, dt); });
    body.current.rotation.z = 0;
    torso.current.rotation.x = MathUtils.damp(torso.current.rotation.x, flying ? 0.05 : -0.42, 6, dt); // up on the perch, level in flight
    // perched: no interaction, the raven keeps looking around on its own. It holds a direction for a moment, then snaps to the next,
    // with a small cock of the head, until the case opens. In flight the head stays level and looks where it goes.
    // (the target changes every ~2.6 s and the head eases towards it, so there are no sudden snaps)
    const beatT = t * 0.38; const idx = Math.floor(beatT);
    const dir = (n: number) => Math.sin(n * 12.9898) * 0.5 + Math.sin(n * 4.1414) * 0.5; // deterministic pseudo-random in [-1, 1]
    const look = flying ? 0 : dir(idx) * 0.9;
    const tilt = flying ? -pitch * 0.7 - 0.12 : 0.34 + dir(idx + 7) * 0.12; // perched: the torso is pitched up, the head tips forward to keep the beak about level
    head.current.rotation.y = MathUtils.damp(head.current.rotation.y, look, flying ? 6 : 3.2, dt);
    head.current.rotation.x = MathUtils.damp(head.current.rotation.x, tilt, 4, dt);
    head.current.rotation.z = MathUtils.damp(head.current.rotation.z, flying ? -roll * 0.6 : dir(idx + 3) * 0.12, 3, dt);
  });
  return <group ref={root} scale={BIRD_SCALE}>
    <group ref={body}>
      {/* legs hang from the hips: they tuck back in flight and reach forward to land */}
      {[-1, 1].map((s, li) => <group key={s} ref={g => { if (g) legs.current[li] = g; }} position={[s * 0.07, 0.2, 0.02]}>
        <mesh position={[0, -0.1, 0]} castShadow><cylinderGeometry args={[0.014, 0.012, 0.2, 8]} /><meshStandardMaterial color="#17181b" roughness={0.5} /></mesh>
        {[-0.05, 0, 0.05, 0.1].map((o, k) => <mesh key={k} position={[o * 0.5, -0.196, 0.05 + (k === 3 ? -0.09 : 0.0)]} rotation={[Math.PI / 2, 0, (k - 1.5) * 0.18]} castShadow><cylinderGeometry args={[0.008, 0.006, 0.11, 6]} /><meshStandardMaterial color="#17181b" roughness={0.5} /></mesh>)}
      </group>)}
      {/* torso is pitched up like a perched raven, with a long arched neck carrying the head */}
      <group ref={torso} position={[0, 0.02, 0]}>
        <mesh position={[0, 0.31, 0]} scale={[0.2, 0.2, 0.4]} castShadow><sphereGeometry args={[1, 28, 20]} /><meshPhysicalMaterial color="#07080b" roughness={0.45} metalness={0.1} /></mesh>
        <mesh position={[0, 0.43, 0.3]} rotation={[0.55, 0, 0]} scale={[0.115, 0.2, 0.125]} castShadow><sphereGeometry args={[1, 20, 16]} /><meshPhysicalMaterial color="#07080b" roughness={0.45} /></mesh>
        <mesh position={[0, 0.52, 0.38]} rotation={[0.9, 0, 0]} scale={[0.1, 0.16, 0.1]} castShadow><sphereGeometry args={[1, 20, 16]} /><meshPhysicalMaterial color="#07080b" roughness={0.45} /></mesh>
        <BodyFeathers />
        <Fluff centre={NECK_C} radius={NECK_R} rings={4} count={14} along={DOWN_BACK} length={0.1} width={0.06} from={-0.6} to={0.5} />
        <Tail tailRef={g => { if (g) tail.current = g; }} />
        <Wing side={1} rig={r => { if (r) wings.current[0] = r; }} />
        <Wing side={-1} rig={r => { if (r) wings.current[1] = r; }} />
        <Head headRef={g => { if (g) head.current = g; }} />
      </group>
    </group>
  </group>;
}
