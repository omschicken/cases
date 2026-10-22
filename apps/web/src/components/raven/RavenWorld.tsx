import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
// (the sky dome inside <Environment> is a custom shader, see below)
import { ACESFilmicToneMapping, BackSide, CanvasTexture, Group, MathUtils, Vector3, VSMShadowMap } from 'three';
import type { MeshBasicMaterial, PerspectiveCamera } from 'three';
import { durations } from './machine';
import type { Phase } from './machine';
import { dropOrigin, lidAngle, shakeAt, simulateDrop } from './physics';
import { Dust } from './Dust';
import type { DropLog } from './Dust';
import { ChestModel, CHEST } from './ChestModel';
import { ReferenceDecals } from './ReferenceDecals';
import { Raven3D } from './Raven3D';
import { Courtyard3D, LeafShadows, Platform } from './Courtyard3D';
import { Post } from './Post';
import { VIEW } from './sceneConfig';
import { useReferenceMaps } from './referenceMaps';

/** dev only: ?p=0.5 freezes the phase progress so a single frame of the flight can be inspected */
const DEBUG_P = import.meta.env.DEV && new URLSearchParams(location.search).get('p') !== null ? Number(new URLSearchParams(location.search).get('p')) : null;

/** dev only: ?orbit=1 hands the camera to the mouse (drag to rotate, wheel to zoom) so the scene can be inspected from any side */
const ORBIT = import.meta.env.DEV && new URLSearchParams(location.search).get('orbit') !== null;

/** dev only: ?dof=0 renders without depth of field */
const NO_DOF = import.meta.env.DEV && new URLSearchParams(location.search).get('dof') === '0';

function cameraFromQuery() {
  if (!import.meta.env.DEV) return VIEW;
  const raw = new URLSearchParams(location.search).get('cam');
  if (!raw) return VIEW;
  const n = raw.split(',').map(Number);
  if (n.length !== 7 || n.some(Number.isNaN)) return VIEW;
  return { position: [n[0], n[1], n[2]] as const, fov: n[3], target: [n[4], n[5], n[6]] as const };
}

/** While the case opens the camera backs off and rises so the raised lid and the item stay in frame. */
const OPEN_VIEW = { position: [5.6, 4.6, 13.8] as const, target: [0.3, 1.5, 0] as const };
const OPENING_PHASES: Phase[] = ['unlock', 'lidOpen', 'resultReveal', 'complete'];

/** Vertical camera jolt from the case's impacts (written by the world, read by the camera rig). */
const jolt = { y: 0 };

function CameraRig({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const cfg = useMemo(cameraFromQuery, []);
  const k = useRef(0); const pos = useRef(new Vector3()); const look = useRef(new Vector3());
  useLayoutEffect(() => {
    camera.position.set(...cfg.position); camera.fov = cfg.fov;
    camera.lookAt(new Vector3(...cfg.target)); camera.updateProjectionMatrix();
  }, [camera, cfg]);
  useFrame((_, dt) => {
    const goal = OPENING_PHASES.includes(phase) ? 1 : 0;
    k.current = reduced ? goal : MathUtils.damp(k.current, goal, 1.6, dt);
    const e = k.current * k.current * (3 - 2 * k.current);
    pos.current.set(...cfg.position).lerp(new Vector3(...OPEN_VIEW.position), e);
    look.current.set(...cfg.target).lerp(new Vector3(...OPEN_VIEW.target), e);
    camera.position.copy(pos.current); camera.position.y += jolt.y; camera.lookAt(look.current);
  });
  return null;
}

/**
 * Dark, soft ambient occlusion where the case and the raven relief meet the stone. It fades with the case's height while it falls.
 * (A blurred rounded rectangle on a plane just above the stone.)
 */
function ContactSoil({ heightRef }: { heightRef: React.RefObject<Group> }) {
  const mat = useRef<MeshBasicMaterial>(null!);
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    g.clearRect(0, 0, 256, 256); g.filter = 'blur(14px)'; g.fillStyle = '#000';
    g.beginPath(); g.roundRect(34, 44, 188, 168, 16); g.fill(); // a little larger than the case so a dark rim shows around the base
    return new CanvasTexture(c);
  }, []);
  useFrame(() => {
    const c = heightRef.current; const y = c?.position.y ?? 0;
    mat.current.opacity = c && c.visible ? 0.72 * MathUtils.clamp(1 - y / 2.5, 0, 1) : 0; // no shadow before the case exists
  });
  return <mesh position={[-0.35, 0.009, 0.05]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
    <planeGeometry args={[7.2, 4.4]} />
    <meshBasicMaterial ref={mat} map={tex} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
  </mesh>;
}

function World({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const chest = useRef<Group>(null!); const lid = useRef<Group>(null!); const latch = useRef<Group>(null!);
  const time = useRef({ phase, start: -1 }); const progress = useRef(0);
  const dropLog = useRef<DropLog>({ start: -99, hits: [] }); const origin = useMemo(() => new Vector3(), []);
  const texturesReady = useReferenceMaps() !== null;
  useFrame(({ clock }) => {
    if (time.current.phase !== phase || time.current.start < 0) time.current = { phase, start: clock.elapsedTime };
    const elapsed = clock.elapsedTime - time.current.start;
    const length = ((durations as Record<string, number>)[phase] ?? 550) / 1000;
    const p = DEBUG_P ?? Math.min(1, elapsed / length); progress.current = p;
    const t = DEBUG_P !== null ? DEBUG_P * length : elapsed; // seconds into the phase
    chest.current.visible = phase !== 'loading' && texturesReady; // the page opens on the empty courtyard; the case falls into it, fully built
    // the case drops under gravity, lands on a corner, rebounds and rocks to rest (rigid-body simulation); the impacts throw dust and jolt the camera
    if (phase === 'caseDrop' && !reduced) {
      const pose = simulateDrop(t); dropLog.current = { start: time.current.start, hits: pose.hits };
      chest.current.position.copy(dropOrigin(pose, origin)); chest.current.rotation.set(pose.rx, 0, pose.rz, 'ZXY');
    } else { chest.current.position.set(0, 0, 0); chest.current.rotation.set(0, 0, 0); }
    jolt.y = shakeAt(dropLog.current.hits, clock.elapsedTime - dropLog.current.start);
    // the lid is spring-loaded: it pops as the latch lets go, overshoots, knocks the hinge stop and settles
    const open = ['resultReveal', 'complete'].includes(phase) ? 1.9 : phase === 'lidOpen' ? (reduced ? 1.9 : lidAngle(t)) : phase === 'unlock' ? 0.05 * p * p * (3 - 2 * p) : 0;
    lid.current.rotation.x = -open;
    latch.current.rotation.x = ['lidOpen', 'resultReveal', 'complete'].includes(phase) ? 1.5 : phase === 'unlock' ? p * 1.5 : 0;
  });
  return <>
    <color attach="background" args={['#efe2cf']} />
    {/* light rig: a low warm sun with soft shadows, a cool sky fill, warm bounce from the sunlit stone, a back rim for the case */}
    <hemisphereLight args={['#f6eadc', '#f0dac4', .8]} />
    <directionalLight position={[-7, 10, 3.5]} intensity={3.9} color="#fff0dc" castShadow shadow-mapSize={[3072, 3072]} shadow-bias={-.0005} shadow-normalBias={.025} shadow-radius={10} shadow-blurSamples={25}
      shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={11} shadow-camera-bottom={-11} shadow-camera-near={1} shadow-camera-far={44} />
    <directionalLight position={[3, -3, 6]} intensity={.65} color="#ffc486" />
    {/* warm bounce off the sunlit steps onto the front of the case */}
    <pointLight position={[-0.8, 0.5, 4.2]} intensity={7} distance={7} decay={2} color="#ffbd7a" />
    <directionalLight position={[7, 5, 8]} intensity={.35} color="#d3e2ff" />
    <directionalLight position={[2, 4, -7]} intensity={.9} color="#fff0d8" />
    <Environment resolution={512} environmentIntensity={.6}>
      {/* sky dome: blue zenith, pale warm horizon, bright sun disc in the sun's direction */}
      <mesh scale={80}>
        <sphereGeometry args={[1, 48, 24]} />
        <shaderMaterial side={BackSide} toneMapped={false} depthWrite={false} uniforms={{}} vertexShader="varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
          fragmentShader={`varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.56,0.62,0.74); vec3 hor = vec3(1.0,0.92,0.80); vec3 low = vec3(0.86,0.74,0.58);
            vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, low, pow(-h, 0.6));
            float s = max(dot(vP, normalize(vec3(-0.5,0.72,0.25))), 0.0); c += vec3(1.0,0.82,0.55) * (pow(s, 600.0) * 60.0 + pow(s, 14.0) * 0.9);
            gl_FragColor = vec4(c, 1.0); }`} />
      </mesh>
      <Lightformer form="rect" intensity={2.6} color="#fff0dc" position={[-4, 6, 5]} scale={[8, 5, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffd9b0" position={[6, 3, -2]} scale={[6, 4, 1]} rotation-y={-Math.PI / 2} />
    </Environment>
    <Courtyard3D />
    <Platform />
    {/* dappled sunlight: one patch of leaf shadow over the platform and floor (clear over the case), one over the columns */}
    <LeafShadows aim={[0, 0, 1]} hole={1.8} spread={4.6} count={420} seed={1234} />
    <LeafShadows aim={[6.5, 3, -3.4]} hole={0} spread={4.2} count={360} seed={99} />
    <group ref={chest} visible={false}>
      <ChestModel lidRef={lid} latchRef={latch} />
      <ReferenceDecals />
      <Raven3D phase={phase} progress={progress} perchY={CHEST.bodyH + CHEST.lidH + .02} />
    </group>
    <ContactSoil heightRef={chest} />
    <Dust dropRef={dropLog} />
  </>;
}

/** Dev tooling: lets the preview harness step the scene on a fixed clock (offline render of the animation). */
export type RavenManualApi = { advance: (seconds: number) => void; canvas: HTMLCanvasElement };

/** Tells the page when the reference textures are in and the case can be shown. */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const maps = useReferenceMaps();
  useEffect(() => {
    if (!maps || !onReady) return;
    const t = window.setTimeout(onReady, 400); // a few frames for the first upload to the GPU
    return () => clearTimeout(t);
  }, [maps, onReady]);
  return null;
}

export default function RavenWorld({ phase, reduced, onLost, manual, onReady }: { phase: Phase; reduced: boolean; onLost: () => void; manual?: (api: RavenManualApi) => void; onReady?: () => void }) {
  // The scene is composed for a wide frame (about 2.2 : 1) and fills the whole stage; the stage keeps its own height.
  return <div className="raven-world" style={{ position: 'relative', width: '100%', height: '100%' }}>
    <Canvas shadows={{ type: VSMShadowMap }} dpr={manual ? (import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('dpr')) || 1 : 1) : [1, 1.75]} frameloop={manual ? 'never' : 'always'} camera={{ position: [...VIEW.position], fov: VIEW.fov }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.14 }}
      onCreated={({ gl, advance }) => {
        gl.domElement.addEventListener('webglcontextlost', onLost, { once: true });
        manual?.({ advance: (t: number) => advance(t), canvas: gl.domElement });
      }}>
      <ReadySignal onReady={onReady} />
      {!NO_DOF && <Post />}
      {ORBIT ? <OrbitControls target={[0.3, 1.0, 0]} makeDefault /> : <CameraRig phase={phase} reduced={reduced} />}<World phase={phase} reduced={reduced} />
    </Canvas>
  </div>;
}
