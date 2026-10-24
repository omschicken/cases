import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Olive plants built the way the real ones grow: woody stems that branch into drooping twigs, and narrow lanceolate leaves set in opposite
 * pairs that turn by 90° at every node. Each leaf is a small folded, curled, textured blade (dark green above, silvery below).
 * Everything is deterministic from a seed and drawn with two draw calls per plant (merged bark, instanced leaves).
 */
type V3 = [number, number, number];
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

let leafMap: CanvasTexture | null = null;
/** Leaf surface: tone gradient from the midrib to the edge, a pale midrib, fine side veins and a darker rim. */
function leafTexture() {
  if (leafMap) return leafMap;
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d')!; g.scale(2, 2);
  const base = g.createLinearGradient(0, 0, 0, 512); base.addColorStop(0, '#7f9560'); base.addColorStop(0.5, '#62784a'); base.addColorStop(1, '#4b5f3a');
  g.fillStyle = base; g.fillRect(0, 0, 128, 512);
  const side = g.createLinearGradient(0, 0, 128, 0); side.addColorStop(0, 'rgba(20,40,10,0.35)'); side.addColorStop(0.5, 'rgba(255,255,230,0.0)'); side.addColorStop(1, 'rgba(20,40,10,0.35)');
  g.fillStyle = side; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = 'rgba(210,225,180,0.22)'; g.lineWidth = 1.2;
  for (let y = 24; y < 500; y += 22) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * 24, y - 10, 64 + s * 56, y - 34); g.stroke(); }
  g.strokeStyle = 'rgba(225,235,195,0.75)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 0); g.stroke();
  leafMap = new CanvasTexture(c); leafMap.colorSpace = SRGBColorSpace; leafMap.anisotropy = 8;
  return leafMap;
}

/** A lanceolate leaf blade along +y, folded up along the midrib and curling down at the tip; widest about two fifths along. */
function leafBlade(length: number, width: number) {
  const rows = 8, cols = 4; const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows; const w = width * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.8);
    for (let k = 0; k <= cols; k++) {
      const u = (k / cols) * 2 - 1; const x = u * w;
      pos.push(x, t * length, Math.abs(x) * 0.5 - 0.16 * t * t * length); uv.push(u * 0.5 + 0.5, t);
    }
  }
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const a = r * (cols + 1) + k, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Tube whose radius tapers from r0 to r1 along the curve; `gnarl` adds the fluted, knotty surface of old olive wood and `flare` swells the foot. */
function taperedTube(curve: CatmullRomCurve3, segments: number, r0: number, r1: number, radial = 6, gnarl = 0, flare = 0) {
  const g = new TubeGeometry(curve, segments, 1, radial, false); const p = g.getAttribute('position'); const c = new Vector3(), v = new Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c); const t = i / segments; const base = r0 + (r1 - r0) * t + flare * Math.pow(1 - t, 3);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2; const n = i * (radial + 1) + j; const rad = base * (1 + gnarl * (Math.sin(a * 2 + i * 0.9) * 0.6 + Math.sin(a * 5 - i * 1.7) * 0.4));
      v.fromBufferAttribute(p, n).sub(c).multiplyScalar(rad).add(c); p.setXYZ(n, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals(); return g;
}
/** A gently arching, drooping branch from `origin` heading along `dir`. */
function branchCurve(r: () => number, origin: Vector3, dir: Vector3, length: number, droop: number) {
  const pts = [origin.clone()]; const p = origin.clone(); const d = dir.clone().normalize();
  for (let k = 1; k <= 4; k++) {
    p.addScaledVector(d, length / 4); d.x += (r() - 0.5) * 0.3; d.z += (r() - 0.5) * 0.3; d.y -= droop * 0.2; d.normalize(); pts.push(p.clone());
  }
  return new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

type Built = { bark: BufferGeometry; leaves: Matrix4[] };
const UP = new Vector3(0, 1, 0);

/** Leaves along a twig: opposite pairs, each pair turned 90° from the one before, pointing out and a little forward, drooping with their weight. */
function leavesAlong(curve: CatmullRomCurve3, r: () => number, out: Matrix4[], spacing: number, leafScale: number) {
  const len = curve.getLength(); const nodes = Math.max(3, Math.floor(len / spacing));
  const p = new Vector3(), tan = new Vector3(), s1 = new Vector3(), s2 = new Vector3(), dir = new Vector3(), nor = new Vector3(), ax = new Vector3(), at = new Vector3();
  const place = (pos: Vector3, along: Vector3, scale: number) => {
    nor.copy(UP).addScaledVector(along, -UP.dot(along)); if (nor.lengthSq() < 1e-4) nor.set(0, 0, 1); nor.normalize().addScaledVector(s2, (r() - 0.5) * 0.7).normalize();
    ax.copy(along).normalize(); const x = new Vector3().crossVectors(ax, nor).normalize(); const z = new Vector3().crossVectors(x, ax).normalize();
    const m = new Matrix4().makeBasis(x, ax, z).setPosition(pos); m.multiply(new Matrix4().makeScale(scale, scale, scale)); out.push(m);
  };
  for (let i = 1; i <= nodes; i++) {
    const t = Math.min(1, 0.12 + (i / nodes) * 0.88); curve.getPointAt(t, p); curve.getTangentAt(t, tan);
    s1.crossVectors(tan, UP); if (s1.lengthSq() < 1e-4) s1.set(1, 0, 0); s1.normalize(); s2.crossVectors(tan, s1).normalize();
    const phi = i * Math.PI / 2 + (r() - 0.5) * 0.4; const sd = s1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(s2, Math.sin(phi));
    const grow = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15)); // leaves are smaller near the tip and near the base
    for (const sign of [1, -1]) {
      if (r() < 0.07) continue;
      dir.copy(tan).multiplyScalar(0.5).addScaledVector(sd, 0.85 * sign); dir.y -= 0.12 + r() * 0.15; dir.x += (r() - 0.5) * 0.25; dir.z += (r() - 0.5) * 0.25;
      place(p, at.copy(dir).normalize(), leafScale * grow * (0.8 + r() * 0.4));
    }
  }
  curve.getPointAt(1, p); curve.getTangentAt(1, tan); place(p, at.copy(tan).normalize(), leafScale * 0.7); // the terminal leaf
}

type Habit = { spread: number; density: number; leaf: number };
function buildOlive(seed: number, stems: number, height: number, habit: Habit): Built {
  const r = rng(seed); const bark: BufferGeometry[] = []; const leaves: Matrix4[] = [];
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + r() * 0.6; const lean = new Vector3(Math.cos(a), 0, Math.sin(a));
    const base = lean.clone().multiplyScalar(0.1); const h = height * (0.8 + r() * 0.4);
    // a thick, nearly upright stem that only leans out near its top, like the old olive in the reference
    const wob = () => (r() - 0.5) * 0.07;
    const stem = new CatmullRomCurve3([base.clone().multiplyScalar(0.3), base.clone().add(new Vector3(lean.x * 0.02 + wob(), h * 0.2, lean.z * 0.02 + wob())), base.clone().add(new Vector3(lean.x * 0.06 + wob(), h * 0.42, lean.z * 0.06 + wob())), base.clone().add(new Vector3(lean.x * 0.12 + wob(), h * 0.64, lean.z * 0.12 + wob())), base.clone().add(new Vector3(lean.x * 0.18 + wob(), h * 0.84, lean.z * 0.18 + wob())), base.clone().add(new Vector3(lean.x * 0.26, h, lean.z * 0.26))]);
    bark.push(taperedTube(stem, 28, 0.075, 0.04, 14, 0.16, 0.07));
    const nB = 9 + Math.floor(r() * 4); // many limbs, all round the stem, so the crown is full
    for (let b = 0; b < nB; b++) {
      const t = 0.35 + (b / nB) * 0.65; const o = stem.getPointAt(t); const ang = r() * Math.PI * 2;
      const dir = new Vector3(Math.cos(ang) * 0.85, 0.5 + r() * 0.3, Math.sin(ang) * 0.85);
      const br = branchCurve(r, o, dir, (0.7 + r() * 0.6) * habit.spread, 0.5); bark.push(taperedTube(br, 10, 0.024, 0.008, 8, 0.08));
      const nT = Math.round((5 + Math.floor(r() * 3)) * habit.density);
      for (let k = 0; k < nT; k++) {
        const tt = 0.25 + (k / nT) * 0.75; const to = br.getPointAt(tt); const bt = br.getTangentAt(tt);
        const td = bt.clone().multiplyScalar(0.5).add(new Vector3((r() - 0.5) * 1.4, (r() - 0.4) * 0.5, (r() - 0.5) * 1.4)).normalize();
        const tw = branchCurve(r, to, td, (0.42 + r() * 0.4) * habit.spread, 0.9); bark.push(taperedTube(tw, 5, 0.007, 0.0025));
        leavesAlong(tw, r, leaves, 0.075 * habit.leaf, 0.46 * habit.leaf);
      }
    }
  }
  return { bark: mergeGeometries(bark, false)!, leaves };
}

function buildHanging(seed: number, start: V3, end: V3, branches: number): Built {
  const r = rng(seed); const bark: BufferGeometry[] = []; const leaves: Matrix4[] = [];
  const s = new Vector3(...start), e = new Vector3(...end);
  const limb = new CatmullRomCurve3([s, s.clone().lerp(e, 0.35).add(new Vector3(0, 0.5, 0.2)), s.clone().lerp(e, 0.7).add(new Vector3(0, 0.25, -0.1)), e]);
  bark.push(taperedTube(limb, 16, 0.07, 0.025));
  for (let b = 0; b < branches; b++) {
    const t = 0.12 + (b / branches) * 0.88; const o = limb.getPointAt(t); const side = (r() - 0.5) * 2;
    const br = branchCurve(r, o, new Vector3(0.3 + (r() - 0.5) * 0.6, 0.15, side * 0.9), 0.9 + r() * 0.9, 1.4); bark.push(taperedTube(br, 8, 0.02, 0.007));
    const nT = 7 + Math.floor(r() * 4);
    for (let k = 0; k < nT; k++) {
      const tt = 0.15 + (k / nT) * 0.85; const to = br.getPointAt(tt);
      const tw = branchCurve(r, to, new Vector3((r() - 0.5) * 0.8, -0.8 - r() * 0.4, (r() - 0.5) * 0.9), 0.55 + r() * 0.6, 0.4); bark.push(taperedTube(tw, 5, 0.006, 0.002));
      leavesAlong(tw, r, leaves, 0.075, 0.46);
    }
  }
  return { bark: mergeGeometries(bark, false)!, leaves };
}

let leafMaterial: MeshStandardMaterial | null = null;
function leafMat() {
  if (leafMaterial) return leafMaterial;
  const m = new MeshStandardMaterial({ map: leafTexture(), color: '#ffffff', roughness: 0.55, metalness: 0, side: DoubleSide, emissive: '#1b2a0c', emissiveIntensity: 0.12 });
  m.onBeforeCompile = sh => { // the underside of an olive leaf is silvery grey-green
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.72, 0.62), 0.78);');
  };
  m.customProgramCacheKey = () => 'olive-leaf';
  leafMaterial = m; return m;
}
let barkTex: CanvasTexture | null = null;
/** Olive bark: grey-brown with long wavering fissures, paler ridges and a little grit (runs along the limb: u is the length of a tube). */
function barkTexture() {
  if (barkTex) return barkTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d')!; const r = rng(7);
  g.fillStyle = '#6b5b4b'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 220; i++) { g.strokeStyle = 'rgba(' + (95 + r() * 40) + ',' + (82 + r() * 30) + ',' + (68 + r() * 26) + ',' + (0.12 + r() * 0.22) + ')'; g.lineWidth = 2 + r() * 5; g.beginPath(); let y = r() * 256, x = r() * 512; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += 40 + r() * 70; y += (r() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 170; i++) { g.strokeStyle = 'rgba(28,20,14,' + (0.3 + r() * 0.4) + ')'; g.lineWidth = 1 + r() * 2.4; g.beginPath(); let y = r() * 256, x = r() * 512; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += 30 + r() * 60; y += (r() - 0.5) * 10; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() > 0.5 ? 'rgba(20,15,10,0.35)' : 'rgba(150,135,115,0.3)'; g.fillRect(r() * 512, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  barkTex = new CanvasTexture(c); barkTex.wrapS = barkTex.wrapT = RepeatWrapping; barkTex.repeat.set(3, 2); barkTex.colorSpace = SRGBColorSpace; barkTex.anisotropy = 8;
  return barkTex;
}
let barkMaterial: MeshStandardMaterial | null = null;
function barkMat() { return barkMaterial ?? (barkMaterial = new MeshStandardMaterial({ map: barkTexture(), bumpMap: barkTexture(), bumpScale: 3, color: '#cbbfae', roughness: 0.95 })); }

function Plant({ built, seed }: { built: Built; seed: number }) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => leafBlade(0.3, 0.05), []);
  useLayoutEffect(() => {
    const r = rng(seed + 3); const tint = new Color();
    built.leaves.forEach((m, i) => { ref.current.setMatrixAt(i, m); ref.current.setColorAt(i, tint.setHSL(0.23 + r() * 0.07, 0.2 + r() * 0.2, 0.42 + r() * 0.3)); });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [built, seed]);
  return <group name="foliage">
    <mesh geometry={built.bark} material={barkMat()} castShadow receiveShadow />
    <instancedMesh ref={ref} args={[geo, leafMat(), built.leaves.length]} castShadow receiveShadow frustumCulled={false} />
  </group>;
}

/** An olive in a planter or on a block: a few woody stems, many drooping twigs with leaves. `scale` sizes the whole plant. */
export function OliveTree({ position, scale = 1, seed = 1, stems = 4, height = 1.3, spread = 1, density = 1, leaf = 1 }: { position: V3; scale?: number; seed?: number; stems?: number; height?: number; spread?: number; density?: number; leaf?: number }) {
  const built = useMemo(() => buildOlive(seed, stems, height, { spread, density, leaf }), [seed, stems, height, spread, density, leaf]);
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.006, 0]} receiveShadow><cylinderGeometry args={[0.34, 0.36, 0.014, 28]} /><meshStandardMaterial color="#6a5844" roughness={1} /></mesh>
    <Plant built={built} seed={seed} />
  </group>;
}

/** A leafy olive limb arching over the scene from `start` to `end`, with branches and twigs that hang down. */
export function HangingBranch({ start, end, seed = 1, branches = 8 }: { start: V3; end: V3; seed?: number; branches?: number }) {
  const built = useMemo(() => buildHanging(seed, start, end, branches), [seed, start, end, branches]);
  return <Plant built={built} seed={seed} />;
}
