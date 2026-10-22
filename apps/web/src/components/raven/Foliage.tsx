import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, SRGBColorSpace, TubeGeometry, Vector3 } from 'three';
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
  const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d')!;
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

/** Tube whose radius tapers from r0 to r1 along the curve. */
function taperedTube(curve: CatmullRomCurve3, segments: number, r0: number, r1: number) {
  const radial = 6; const g = new TubeGeometry(curve, segments, 1, radial, false); const p = g.getAttribute('position'); const c = new Vector3(), v = new Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c); const rad = r0 + (r1 - r0) * (i / segments);
    for (let j = 0; j <= radial; j++) { const n = i * (radial + 1) + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(rad).add(c); p.setXYZ(n, v.x, v.y, v.z); }
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

function buildOlive(seed: number, stems: number, height: number): Built {
  const r = rng(seed); const bark: BufferGeometry[] = []; const leaves: Matrix4[] = [];
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + r() * 0.6; const lean = new Vector3(Math.cos(a), 0, Math.sin(a));
    const base = lean.clone().multiplyScalar(0.1); const h = height * (0.8 + r() * 0.4);
    const stem = new CatmullRomCurve3([base, base.clone().add(new Vector3(lean.x * 0.08, h * 0.35, lean.z * 0.08)), base.clone().add(new Vector3(lean.x * 0.25 + (r() - 0.5) * 0.1, h * 0.7, lean.z * 0.25 + (r() - 0.5) * 0.1)), base.clone().add(new Vector3(lean.x * 0.4, h, lean.z * 0.4))]);
    bark.push(taperedTube(stem, 12, 0.055, 0.025));
    const nB = 5 + Math.floor(r() * 3);
    for (let b = 0; b < nB; b++) {
      const t = 0.4 + (b / nB) * 0.6; const o = stem.getPointAt(t); const ang = a + (r() - 0.5) * 2.4;
      const dir = new Vector3(Math.cos(ang) * 0.85, 0.5 + r() * 0.3, Math.sin(ang) * 0.85);
      const br = branchCurve(r, o, dir, 0.7 + r() * 0.6, 0.5); bark.push(taperedTube(br, 8, 0.022, 0.008));
      const nT = 5 + Math.floor(r() * 3);
      for (let k = 0; k < nT; k++) {
        const tt = 0.25 + (k / nT) * 0.75; const to = br.getPointAt(tt); const bt = br.getTangentAt(tt);
        const td = bt.clone().multiplyScalar(0.5).add(new Vector3((r() - 0.5) * 1.4, (r() - 0.4) * 0.5, (r() - 0.5) * 1.4)).normalize();
        const tw = branchCurve(r, to, td, 0.42 + r() * 0.4, 0.9); bark.push(taperedTube(tw, 5, 0.007, 0.0025));
        leavesAlong(tw, r, leaves, 0.1, 0.62);
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
      leavesAlong(tw, r, leaves, 0.1, 0.62);
    }
  }
  return { bark: mergeGeometries(bark, false)!, leaves };
}

let leafMaterial: MeshStandardMaterial | null = null;
function leafMat() {
  if (leafMaterial) return leafMaterial;
  const m = new MeshStandardMaterial({ map: leafTexture(), color: '#ffffff', roughness: 0.55, metalness: 0, side: DoubleSide, emissive: '#1b2a0c', emissiveIntensity: 0.3 });
  m.onBeforeCompile = sh => { // the underside of an olive leaf is silvery grey-green
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.72, 0.62), 0.78);');
  };
  m.customProgramCacheKey = () => 'olive-leaf';
  leafMaterial = m; return m;
}
const BARK = new MeshStandardMaterial({ color: '#6a5948', roughness: 0.95 });

function Plant({ built, seed }: { built: Built; seed: number }) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => leafBlade(0.34, 0.075), []);
  useLayoutEffect(() => {
    const r = rng(seed + 3); const tint = new Color();
    built.leaves.forEach((m, i) => { ref.current.setMatrixAt(i, m); ref.current.setColorAt(i, tint.setHSL(0.24 + r() * 0.08, 0.22 + r() * 0.18, 0.62 + r() * 0.32)); });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [built, seed]);
  return <group>
    <mesh geometry={built.bark} material={BARK} castShadow receiveShadow />
    <instancedMesh ref={ref} args={[geo, leafMat(), built.leaves.length]} castShadow receiveShadow frustumCulled={false} />
  </group>;
}

/** An olive in a planter or on a block: a few woody stems, many drooping twigs with leaves. `scale` sizes the whole plant. */
export function OliveTree({ position, scale = 1, seed = 1, stems = 4, height = 1.3 }: { position: V3; scale?: number; seed?: number; stems?: number; height?: number }) {
  const built = useMemo(() => buildOlive(seed, stems, height), [seed, stems, height]);
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.02, 0]} receiveShadow><cylinderGeometry args={[0.42, 0.46, 0.06, 24]} /><meshStandardMaterial color="#5b4a3a" roughness={1} /></mesh>
    <Plant built={built} seed={seed} />
  </group>;
}

/** A leafy olive limb arching over the scene from `start` to `end`, with branches and twigs that hang down. */
export function HangingBranch({ start, end, seed = 1, branches = 8 }: { start: V3; end: V3; seed?: number; branches?: number }) {
  const built = useMemo(() => buildHanging(seed, start, end, branches), [seed, start, end, branches]);
  return <Plant built={built} seed={seed} />;
}
