import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import RavenWorld from '../components/raven/RavenWorld';
import type { RavenManualApi } from '../components/raven/RavenWorld';
import type { Phase } from '../components/raven/machine';

// Dev-only harness (apps/web/scene-preview.html). Not part of the production build.
const q = new URLSearchParams(location.search);
// the preview frame is wide like the site's stage (about 2.2 : 1)
const wideW = Math.min(innerWidth, 1100); const wrapEl = document.getElementById('wrap') as HTMLElement;
wrapEl.style.width = `${wideW}px`; wrapEl.style.height = `${Math.round(wideW / 2.55)}px`;
const overlay = document.getElementById('ov') as HTMLImageElement;
overlay.style.opacity = q.get('ov') ?? '0';
if (q.get('diff')) overlay.style.mixBlendMode = 'difference'; // bright = mismatch between scene and reference
// ?w=1000&h=420 previews the site's wide stage instead of the square reference frame
const wrap = document.getElementById('wrap') as HTMLElement;
if (q.get('w') && q.get('h')) { wrap.style.width = `${q.get('w')}px`; wrap.style.height = `${q.get('h')}px`; overlay.style.display = 'none'; }
const phase = (q.get('phase') ?? 'idle') as Phase;

/**
 * ?record=1 renders the whole opening sequence offline on a fixed 30 fps clock and posts every frame to a receiver on :5199
 * (apps/web/recordings/frame_00000.jpg …); ffmpeg turns the frames into a video. Independent of how fast the machine renders.
 */
const SEQUENCE: [Phase, number][] = [['caseDrop', 1.9], ['ravenArrive', 3.4], ['idle', 2.6], ['ravenDepart', 2.0], ['unlock', 0.55], ['lidOpen', 1.4], ['resultReveal', 1.0], ['complete', 2.2]];
const FPS = 30;

function Recorder() {
  const [current, setCurrent] = useState<Phase>('loading');
  const api = useRef<RavenManualApi | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      while ((!(window as unknown as { __ravenReady?: boolean }).__ravenReady || !api.current) && !dead) await new Promise(r => setTimeout(r, 200));
      const { advance, canvas } = api.current!;
      const total = SEQUENCE.reduce((s, [, d]) => s + d, 0); const frames = Math.round(total * FPS);
      let t = 0.05; let shown: Phase = 'loading'; // small head start so the first frame has a valid delta
      for (let i = 0; i < frames && !dead; i++) {
        const at = i / FPS; let acc = 0; let phaseNow: Phase = SEQUENCE[SEQUENCE.length - 1][0];
        for (const [p, d] of SEQUENCE) { if (at < acc + d) { phaseNow = p; break; } acc += d; }
        if (phaseNow !== shown) { flushSync(() => setCurrent(phaseNow)); shown = phaseNow; }
        t += 1 / FPS; advance(t);
        const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.93));
        await fetch(`http://127.0.0.1:5199/save?name=frame_${String(i).padStart(5, '0')}.jpg`, { method: 'POST', body: blob });
        if (i % 10 === 0) document.title = `frame ${i}/${frames}`;
      }
      document.title = 'RECORDED';
    })();
    return () => { dead = true; };
  }, []);
  return <RavenWorld phase={current} reduced={false} onLost={() => undefined} manual={a => { api.current = a; }} />;
}

createRoot(document.getElementById('root')!).render(
  q.get('record') ? <Recorder /> : <RavenWorld phase={phase} reduced={q.get('reduced') !== '0'} onLost={() => undefined} />,
);
