/**
 * OPENING SOUND — procedural Web Audio synthesis, one call per burst phase.
 *
 * No audio files. Everything — including the reverb tail — is generated at
 * runtime from oscillators and shaped noise, so the whole module weighs
 * nothing and loads instantly.
 *
 * Called directly from ChestOpeningOverlay's GSAP timeline, one function
 * per phase, so sound stays locked to the beat that's actually on screen
 * instead of firing once at the start and drifting out of sync.
 */

let sharedCtx: AudioContext | null = null;
let sharedReverb: ConvolverNode | null = null;
let sharedReverbGain: GainNode | null = null;

function ac(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

/** Synthesized impulse response: a short, dense, exponentially-decaying
 *  noise tail. Gives every sound a sense of space without a single
 *  recorded sample — built once per AudioContext and reused. */
function reverbSend(c: AudioContext): GainNode {
  if (sharedReverb && sharedReverbGain && sharedCtx === c) return sharedReverbGain;

  const duration = 1.8;
  const len = Math.ceil(c.sampleRate * duration);
  const impulse = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // Dense noise shaped by an exponential decay, with a touch of early
      // reflection density falloff so it reads as a room, not static.
      const decay = (1 - i / len) ** 2.6;
      d[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  const convolver = c.createConvolver();
  convolver.buffer = impulse;
  convolver.normalize = true;

  const send = c.createGain();
  send.gain.value = 0.34;
  send.connect(convolver);
  convolver.connect(c.destination);

  sharedReverb = convolver;
  sharedReverbGain = send;
  return send;
}

/** Shaped white-noise burst: exponential amplitude decay. Connects to both
 *  the dry output and (optionally) the shared reverb send. */
function noise(
  c: AudioContext,
  startTime: number,
  duration: number,
  amplitude: number,
  cutoffHz: number,
  wet = 0,
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
  if (wet > 0) {
    const send = reverbSend(c);
    const wetG = c.createGain();
    wetG.gain.value = wet;
    lpf.connect(wetG);
    wetG.connect(send);
  }
  src.start(startTime);
}

/** A short, resonant metallic ping — struck metal, not a video-game blip.
 *  Two closely-detuned sine partials beating against each other, through a
 *  narrow bandpass, with a reverb tail for weight. */
function metallicPing(c: AudioContext, at: number, freq: number, vol: number, len: number, wet: number): void {
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 7;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0008, at + len);
  bp.connect(g);
  g.connect(c.destination);
  if (wet > 0) {
    const send = reverbSend(c);
    const wetG = c.createGain();
    wetG.gain.value = wet;
    g.connect(wetG);
    wetG.connect(send);
  }
  for (const detune of [0, 7]) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(bp);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
}

/** TENSION (0–0.3s) — a low hum building under a faint rising riser, like
 *  pressure finding its way out before the lock gives. */
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
    humG.gain.linearRampToValueAtTime(0.11, t + 0.18);
    humG.gain.linearRampToValueAtTime(0.07, t + 0.3);
    const humF = c.createBiquadFilter();
    humF.type = "lowpass";
    humF.frequency.value = 150;
    hum.connect(humF);
    humF.connect(humG);
    humG.connect(c.destination);
    hum.start(t);
    hum.stop(t + 0.32);

    // Faint filtered-noise riser underneath — the room starting to charge.
    noise(c, t, 0.32, 0.05, 900, 0.3);

    // Three ticks — the lock gem flickering, each a touch brighter.
    for (let i = 0; i < 3; i++) {
      const at = t + 0.06 + i * 0.07;
      const tick = c.createOscillator();
      tick.type = "sine";
      tick.frequency.value = 820 + i * 160;
      const tickG = c.createGain();
      tickG.gain.setValueAtTime(0.04 + i * 0.012, at);
      tickG.gain.exponentialRampToValueAtTime(0.0005, at + 0.05);
      tick.connect(tickG);
      tickG.connect(c.destination);
      tick.start(at);
      tick.stop(at + 0.06);
    }
  } catch {
    // AudioContext unavailable (browser policy, iOS gesture lock) — silent
  }
}

/** CRACK (0.3–0.6s) — the lock breaking: a felt sub punch, a brittle snap,
 *  and a resonant metallic ring trailing into the reverb. */
export function playCrack(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    // Sub punch — the physical weight of the lock giving way.
    const thud = c.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(130, t);
    thud.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const thudG = c.createGain();
    thudG.gain.setValueAtTime(0.3, t);
    thudG.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
    thud.connect(thudG);
    thudG.connect(c.destination);
    thud.start(t);
    thud.stop(t + 0.24);

    // Brittle snap transient.
    const snapLen = Math.ceil(c.sampleRate * 0.05);
    const snapBuf = c.createBuffer(1, snapLen, c.sampleRate);
    const snapD = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      snapD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.007));
    }
    const snap = c.createBufferSource();
    snap.buffer = snapBuf;
    const snapG = c.createGain();
    snapG.gain.value = 0.42;
    const snapF = c.createBiquadFilter();
    snapF.type = "bandpass";
    snapF.frequency.value = 2800;
    snapF.Q.value = 0.9;
    snap.connect(snapF);
    snapF.connect(snapG);
    snapG.connect(c.destination);
    snap.start(t);

    // Resonant metallic ring, trailing into the reverb tail.
    metallicPing(c, t + 0.015, 1760, 0.1, 0.9, 0.5);

    noise(c, t + 0.03, 0.16, 0.18, 3600);
  } catch {
    // silent
  }
}

/** ERUPTION (0.6–0.9s) — the lid blows open: a felt sub boom under a
 *  filtered whoosh, with a shimmering high bloom riding the reverb. */
export function playEruption(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    // Sub boom — more weight than the original: a short pitch-dropping kick.
    const boom = c.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(150, t);
    boom.frequency.exponentialRampToValueAtTime(36, t + 0.26);
    const boomG = c.createGain();
    boomG.gain.setValueAtTime(0.34, t);
    boomG.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
    boom.connect(boomG);
    boomG.connect(c.destination);
    boom.start(t);
    boom.stop(t + 0.36);

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
    whooshG.gain.value = 0.38;
    whoosh.connect(whooshF);
    whooshF.connect(whooshG);
    whooshG.connect(c.destination);
    whoosh.start(t);

    // Shimmering high bloom — the burst of light, sent to reverb for air.
    const shimmer = c.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(1400, t + 0.08);
    shimmer.frequency.exponentialRampToValueAtTime(2800, t + 0.3);
    const shimmerG = c.createGain();
    shimmerG.gain.setValueAtTime(0, t + 0.08);
    shimmerG.gain.linearRampToValueAtTime(0.12, t + 0.16);
    shimmerG.gain.linearRampToValueAtTime(0, t + 0.42);
    shimmer.connect(shimmerG);
    shimmerG.connect(c.destination);
    const shimmerSend = c.createGain();
    shimmerSend.gain.value = 0.4;
    shimmerG.connect(shimmerSend);
    shimmerSend.connect(reverbSend(c));
    shimmer.start(t + 0.08);
    shimmer.stop(t + 0.45);
  } catch {
    // silent
  }
}

/**
 * REVEAL (0.9–1.4s) — the item appears as a short, arpeggiated bell chord
 * through the reverb, not a flat simultaneous stack. Higher rarity → richer
 * chord, longer sustain, more overtones. Apex rarities get a near-silent
 * beat, a felt boom, then the chord cascades in with real sparkle.
 */
export function playReveal(rarity?: string): void {
  try {
    const c = ac();
    const t = c.currentTime;

    const isApex = rarity === "COVERT" || rarity === "GOLD";
    const isHigh = isApex || rarity === "CLASSIFIED";

    const delay = isApex ? 0.2 : 0.02;
    const chordAt = t + delay;
    const chordLen = isApex ? 3.8 : isHigh ? 2.6 : 1.8;
    const send = reverbSend(c);

    if (isApex) {
      noise(c, chordAt - 0.04, 0.4, 0.5, 1600);
      const boom = c.createOscillator();
      boom.type = "sine";
      boom.frequency.setValueAtTime(90, chordAt - 0.02);
      boom.frequency.exponentialRampToValueAtTime(32, chordAt + 0.3);
      const boomG = c.createGain();
      boomG.gain.setValueAtTime(0.3, chordAt - 0.02);
      boomG.gain.exponentialRampToValueAtTime(0.0008, chordAt + 0.4);
      boom.connect(boomG);
      boomG.connect(c.destination);
      boom.start(chordAt - 0.02);
      boom.stop(chordAt + 0.42);
    }

    const freqMap: Record<string, number[]> = {
      CONSUMER:   [330, 440, 660],
      INDUSTRIAL: [330, 440, 660],
      MIL_SPEC:   [293, 440, 587],
      RESTRICTED: [277, 370, 554],
      CLASSIFIED: [247, 370, 494, 740],
      COVERT:     [165, 247, 370, 554, 740, 988],
      GOLD:       [110, 165, 247, 370, 554, 880, 1108],
    };
    const freqs = (rarity ? freqMap[rarity] : undefined) ?? freqMap.MIL_SPEC;
    const baseVol = isApex ? 0.13 : isHigh ? 0.1 : 0.08;
    // Light upward arpeggio — each note lands a beat after the last,
    // bell-like, instead of one flat simultaneous stack.
    const stagger = isHigh ? 0.045 : 0.028;

    freqs.forEach((freq, i) => {
      const at = chordAt + i * stagger;
      const partVol = (baseVol / freqs.length) * (freq > 500 ? 0.7 : 1.0) * 1.4;

      // Fundamental + a quiet octave-up partial for a bell-like timbre.
      for (const [mult, mix] of [[1, 1], [2.01, 0.22]] as const) {
        const osc = c.createOscillator();
        osc.type = freq < 280 ? "sine" : "triangle";
        osc.frequency.value = freq * mult;
        const g = c.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(partVol * mix, at + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0003, at + chordLen);
        osc.connect(g);
        g.connect(c.destination);
        const wetG = c.createGain();
        wetG.gain.value = 0.38;
        g.connect(wetG);
        wetG.connect(send);
        osc.start(at);
        osc.stop(at + chordLen + 0.1);
      }
    });
  } catch {
    // silent
  }
}
