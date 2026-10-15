/**
 * OPENING SOUND — procedural Web Audio synthesis, one call per burst phase.
 *
 * No audio files. Everything is generated at runtime from oscillators and
 * shaped noise so the whole module weighs nothing and loads instantly.
 *
 * Called directly from ChestOpeningOverlay's GSAP timeline, one function
 * per phase, so sound stays locked to the beat that's actually on screen
 * instead of firing once at the start and drifting out of sync.
 */

let sharedCtx: AudioContext | null = null;

function ac(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

/** Shaped white-noise burst: exponential amplitude decay. */
function noise(
  c: AudioContext,
  startTime: number,
  duration: number,
  amplitude: number,
  cutoffHz: number,
): void {
  const len = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.8;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = amplitude;
  const lpf = c.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = cutoffHz;
  src.connect(lpf);
  lpf.connect(g);
  g.connect(c.destination);
  src.start(startTime);
}

/** TENSION (0–0.3s) — a low hum building, like pressure finding its way out. */
export function playTension(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    const hum = c.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.setValueAtTime(34, t);
    hum.frequency.linearRampToValueAtTime(58, t + 0.3);
    const humG = c.createGain();
    humG.gain.setValueAtTime(0, t);
    humG.gain.linearRampToValueAtTime(0.1, t + 0.18);
    humG.gain.linearRampToValueAtTime(0.06, t + 0.3);
    const humF = c.createBiquadFilter();
    humF.type = "lowpass";
    humF.frequency.value = 150;
    hum.connect(humF);
    humF.connect(humG);
    humG.connect(c.destination);
    hum.start(t);
    hum.stop(t + 0.32);

    // A faint pulsing tick — the lock gem flickering.
    for (let i = 0; i < 3; i++) {
      const at = t + 0.06 + i * 0.07;
      const tick = c.createOscillator();
      tick.type = "sine";
      tick.frequency.value = 900 + i * 120;
      const tickG = c.createGain();
      tickG.gain.setValueAtTime(0.05, at);
      tickG.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      tick.connect(tickG);
      tickG.connect(c.destination);
      tick.start(at);
      tick.stop(at + 0.06);
    }
  } catch {
    // AudioContext unavailable (browser policy, iOS gesture lock) — silent
  }
}

/** CRACK (0.3–0.6s) — the lock breaking: metallic snap + brittle crack. */
export function playCrack(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    const snapLen = Math.ceil(c.sampleRate * 0.055);
    const snapBuf = c.createBuffer(1, snapLen, c.sampleRate);
    const snapD = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      snapD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.008));
    }
    const snap = c.createBufferSource();
    snap.buffer = snapBuf;
    const snapG = c.createGain();
    snapG.gain.value = 0.5;
    const snapF = c.createBiquadFilter();
    snapF.type = "bandpass";
    snapF.frequency.value = 2600;
    snapF.Q.value = 0.9;
    snap.connect(snapF);
    snapF.connect(snapG);
    snapG.connect(c.destination);
    snap.start(t);

    // Low-end thud right under the snap — gives it weight.
    const thud = c.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(120, t);
    thud.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const thudG = c.createGain();
    thudG.gain.setValueAtTime(0.22, t);
    thudG.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    thud.connect(thudG);
    thudG.connect(c.destination);
    thud.start(t);
    thud.stop(t + 0.2);

    // Brittle crack trailing off.
    noise(c, t + 0.04, 0.2, 0.22, 3400);
  } catch {
    // silent
  }
}

/** ERUPTION (0.6–0.9s) — the lid blows open: whoosh + shimmering bloom. */
export function playEruption(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    // Whoosh: filtered noise with a rising bandpass sweep.
    const whooshLen = Math.ceil(c.sampleRate * 0.5);
    const whooshBuf = c.createBuffer(1, whooshLen, c.sampleRate);
    const whooshD = whooshBuf.getChannelData(0);
    for (let i = 0; i < whooshLen; i++) {
      whooshD[i] = (Math.random() * 2 - 1) * (1 - i / whooshLen) ** 1.2;
    }
    const whoosh = c.createBufferSource();
    whoosh.buffer = whooshBuf;
    const whooshF = c.createBiquadFilter();
    whooshF.type = "bandpass";
    whooshF.Q.value = 0.7;
    whooshF.frequency.setValueAtTime(300, t);
    whooshF.frequency.exponentialRampToValueAtTime(4200, t + 0.4);
    const whooshG = c.createGain();
    whooshG.gain.value = 0.4;
    whoosh.connect(whooshF);
    whooshF.connect(whooshG);
    whooshG.connect(c.destination);
    whoosh.start(t);

    // Shimmering high bloom — the burst of light.
    const shimmer = c.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(1200, t + 0.08);
    shimmer.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
    const shimmerG = c.createGain();
    shimmerG.gain.setValueAtTime(0, t + 0.08);
    shimmerG.gain.linearRampToValueAtTime(0.14, t + 0.16);
    shimmerG.gain.linearRampToValueAtTime(0, t + 0.42);
    shimmer.connect(shimmerG);
    shimmerG.connect(c.destination);
    shimmer.start(t + 0.08);
    shimmer.stop(t + 0.45);
  } catch {
    // silent
  }
}

/**
 * REVEAL (0.9–1.4s) — the item appears. Higher rarity → richer chord,
 * longer sustain, more harmonic overtones. Apex rarities get a near-silent
 * beat then a thunderclap before the chord lands.
 */
export function playReveal(rarity?: string): void {
  try {
    const c = ac();
    const t = c.currentTime;

    const isApex = rarity === "COVERT" || rarity === "GOLD";
    const isHigh = isApex || rarity === "CLASSIFIED";

    const delay = isApex ? 0.2 : 0.02;
    const chordAt = t + delay;
    const chordLen = isApex ? 3.6 : isHigh ? 2.4 : 1.7;

    if (isApex) {
      noise(c, chordAt - 0.04, 0.4, 0.5, 1600);
    }

    const freqMap: Record<string, number[]> = {
      CONSUMER_GRADE:   [330, 440, 660],
      INDUSTRIAL_GRADE: [330, 440, 660],
      MIL_SPEC:         [293, 440, 587],
      RESTRICTED:       [277, 370, 554],
      CLASSIFIED:       [247, 370, 494, 740],
      COVERT:           [165, 247, 370, 554, 740],
      GOLD:             [110, 165, 247, 370, 554, 880],
    };
    const freqs = (rarity ? freqMap[rarity] : undefined) ?? freqMap.CONSUMER_GRADE;
    const baseVol = isApex ? 0.14 : isHigh ? 0.1 : 0.08;

    for (const freq of freqs) {
      const osc = c.createOscillator();
      osc.type = freq < 280 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const g = c.createGain();
      const partVol = (baseVol / freqs.length) * (freq > 500 ? 0.65 : 1.0);
      g.gain.setValueAtTime(0, chordAt);
      g.gain.linearRampToValueAtTime(partVol, chordAt + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, chordAt + chordLen);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(chordAt);
      osc.stop(chordAt + chordLen + 0.1);
    }
  } catch {
    // silent
  }
}
