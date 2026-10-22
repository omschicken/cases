import { Component, lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { durations, transition } from './machine';
import type { Phase } from './machine';
import type { CaseItem } from '../../lib/types';
import { EditorialItemImage } from '../editorial/EditorialItemImage';
import '../../styles/raven-stage.css';

const World = lazy(() => import('./RavenWorld'));
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function supported() {
  try { const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl2'); if (!gl) return false; gl.getExtension('WEBGL_lose_context')?.loseContext(); return true; } catch { return false; }
}
function Stage({ opening, winner, onComplete, sound, onLost }: { opening: boolean; winner: CaseItem | null; onComplete: () => void; sound: boolean; onLost: () => void }) {
  const [phase, dispatch] = useReducer(transition, 'loading' as Phase);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const complete = useRef(onComplete); complete.current = onComplete;
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReduced(query.matches); query.addEventListener('change', change); return () => query.removeEventListener('change', change); }, []);
  useEffect(() => { if (opening) dispatch('OPEN'); else if (phase === 'openingPending' || phase === 'complete') dispatch('ERROR'); }, [opening]);
  useEffect(() => { if (opening && winner && phase === 'openingPending') dispatch('CONFIRMED'); }, [opening, winner, phase]);
  // The page opens on the empty courtyard; the sequence only starts once the scene has its textures, so the case never shows half-built.
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 20000); return () => clearTimeout(t); }, []); // never wait forever
  useEffect(() => {
    if (!(phase in durations)) return;
    if (phase === 'loading' && !ready) return;
    const timer = window.setTimeout(() => dispatch('NEXT'), reduced ? 0 : durations[phase as keyof typeof durations]);
    return () => clearTimeout(timer);
  }, [phase, reduced, ready]);
  useEffect(() => { if (phase === 'complete' && opening && winner) complete.current(); }, [phase, opening, winner]);
  useEffect(() => {
    if (!sound || !['ravenArrive', 'unlock', 'lidOpen'].includes(phase)) return;
    // Procedural sound study, enabled explicitly by the existing sound control.
    try {
      const ctx = audio.current ??= new AudioContext(); void ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.setValueAtTime(phase === 'unlock' ? 700 : 90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + .25);
      gain.gain.setValueAtTime(.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .3);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .31);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch { /* Sound is optional. */ }
  }, [phase, sound]);
  useEffect(() => () => { void audio.current?.close(); }, []);
  return <div className="raven-stage" data-phase={phase}>
    <Suspense fallback={<p role="status">Загружаем 3D-сцену…</p>}><World phase={phase} reduced={reduced} onLost={onLost} onReady={() => setReady(true)} /></Suspense>
    <div className="raven-stage__caption"><span>CASECROW / ORIGINALS</span><strong>RAVEN</strong><small>Интерактивный 3D-прототип</small></div>
    <div className="raven-stage__status" role="status">{phase === 'openingPending' ? 'Подтверждаем открытие на сервере…' : phase === 'idle' ? 'Двигай курсор — ворон наблюдает' : phase === 'resultReveal' ? 'Твой предмет подтверждён' : ''}</div>
    {phase === 'resultReveal' && winner && <div className="raven-stage__reveal"><EditorialItemImage name={winner.name} imageUrl={winner.imageUrl} decorative loading="eager" /><strong>{winner.name}</strong></div>}
    {['loading', 'caseDrop', 'ravenArrive'].includes(phase) && <button className="raven-stage__skip" onClick={() => dispatch('SKIP')}>Пропустить вступление</button>}
  </div>;
}
export function RavenStage({ fallback, ...props }: { fallback: ReactNode; opening: boolean; winner: CaseItem | null; onComplete: () => void; sound: boolean }) {
  const [available, setAvailable] = useState(supported);
  if (!available) return <>{fallback}</>;
  return <SceneBoundary fallback={fallback}><Stage {...props} onLost={() => setAvailable(false)} /></SceneBoundary>;
}
