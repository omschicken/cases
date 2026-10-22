import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, OrthographicCamera, PerspectiveCamera, View } from '@react-three/drei';
import { ACESFilmicToneMapping, PCFSoftShadowMap, Vector3 } from 'three';
import type { OrthographicCamera as OrthoCam, PerspectiveCamera as PerspCam } from 'three';
import { CaseSkeleton } from '../components/case/CaseSkeleton';
import type { Only } from '../components/case/CaseSkeleton';

/**
 * Dev-only studio for the master case skeleton (apps/web/case-preview.html): the case alone on a clean studio background.
 *   one view:   ?view=front|back|left|right|top|bottom|iso   ?debug=1 module colours   ?wire=1 mesh   ?open=1.6 lid angle   ?explode=1
 *   the sheet:  ?sheet=1  is a concept board: front 3/4, front orthographic, side, top and the exploded breakdown
 */
const q = new URLSearchParams(location.search);
type View = { pos: [number, number, number]; ortho?: number; fit?: [number, number]; explode?: number; target?: [number, number, number] };
const VIEWS: Record<string, View> = {
  iso: { pos: [7.2, 4.6, 8.8], target: [0, 1.15, 0] }, front: { pos: [0, 1.2, 14], ortho: 1, fit: [5.4, 2.8], target: [0, 1.2, 0] }, back: { pos: [0, 1.2, -14], ortho: 1, fit: [5.4, 2.8], target: [0, 1.2, 0] },
  left: { pos: [-14, 1.2, 0], ortho: 1, fit: [3.0, 2.8], target: [0, 1.2, 0] }, right: { pos: [14, 1.2, 0], ortho: 1, fit: [3.0, 2.8], target: [0, 1.2, 0] },
  top: { pos: [0, 14, 0.01], ortho: 1, fit: [5.4, 3.0], target: [0, 1.2, 0] }, bottom: { pos: [0, -14, 0.01], ortho: 1, fit: [5.4, 3.0], target: [0, 1.2, 0] }, explode: { pos: [8.5, 5.2, 10.5], explode: 1, target: [0, 1.5, 0] },
};

/** Points the camera at the target; an orthographic view is zoomed to fit `fit` (world units) in whatever size its cell is. */
function Look({ target, fit }: { target: [number, number, number]; fit?: [number, number] }) {
  const camera = useThree(s => s.camera) as PerspCam | OrthoCam;
  const size = useThree(s => s.size);
  useLayoutEffect(() => {
    if (fit && (camera as OrthoCam).isOrthographicCamera) camera.zoom = Math.min(size.width / fit[0], size.height / fit[1]) * 0.9;
    camera.lookAt(new Vector3(...target)); camera.updateProjectionMatrix();
  }, [camera, target, fit, size.width, size.height]);
  return null;
}

function Studio({ view, debug, wire, open, clear = false, fov = 24 }: { view: View; debug: boolean; wire: boolean; open: number; clear?: boolean; fov?: number }) {
  const target: [number, number, number] = view.target ?? [0, 1.2, 0];
  return <Canvas shadows={{ type: PCFSoftShadowMap }} orthographic={!!view.ortho} camera={view.ortho ? { position: view.pos, zoom: 60, near: 0.1, far: 80 } : { position: view.pos, fov }}
    gl={{ antialias: true, alpha: clear, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
    {!clear && <color attach="background" args={['#e7e9ed']} />}
    <Environment resolution={256} environmentIntensity={0.85}>
      <color attach="background" args={['#d9dce2']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[5, 6, 5]} scale={[8, 5, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#dfe8ff" position={[-6, 3, -3]} scale={[6, 3, 1]} rotation-y={Math.PI / 2.4} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 7, -4]} scale={[8, 3, 1]} rotation-x={Math.PI / 2} />
    </Environment>
    <hemisphereLight args={['#ffffff', '#c3c6cc', 0.5]} />
    <directionalLight position={[6, 9, 7]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.0004} />
    <directionalLight position={[-7, 4, 5]} intensity={0.8} color="#f1f4ff" />
    <group position={[0, 0, 0]}>
      <CaseSkeleton debug={debug} stone={q.get("stone") === "1"} wire={wire} lidAngle={open} explode={view.explode ?? 0} />
      {!view.ortho && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow><planeGeometry args={[60, 60]} /><shadowMaterial opacity={0.2} /></mesh>}
    </group>
    <Look target={target} fit={view.fit} />
    {!view.ortho && <OrbitControls target={target} makeDefault />}
  </Canvas>;
}

/** Camera for one cell of the sheet: a perspective 3/4 (az, el, dist, fov) or an orthographic projection, both looking at `target`. */
type Cell = { az?: number; el?: number; dist?: number; fov?: number; ortho?: [number, number]; target: [number, number, number]; only?: Only; debug?: boolean; wire?: boolean; paper?: boolean };
function CellCamera({ c }: { c: Cell }) {
  const size = useThree(s => s.size);
  const A = (c.az ?? 0) * Math.PI / 180, E = (c.el ?? 0) * Math.PI / 180, D = c.dist ?? 20; const [tx, ty, tz] = c.target;
  const pos: [number, number, number] = [tx + D * Math.cos(E) * Math.sin(A), ty + D * Math.sin(E), tz + D * Math.cos(E) * Math.cos(A)];
  return c.ortho
    ? <OrthographicCamera makeDefault position={pos} zoom={Math.min(size.width / c.ortho[0], size.height / c.ortho[1])} near={0.1} far={100} onUpdate={cam => cam.lookAt(tx, ty, tz)} />
    : <PerspectiveCamera makeDefault position={pos} fov={c.fov ?? 24} near={0.1} far={100} onUpdate={cam => cam.lookAt(tx, ty, tz)} />;
}
function CellLights() {
  return <>
    <hemisphereLight args={['#ffffff', '#6b7078', 0.9]} />
    <directionalLight position={[5, 8, 6]} intensity={2.4} />
    <directionalLight position={[-6, 3, 4]} intensity={0.9} color="#dfe8ff" />
    <directionalLight position={[0, 4, -7]} intensity={0.5} />
    <directionalLight position={[0, -8, 3]} intensity={0.9} />
  </>;
}
const DEBUG_TOP: Cell = { az: 32, el: 15, dist: 9.2, target: [-0.334, 1.2, 0.209], debug: true };
const SHEET_VIEWS: Cell[] = [
  { az: 0, el: 0, ortho: [4.9, 2.6], target: [0, 1.05, 0], dist: 30, debug: true }, { az: 180, el: 0, ortho: [4.9, 2.6], target: [0, 1.05, 0], dist: 30, debug: true },
  { az: -90, el: 0, ortho: [3.6, 2.6], target: [0, 1.05, 0], dist: 30, debug: true }, { az: 90, el: 0, ortho: [3.6, 2.6], target: [0, 1.05, 0], dist: 30, debug: true },
  { az: 0, el: 90, ortho: [4.9, 3.5], target: [0, 1.05, 0], dist: 30, debug: true }, { az: 0, el: -90, ortho: [4.9, 3.5], target: [0, 1.05, 0], dist: 30, debug: true },
];
const SHEET_MODULES: Cell[] = [
  { az: 28, el: 28, dist: 14, fov: 14, target: [0, 1.85, 0], only: 'lid', paper: true }, { az: 30, el: 22, dist: 10, fov: 14, target: [0, 0, 0], only: 'lock1', paper: true },
  { az: 30, el: 24, dist: 10, fov: 14, target: [0, 0, 0], only: 'corner1', paper: true }, { az: 55, el: 14, dist: 10, fov: 14, target: [0, 0, 0], only: 'handle1', paper: true },
  { az: 50, el: 12, dist: 12, fov: 14, target: [0, 0, 0], only: 'panel1', paper: true }, { az: 28, el: 28, dist: 14, fov: 14, target: [0, 0.15, 0], only: 'bottom', paper: true },
];
const SPHERES: [string, number, number, string?][] = [['#15171c', 0.28, 0.5], ['#23262d', 0.34, 0.4], ['#e9e1d3', 0.4, 0.05], ['#d6a23e', 0.26, 1], ['#17171a', 0.85, 0], ['#1b1d24', 0.45, 0.35], ['#201c1a', 0.5, 0.3], ['#191b22', 0.38, 0.45]];

function SkeletonSheet() {
  const ref = useRef<HTMLDivElement>(null!);
  const hero = useRef<HTMLDivElement>(null!), sphere = useRef<HTMLDivElement>(null!), wire = useRef<HTMLDivElement>(null!);
  const views = SHEET_VIEWS.map(() => useRef<HTMLDivElement>(null!)); // eslint-disable-line react-hooks/rules-of-hooks
  const mods = SHEET_MODULES.map(() => useRef<HTMLDivElement>(null!)); // eslint-disable-line react-hooks/rules-of-hooks
  const P = (x: number, y: number, w: number, h: number): React.CSSProperties => ({ position: 'absolute', left: `${x / 16.19}%`, top: `${y / 9.71}%`, width: `${w / 16.19}%`, height: `${h / 9.71}%` });
  const label = (t: string, x: number, y: number, size = 1.35, align: 'left' | 'center' = 'center') => <div style={{ position: 'absolute', left: `${x / 16.19}%`, top: `${y / 9.71}%`, transform: align === 'center' ? 'translateX(-50%)' : undefined, fontSize: `${size}vw`, color: '#d9dce2', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{t}</div>;
  const callout = (t: string, sub: string, x: number, y: number, side: 'l' | 'r') => <div style={{ position: 'absolute', left: `${x / 16.19}%`, top: `${y / 9.71}%`, width: '15%', textAlign: 'left', font: '600 0.85vw system-ui, sans-serif', color: '#fff' }}>
    <div style={{ display: 'inline-block', background: '#17181c', padding: '0.35vw 0.7vw', borderRadius: '0.3vw', letterSpacing: '0.04em' }}>{t}</div>
    <div style={{ marginTop: '0.3vw', background: 'rgba(30,31,35,0.7)', padding: '0.3vw 0.7vw', borderRadius: '0.3vw', font: '400 0.75vw system-ui, sans-serif', color: '#c8cbd2', display: 'inline-block', maxWidth: '12vw' }}>{sub}</div>
    <div style={{ position: 'absolute', [side === 'l' ? 'left' : 'right']: '-0.2vw', top: '0.5vw', width: 0, height: 0 }} />
  </div>;
  const lines: [number, number, number, number, string][] = [[190, 90, 440, 130, '#ff5f6d'], [235, 212, 395, 240, '#ffae3a'], [220, 350, 478, 365, '#4c7dff'], [190, 492, 400, 495, '#2fd5df'], [1300, 124, 1350, 124, '#cfd2d8'], [1245, 330, 1385, 300, '#a560ff'], [1150, 482, 1390, 425, '#41c96b']];
  return <div ref={ref} style={{ position: 'relative', width: '100vw', height: `${100 * 971 / 1619}vw`, background: '#1b1c1f', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
    <div ref={hero} style={{ ...P(0, 0, 1619, 612), background: 'radial-gradient(ellipse at 50% 38%, #f4f2ee, #cfcbc4 80%)' }} />
    <div style={{ ...P(0, 612, 1619, 185), background: '#141416' }} />
    <svg viewBox="0 0 1619 971" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
      {lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={l[4]} strokeWidth={1.6} />)}
      {[[440, 130, '#ff5f6d'], [395, 240, '#ffae3a'], [478, 365, '#4c7dff'], [400, 495, '#2fd5df'], [1245, 330, '#a560ff'], [1150, 482, '#41c96b']].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={4} fill="#fff" stroke={c as string} strokeWidth={2} />)}
    </svg>
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
      {callout('ВЕРХНЯЯ ЧАСТЬ', 'Отдельный модуль для текстур / стилей', 42, 72, 'l')}
      {callout('ЗАМКИ / МЕХАНИЗМЫ', 'Отдельные детали для кастомизации', 42, 194, 'l')}
      {callout('ОСНОВНОЙ КОРПУС', 'Базовая форма кейса (единый скелет)', 42, 334, 'l')}
      {callout('НИЖНЯЯ ЧАСТЬ', 'Отдельный модуль для текстур / стилей', 42, 478, 'l')}
      {callout('УГЛЫ / ЗАЩИТНЫЕ ЭЛЕМЕНТЫ', 'Отдельные модули', 1378, 108, 'r')}
      {callout('РУЧКИ', 'Отдельный элемент', 1378, 286, 'r')}
      {callout('БОКОВЫЕ ПАНЕЛИ', 'Модули для уникальных текстур / гравировок', 1378, 410, 'r')}
      {['ВИД СПЕРЕДИ', 'ВИД СЗАДИ', 'ВИД СЛЕВА', 'ВИД СПРАВА', 'ВИД СВЕРХУ', 'ВИД СНИЗУ'].map((t, i) => label(t, [140, 407, 648, 875, 1155, 1460][i], 626, 0.9))}
      {label('МАТЕРИАЛЫ  (PBR)', 30, 810, 1.0, 'left')}
      {label('ОТДЕЛЬНЫЕ МОДУЛИ  (ДЛЯ КАСТОМИЗАЦИИ)', 583, 810, 0.9, 'left')}
      {label('КАРКАС (WIREFRAME)', 1355, 810, 0.9, 'left')}
      {['Верхняя часть', 'Замок', 'Угол', 'Ручка', 'Боковая панель', 'Нижняя часть'].map((t, i) => label(t, [655, 785, 882, 977, 1088, 1235][i], 928, 0.8))}
    </div>
    <div style={{ ...P(565, 797, 1, 174), background: '#2a2b2f' }} /><div style={{ ...P(1340, 797, 1, 174), background: '#2a2b2f' }} />
    <div ref={views[0]} style={P(25, 650, 230, 135)} /><div ref={views[1]} style={P(290, 650, 230, 135)} /><div ref={views[2]} style={P(570, 650, 160, 135)} />
    <div ref={views[3]} style={P(780, 650, 190, 135)} /><div ref={views[4]} style={P(1020, 650, 270, 135)} /><div ref={views[5]} style={P(1335, 650, 250, 135)} />
    <div ref={sphere} style={P(20, 830, 545, 125)} />
    {[[583, 135], [722, 125], [820, 125], [920, 115], [1030, 125], [1160, 150]].map(([x, wd], i) => <div key={i} ref={mods[i]} style={P(x, 840, wd, 90)} />)}
    <div ref={wire} style={P(1375, 835, 215, 125)} />
    <Canvas style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }} eventSource={ref} gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping }} shadows={false}>
      <View track={hero}><CellCamera c={{ ...DEBUG_TOP, fov: 24 }} /><CellLights /><CaseSkeleton stone /></View>
      {SHEET_VIEWS.map((c, i) => <View key={i} track={views[i]}><CellCamera c={c} /><CellLights /><CaseSkeleton stone /></View>)}
      <View track={sphere}>
        <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={14} /><CellLights /><Environment resolution={128} environmentIntensity={0.8}><Lightformer form="rect" intensity={3} position={[3, 4, 4]} scale={[6, 4, 1]} /><Lightformer form="rect" intensity={1.5} position={[-4, 2, 3]} scale={[4, 4, 1]} /></Environment>
        {SPHERES.map(([col, rough, metal], i) => <mesh key={i} position={[(i - 3.5) * 1.18, 0, 0]}><sphereGeometry args={[0.52, 40, 28]} /><meshPhysicalMaterial color={col} roughness={rough} metalness={metal} clearcoat={metal < 0.5 ? 0.6 : 0} clearcoatRoughness={0.25} /></mesh>)}
      </View>
      {SHEET_MODULES.map((c, i) => <View key={i} track={mods[i]}><CellCamera c={c} /><CellLights /><CaseSkeleton only={c.only} skin={PAPER} /></View>)}
      <View track={wire}><CellCamera c={{ az: 27, el: 15, dist: 14, fov: 24, target: [0, 1.1, 0] }} /><CellLights /><CaseSkeleton wire skin={WHITE} /></View>
    </Canvas>
  </div>;
}
const PAPER = { lid: '#cfd1d6', lock: '#cfd1d6', body: '#cfd1d6', bottom: '#cfd1d6', corner: '#cfd1d6', handle: '#cfd1d6', side: '#cfd1d6', bolt: '#9ca0a8' };
const WHITE = { lid: '#ffffff', lock: '#ffffff', body: '#ffffff', bottom: '#ffffff', corner: '#ffffff', handle: '#ffffff', side: '#ffffff', bolt: '#ffffff' };

/** ?black=1&v=hero|hero2|back3q|front|back|left|right|top|bottom : the plain black skeleton on a light studio ground, saved as PNG through the local receiver (:5199). */
const BLACK = { lid: '#1d1d22', lock: '#1d1d22', body: '#1d1d22', bottom: '#1d1d22', corner: '#1d1d22', handle: '#1d1d22', side: '#1d1d22', bolt: '#2a2a31' };
const BLACK_VIEWS: Record<string, Cell> = {
  hero: { az: 32, el: 16, dist: 13.2, fov: 24, target: [0, 1.1, 0] }, hero2: { az: -32, el: 16, dist: 13.2, fov: 24, target: [0, 1.1, 0] },
  back3q: { az: 148, el: 16, dist: 13.2, fov: 24, target: [0, 1.1, 0] },
  front: { az: 0, el: 0, ortho: [6.3, 2.8], dist: 30, target: [0, 1.15, 0] }, back: { az: 180, el: 0, ortho: [6.3, 2.8], dist: 30, target: [0, 1.15, 0] },
  left: { az: -90, el: 0, ortho: [3.5, 2.8], dist: 30, target: [0, 1.15, 0] }, right: { az: 90, el: 0, ortho: [3.5, 2.8], dist: 30, target: [0, 1.15, 0] },
  top: { az: 0, el: 90, ortho: [6.3, 3.5], dist: 30, target: [0, 1.15, 0] }, bottom: { az: 0, el: -90, ortho: [6.3, 3.5], dist: 30, target: [0, 1.15, 0] },
};
function SaveFrame({ name }: { name: string }) {
  const gl = useThree(s => s.gl); const n = useRef(0);
  useFrame(() => { if (++n.current === 12) gl.domElement.toBlob(b => { if (b) fetch(`http://127.0.0.1:5199/?name=${name}.png`, { method: 'POST', body: b }).then(() => { document.title = 'saved ' + name; }); }, 'image/png'); });
  return null;
}
function BlackShot({ view }: { view: string }) {
  const c = BLACK_VIEWS[view] ?? BLACK_VIEWS.hero; const W = c.ortho ? 1600 : 1920, H = c.ortho ? Math.round(1600 * c.ortho[1] / c.ortho[0]) : 1080;
  return <div style={{ width: W, height: H }}>
    <Canvas style={{ width: W, height: H }} dpr={1} shadows={{ type: PCFSoftShadowMap }} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
      <color attach="background" args={['#dcdde1']} />
      <CellCamera c={c} />
      <Environment resolution={256} environmentIntensity={1.0}>
        <color attach="background" args={['#cfd1d6']} />
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[5, 6, 5]} scale={[9, 5, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#e6ecff" position={[-6, 3, 3]} scale={[6, 4, 1]} rotation-y={Math.PI / 2.4} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 7, -4]} scale={[9, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 2, -8]} scale={[10, 4, 1]} />
      </Environment>
      <directionalLight position={[6, 9, 7]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.0004} />
      <directionalLight position={[-7, 4, 5]} intensity={0.8} color="#f1f4ff" />
      <CaseSkeleton skin={BLACK} />
      {!c.ortho && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow><planeGeometry args={[60, 60]} /><shadowMaterial opacity={0.22} /></mesh>}
      <SaveFrame name={`skeleton_${view}`} />
    </Canvas>
  </div>;
}

const root = createRoot(document.getElementById('root')!);
if (q.get('black')) {
  root.render(<BlackShot view={q.get('v') ?? 'hero'} />);
} else if (q.get('cmp')) {
  // overlay against the sample sheet (top 1619×612 is the hero view): ?cmp=1&ov=0.5&cam=az,el,dist,fov,tx,ty,tz
  const [az, el, dist, fov, tx, ty, tz] = (q.get('cam') ?? '36,19,13,24,0,1.1,0').split(',').map(Number);
  const A = az * Math.PI / 180, E = el * Math.PI / 180; const ov = Number(q.get('ov') ?? 0.5);
  const pos: [number, number, number] = [tx + dist * Math.cos(E) * Math.sin(A), ty + dist * Math.sin(E), tz + dist * Math.cos(E) * Math.cos(A)];
  // ?crop=x,y,w,h zooms into that rectangle of the 1619×612 hero image
  const [cx, cy, cw, ch] = (q.get('crop') ?? '0,0,1619,612').split(',').map(Number); const k = `(100vw / ${cw})`;
  root.render(<div style={{ position: 'relative', width: '100vw', aspectRatio: `${cw} / ${ch}`, overflow: 'hidden', background: '#222' }}>
    <div style={{ position: 'absolute', left: `calc(${k} * ${-cx})`, top: `calc(${k} * ${-cy})`, width: `calc(${k} * 1619)`, height: `calc(${k} * 612)`, background: 'url(/scene-ref/skeleton.webp) top left / 100% auto no-repeat' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: ov }}><Studio view={{ pos, target: [tx, ty, tz] }} debug={q.get('debug') !== '0'} wire={q.get('wire') === '1'} open={0} clear fov={fov} /></div>
    </div>
  </div>);
} else if (q.get('sheet') === '2') {
  root.render(<SkeletonSheet />);
} else if (q.get('sheet')) {
  const cells: { title: string; view: View; style: React.CSSProperties }[] = [
    { title: 'FRONT 3/4', view: VIEWS.iso, style: { gridColumn: '1', gridRow: '1' } },
    { title: 'FRONT — ORTHOGRAPHIC', view: VIEWS.front, style: { gridColumn: '2', gridRow: '1' } },
    { title: 'SIDE — HANDLE END', view: VIEWS.right, style: { gridColumn: '3', gridRow: '1' } },
    { title: 'EXPLODED BREAKDOWN — LID · LOCKS · CORNERS · BODY · END PANELS · HANDLES · BASE', view: VIEWS.explode, style: { gridColumn: '1 / span 2', gridRow: '2' } },
    { title: 'TOP', view: VIEWS.top, style: { gridColumn: '3', gridRow: '2' } },
  ];
  root.render(<div style={{ width: '100vw', height: '100vh', background: '#e7e9ed', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10, padding: 10, boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
    {cells.map(c => <div key={c.title} style={{ position: 'relative', background: 'linear-gradient(#f3f4f6,#dcdfe5)', borderRadius: 6, overflow: 'hidden', ...c.style }}>
      <div style={{ position: 'absolute', left: 12, top: 8, zIndex: 2, fontSize: 11, letterSpacing: '0.12em', color: '#3a3f4a', fontWeight: 600 }}>{c.title}</div>
      <Studio view={c.view} debug={false} wire={false} open={0} />
    </div>)}
    <div style={{ position: 'absolute', right: 20, bottom: 14, fontSize: 11, letterSpacing: '0.14em', color: '#5a606c' }}>CASECROW · MASTER CASE SKELETON · CLAY BLOCKOUT</div>
  </div>);
} else {
  root.render(<div style={{ width: '100vw', height: '100vh' }}><Studio view={q.get('explode') ? { ...VIEWS.explode } : VIEWS[q.get('view') ?? 'iso'] ?? VIEWS.iso} debug={q.get('debug') === '1'} wire={q.get('wire') === '1'} open={Number(q.get('open') ?? 0)} /></div>);
}
