import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, RoundedBox, Sparkles } from '@react-three/drei';
import { Group, MathUtils, Mesh } from 'three';
import type { Phase } from './machine';

function Box({ position, size, color = '#292d30', metalness = .65 }: { position: [number, number, number]; size: [number, number, number]; color?: string; metalness?: number }) {
  return <RoundedBox args={size} radius={.045} smoothness={3} position={position} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.4} metalness={metalness} /></RoundedBox>;
}
function Bird({ phase, progress }: { phase: Phase; progress: React.MutableRefObject<number> }) {
  const root = useRef<Group>(null!); const wings = useRef<Group[]>([]); const head = useRef<Group>(null!);
  useFrame(({ clock, pointer }) => {
    const p = progress.current; const flying = phase === 'ravenArrive' || phase === 'ravenDepart';
    const hidden = ['loading', 'caseDrop', 'unlock', 'lidOpen', 'resultReveal', 'complete'].includes(phase);
    root.current.visible = !hidden;
    const arriving = phase === 'ravenArrive';
    root.current.position.set(arriving ? -4 * (1 - p) : phase === 'ravenDepart' ? 5 * p : 0, 1.58 + (flying ? (arriving ? 2.4 * (1 - p) : 3 * p) + Math.sin(p * Math.PI) * .5 : Math.sin(clock.elapsedTime * 2) * .012), .05);
    root.current.rotation.y = -.3;
    wings.current.forEach((wing, i) => { if (wing) wing.rotation.z = (i ? -1 : 1) * (flying ? .5 + Math.sin(clock.elapsedTime * 20) * .8 : .13); });
    head.current.rotation.y = MathUtils.damp(head.current.rotation.y, pointer.x * .55, 4, .016);
  });
  return <group ref={root}>
    <mesh scale={[.25, .37, .25]} castShadow><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#171d25" roughness={.45} metalness={.25} /></mesh>
    <group ref={head} position={[0, .35, .08]}>
      <mesh castShadow><sphereGeometry args={[.21, 16, 12]} /><meshStandardMaterial color="#202732" roughness={.4} /></mesh>
      <mesh position={[0, -.025, .28]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.095, .35, 4]} /><meshStandardMaterial color="#11151c" /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * .16, .055, .12]}><sphereGeometry args={[.026, 8, 8]} /><meshStandardMaterial color="#080b0c" metalness={.6} roughness={.1} /></mesh>)}
    </group>
    {[-1, 1].map((s, index) => <group key={s} ref={g => { if (g) wings.current[index] = g; }} position={[s * .19, .16, -.02]}>
      {[0, 1, 2, 3, 4, 5].map(i => <mesh key={i} position={[s * (.12 + i * .067), -.12 - i * .035, -.04 - i * .024]} rotation={[.15, s * .15, s * .4]} scale={[.075, .34 + i * .025, .055]} castShadow><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color={i % 2 ? '#242d39' : '#1b222b'} roughness={.5} /></mesh>)}
    </group>)}
    <mesh position={[0, -.2, -.28]} rotation={[-.65, 0, 0]} scale={[.17, .4, .08]}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#1c232d" /></mesh>
    {[-.11, .11].map(x => <Box key={x} position={[x, -.35, .1]} size={[.045, .12, .18]} color="#343537" />)}
  </group>;
}
function World({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const chest = useRef<Group>(null!); const lid = useRef<Group>(null!); const locks = useRef<Group>(null!); const plants = useRef<Group>(null!); const glow = useRef<Mesh>(null!);
  const time = useRef({ phase, start: -1 }); const progress = useRef(0);
  useFrame(({ clock, pointer }, dt) => {
    if (time.current.phase !== phase || time.current.start < 0) time.current = { phase, start: clock.elapsedTime };
    const elapsed = clock.elapsedTime - time.current.start;
    const length = phase === 'caseDrop' ? 1.5 : phase === 'ravenArrive' ? 1.8 : phase === 'ravenDepart' ? 1.1 : phase === 'lidOpen' ? 1.1 : .55;
    const p = Math.min(1, elapsed / length); progress.current = p;
    chest.current.position.y = phase === 'caseDrop' && !reduced ? 4 * Math.pow(1 - Math.min(1, p * 1.7), 2) + (p > .58 ? Math.abs(Math.sin((p - .58) * 15)) * Math.exp(-(p - .58) * 10) * .25 : 0) : 0;
    chest.current.rotation.y = MathUtils.damp(chest.current.rotation.y, -.25 + pointer.x * .12, 4, dt);
    const open = ['resultReveal', 'complete'].includes(phase) ? 1 : phase === 'lidOpen' ? 1 - Math.pow(1 - p, 3) : 0;
    lid.current.rotation.x = -open * 1.9;
    locks.current.rotation.x = ['lidOpen', 'resultReveal', 'complete'].includes(phase) ? 1.5 : phase === 'unlock' ? p * 1.5 : 0;
    glow.current.visible = open > .1;
    plants.current.rotation.z = reduced ? 0 : Math.sin(clock.elapsedTime * .55) * .025;
  });
  return <>
    <color attach="background" args={['#efede5']} /><fog attach="fog" args={['#efede5', 8, 19]} />
    <ambientLight intensity={1.4} /><hemisphereLight args={['#fff9e9', '#68715f', 2]} /><directionalLight position={[3, 7, 4]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.06, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#e6e2d8" roughness={.4} /></mesh>
    {[-.8, .5, 1.7].map((z, i) => <mesh key={z} position={[0, -.049, z]} rotation={[-Math.PI / 2, 0, -.23]}><planeGeometry args={[16, .009 + i * .004]} /><meshStandardMaterial color="#cec9bc" transparent opacity={.45} /></mesh>)}
    <group ref={plants} position={[-3.3, 0, -1.1]}>
      <mesh position={[0, .38, 0]} castShadow><cylinderGeometry args={[.42, .3, .76, 24]} /><meshStandardMaterial color="#dad7cb" /></mesh>
      {Array.from({ length: 14 }, (_, i) => <group key={i} rotation={[0, i * 2.4, .2]} position={[0, .7 + i * .075, 0]}><mesh rotation={[0, 0, -.4]} position={[.32, .3, 0]} scale={[.25, .65, .045]} castShadow><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={i % 2 ? '#68775c' : '#879378'} roughness={.9} /></mesh></group>)}
    </group>
    <group ref={chest}>
      <Box position={[0, .5, 0]} size={[2.65, .92, 1.65]} />
      <Box position={[0, .98, 0]} size={[2.5, .06, 1.5]} color="#080e14" />
      {[-1.22, 1.22].map(x => <Box key={x} position={[x, .5, .84]} size={[.13, .9, .08]} color="#858371" />)}
      {[-.83, .83].map(x => <Box key={x} position={[x, .49, .85]} size={[.045, .65, .055]} color="#585d5a" />)}
      <Box position={[0, .56, .87]} size={[.8, .28, .045]} color="#a49b7d" />
      <group position={[0, 1, -.8]} ref={lid}>
        <Box position={[0, .12, .8]} size={[2.72, .26, 1.7]} color="#303638" />
        <Box position={[0, .27, .8]} size={[2.3, .04, 1.3]} color="#42494a" />
        {[-1, 1].map(x => <Box key={x} position={[x, .29, .8]} size={[.08, .04, 1.4]} color="#8a8778" />)}
      </group>
      <group ref={locks} position={[0, 1, .88]}>{[-.85, .85].map(x => <Box key={x} position={[x, -.12, 0]} size={[.2, .32, .1]} color="#a6a18c" />)}</group>
      <mesh ref={glow} position={[0, 1.5, 0]}><coneGeometry args={[1.25, 2.1, 32, 1, true]} /><meshBasicMaterial color="#fff0b9" transparent opacity={.16} depthWrite={false} /></mesh>
      <Bird phase={phase} progress={progress} />
    </group>
    {!reduced && <Sparkles count={45} scale={[9, 4, 5]} position={[0, 1.5, 0]} size={2} speed={.2} color="#fffaf0" />}
    <ContactShadows position={[0, 0, 0]} opacity={.4} scale={12} blur={2.5} far={6} resolution={256} frames={reduced ? 1 : undefined} />
  </>;
}
export default function RavenWorld({ phase, reduced, onLost }: { phase: Phase; reduced: boolean; onLost: () => void }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [4.2, 3, 6.6], fov: 39 }} gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', onLost, { once: true }); }}><World phase={phase} reduced={reduced} /></Canvas>;
}
