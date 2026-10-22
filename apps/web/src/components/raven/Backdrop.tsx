import { useMemo } from 'react';
import { CanvasTexture, ExtrudeGeometry, Float32BufferAttribute, Shape, SRGBColorSpace } from 'three';
import type { BufferGeometry } from 'three';
import { marbleTextures, marbleTileTextures } from './textures';
import { OliveTree } from './Foliage';

/**
 * The backdrop, laid out from the approved background picture (public/scene-ref/background.webp).
 * The picture was read as a horizontal camera high above the podium with a lens shift, so verticals stay vertical; every block below
 * is placed from where it stands in the picture. Measures: X across, Y up (0 = the top of the podium), Z = distance from the camera
 * (so the front edge of the podium is at 14 and the back wall at 19). The case stands on the middle of the podium, whose centre is the origin.
 */
const ZO = 15.15; // world z of the camera; a point at distance Z is at world z = ZO - Z
const wz = (Z: number) => ZO - Z;
const FLOOR = -1.0;

type Tex = ReturnType<typeof marbleTextures>;
type BlockProps = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; tex: Tex; tint?: string; rough?: number; coat?: number; r?: number };

/** A block of stone from its edges: x0..x1 across, y0..y1 up, z0 (near) .. z1 (far) as distances from the camera. */
function Block({ x0, x1, y0, y1, z0, z1, tex, tint = '#fff3e4', rough = 0.85, coat = 0.15, r = 0.07 }: BlockProps) {
  const size: [number, number, number] = [x1 - x0, y1 - y0, z1 - z0];
  const geometry = useMemo(() => stoneBox(size[0], size[1], size[2], r), [size[0], size[1], size[2], r]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geometry} position={[(x0 + x1) / 2, (y0 + y1) / 2, wz((z0 + z1) / 2)]} castShadow receiveShadow>
    {/* matte on purpose: no gloss, no per-pixel roughness noise, so the sun never makes a hard glare or sparkle on the stone */}
    <meshPhysicalMaterial map={tex.map} bumpMap={tex.bump} bumpScale={0.2} roughness={Math.max(rough, 0.92)} metalness={0} clearcoat={coat * 0.15} clearcoatRoughness={0.8} color={tint} />
  </mesh>;
}

const stoneCache = new Map<string, BufferGeometry>();
/** A chamfered box whose UVs are in world units (one texture repeat per 3.2 units on every face), so the veins and cracks keep the same size on a long thin slab as on a cube. */
function stoneBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const key = [w, h, d, c].map(n => n.toFixed(3)).join('/'); const hit = stoneCache.get(key); if (hit) return hit;
  c = Math.min(c, w / 2.2, h / 2.2, d / 2.2);
  const s = new Shape(); const hw = w / 2 - c, hh = h / 2 - c;
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
  const g = new ExtrudeGeometry(s, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 2, steps: 1 });
  g.translate(0, 0, -(d - 2 * c) / 2); g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'); const uv = new Float32Array(pos.count * 2); const TILE = 3.2;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i)); const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (nz >= nx && nz >= ny) { uv[i * 2] = x / TILE; uv[i * 2 + 1] = y / TILE; } else if (nx >= ny) { uv[i * 2] = z / TILE; uv[i * 2 + 1] = y / TILE; } else { uv[i * 2] = x / TILE; uv[i * 2 + 1] = z / TILE; }
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); stoneCache.set(key, g); return g;
}

/** A golden travertine niche panel with a glowing, sunlit reveal on one side. */
function Niche({ x0, x1, y0, y1 = 14, reveal = 'left' }: { x0: number; x1: number; y0: number; y1?: number; reveal?: 'left' | 'right' | 'both' }) {
  const strip = (xa: number, xb: number, key: string) => <mesh key={key} position={[(xa + xb) / 2, (y0 + y1) / 2 - 0.4, wz(18.96)]}>
    <boxGeometry args={[xb - xa, y1 - y0 + 1.2, 0.05]} /><meshStandardMaterial color="#fff6e6" emissive="#fff0d6" emissiveIntensity={1.15} roughness={0.9} />
  </mesh>;
  return <group>
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, wz(19.0)]} receiveShadow><boxGeometry args={[x1 - x0, y1 - y0, 0.06]} /><meshStandardMaterial color="#cfa769" roughness={0.88} emissive="#6b4a22" emissiveIntensity={0.18} /></mesh>
    {(reveal === 'left' || reveal === 'both') && strip(x0 - 0.17, x0, 'l')}
    {(reveal === 'right' || reveal === 'both') && strip(x1, x1 + 0.17, 'r')}
  </group>;
}

/** Floor: warm peach tiles. */
function Floor() {
  const t = useMemo(() => marbleTileTextures(21, 18), []);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, wz(14)]} receiveShadow>
    <planeGeometry args={[90, 90]} /><meshStandardMaterial map={t.map} bumpMap={t.bump} bumpScale={0.15} color="#f2b98a" roughness={0.9} />
  </mesh>;
}

/** The streaky leaf shadows of the reference: a light cookie, thin diagonal blades of shade on a bright field. */
function streakTexture() {
  const S = 2048; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.lineCap = 'round'; g.filter = 'blur(3.2px)';
  let s = 5; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 5600; i++) {
    const x = r() * S, y = r() * S, len = 90 + r() * 460, ang = ((116 + (r() - 0.5) * 16) * Math.PI) / 180, w = 1.4 + r() * 6.5;
    g.strokeStyle = `rgba(0,0,0,${0.28 + r() * 0.4})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/**
 * The dark, out-of-focus leaves hanging into the frame at the left (a few big soft leaves close to the camera, as in the reference).
 * Each is a flat card with a blurred leaf drawn on it, placed from where it stands on the screen.
 */
function BlurLeaves() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d')!;
    g.filter = 'blur(26px)'; const grad = g.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, '#6c7e48'); grad.addColorStop(1, '#2c3a20'); g.fillStyle = grad;
    g.beginPath(); g.moveTo(128, 470); g.bezierCurveTo(250, 380, 235, 150, 128, 40); g.bezierCurveTo(21, 150, 6, 380, 128, 470); g.fill();
    g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(190,205,150,0.35)'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 470); g.lineTo(128, 70); g.stroke();
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }, []);
  // [u, v of the leaf base in the picture, length in picture pixels, rotation in degrees, shade]
  const leaves: [number, number, number, number, number][] = [
    [60, -20, 330, 205, 0.55], [150, 30, 300, 160, 0.75], [20, 120, 260, 250, 0.5], [110, 190, 230, 115, 0.9], [-10, 330, 250, 270, 0.55],
    [70, 410, 190, 95, 0.8], [-20, 560, 230, 300, 0.6], [30, 700, 210, 250, 0.7], [180, 20, 200, 130, 0.45],
  ];
  const Zd = 3.6; const f = 1891; // distance of the leaves from the camera; focal length in picture pixels
  return <group>{leaves.map(([u, v, len, rot, shade], i) => {
    const L = (len * Zd) / f; const x = -0.69 + ((u - 978.5) * Zd) / f; const y = 7.63 - ((v + 345) * Zd) / f;
    return <mesh key={i} position={[x, y, wz(Zd)]} rotation={[0, 0, (rot * Math.PI) / 180]} renderOrder={5}>
      <planeGeometry args={[L * 0.5, L]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} opacity={0.92} color={`rgb(${Math.round(110 * shade + 50)},${Math.round(140 * shade + 56)},${Math.round(84 * shade + 36)})`} />
    </mesh>;
  })}</group>;
}

/** The sun: a warm spot light from the upper left, shining through a screen of leaves (the cookie), with soft shadows. */
function LeafSun() {
  const map = useMemo(streakTexture, []);
  return <spotLight position={[-16, 24, 34]} angle={0.72} penumbra={0.5} decay={0} intensity={9.2} color="#ffe0bb" castShadow map={map}
    shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={11} shadow-blurSamples={25} shadow-camera-near={10} shadow-camera-far={120} />;
}

export function Backdrop() {
  const podium = useMemo(() => marbleTextures(3, 1, 3.4, 0, 4.2), []);     // dense, fine orange crackle (no long veins)
  const stone = useMemo(() => marbleTextures(9, 1, 1.5, 0, 3.0), []);       // pillar and blocks: a fainter crackle
  const wall = useMemo(() => marbleTextures(21, 1, 1.6, 1, 0.1), []);    // the wall: a few thin, long orange veins, one piece from end to end (no seam)
  const pale = useMemo(() => marbleTextures(5, 1, 0.8, 0, 1.2), []);
  return <group>
    <LeafSun />
    <Floor />
    {/* back wall: veined marble in the middle, plain pale stone on the left, a pink slab behind the planter */}
    <Block x0={-16} x1={4.5} y0={FLOOR} y1={14} z0={19} z1={19.6} tex={wall} tint="#fff0dc" rough={0.9} coat={0} r={0.02} />
    <Block x0={-7.4} x1={-5.45} y0={1.4} y1={14} z0={18.6} z1={19} tex={pale} tint="#efd4bd" rough={0.85} r={0.02} />
    <Niche x0={-5.4} x1={-3.6} y0={1.85} />
    <Niche x0={-1.08} x1={1.73} y0={0.43} reveal="both" />
    <Niche x0={4.35} x1={5.35} y0={0.4} />
    {/* the long low ledge in front of the wall */}
    <Block x0={-3.04} x1={4.95} y0={FLOOR} y1={-0.48} z0={17.9} z1={19} tex={stone} tint="#fbeedb" coat={0.3} />
    {/* planter block at the left with its overhanging cap and the olive on top */}
    <Block x0={-7.87} x1={-4.03} y0={FLOOR} y1={2.29} z0={16.7} z1={19.3} tex={stone} tint="#f6e8d4" r={0.05} />
    <Block x0={-8.0} x1={-3.9} y0={2.29} y1={2.55} z0={16.55} z1={19.4} tex={stone} tint="#fff4e4" coat={0.35} r={0.04} />
    <OliveTree position={[-5.5, 2.55, wz(17.9)]} scale={2.5} seed={41} stems={2} height={0.55} spread={1.05} density={3} leaf={0.7} />
    <OliveTree position={[-2.6, FLOOR, wz(18.4)]} scale={1.2} seed={19} stems={3} height={1.1} spread={0.8} density={2.3} leaf={0.85} />
    <OliveTree position={[3.07, -0.48, wz(18.3)]} scale={0.85} seed={23} stems={3} height={0.9} spread={0.8} density={2.3} leaf={0.85} />
    <BlurLeaves />
    {/* tall pillar at the right on a low plinth */}
    <Block x0={4.45} x1={7.45} y0={FLOOR} y1={13} z0={16.2} z1={17.6} tex={stone} tint="#f7e9d6" rough={0.95} coat={0} r={0.05} />
    <Block x0={5.0} x1={9.8} y0={FLOOR} y1={-0.7} z0={15.4} z1={17.6} tex={stone} tint="#fff3e4" coat={0.05} rough={0.9} />
    {/* low blocks on the left and the wide lower step in front of the podium */}
    <Block x0={-8.6} x1={-5.4} y0={FLOOR} y1={-0.25} z0={15} z1={17.5} tex={stone} tint="#fff3e4" coat={0.1} rough={0.9} />
    <Block x0={-9.5} x1={6.0} y0={FLOOR} y1={-0.6} z0={11} z1={15} tex={stone} tint="#fff3e4" coat={0.1} rough={0.9} />
    {/* the podium itself: a thin, polished slab with the strong orange crackle on its front */}
    <Block x0={-4.28} x1={4.28} y0={-0.6} y1={0} z0={14} z1={16.3} tex={podium} tint="#fff6ea" rough={0.7} coat={0.2} r={0.08} />
  </group>;
}
