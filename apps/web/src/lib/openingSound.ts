/**
 * OPENING SOUND — procedural Web Audio synthesis, one call per burst phase.
 *
 * No audio files. Everything — including the reverb tail — is generated at
 * runtime from oscillators and shaped noise, so the whole module weighs
 * nothing and loads instantly.
 *
 * Called directly from ChestOpeningOverlay's GSAP timeline, one function
 * per phase, so sound stays locked to the beat that's actually on screen
 * instead of firing once at the start and drifting out of sync. The
 * timeline has grown to a ~3.2s cinematic pace (tension 0.9s, crack 0.4s,
 * eruption 0.7s, reveal 0.8s, settle 0.4s) — each function below fills its
 * phase's real duration rather than a quick stab at the start of it.
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

/** Shaped noise burst: exponential amplitude decay, through a configurable
 *  filter (optionally swept from `cutoff` to `sweepTo` over its duration).
 *  Connects to both the dry output and, with `wet > 0`, the reverb send. */
function noise(
  c: AudioContext,
  startTime: number,
  duration: number,
  amplitude: number,
  cutoff: number,
  wet = 0,
  type: BiquadFilterType = "lowpass",
  sweepTo?: number,
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
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(cutoff, startTime);
  if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, startTime + duration);
  if (type === "bandpass") filt.Q.value = 1.1;
  src.connect(filt);
  filt.connect(g);
  g.connect(c.destination);
  if (wet > 0) {
    const send = reverbSend(c);
    const wetG = c.createGain();
    wetG.gain.value = wet;
    filt.connect(wetG);
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

/** Modulates an AudioParam with a sine LFO — vibrato, wobble, tremolo. */
function addLFO(c: AudioContext, param: AudioParam, rateHz: number, depth: number, start: number, duration: number): void {
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = rateHz;
  const depthGain = c.createGain();
  depthGain.gain.value = depth;
  osc.connect(depthGain);
  depthGain.connect(param);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** TENSION (~0.9s) — pressure building before the lock gives: a sub drone
 *  that wobbles like it's about to lose control, a faint electrical hum,
 *  and two metal creaks as the chest strains against itself. */
export function playTension(): void {
  try {
    const c = ac();
    const t = c.currentTime;
    const dur = 0.9;

    const drone = c.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 40;
    const droneG = c.createGain();
    droneG.gain.setValueAtTime(0, t);
    droneG.gain.linearRampToValueAtTime(0.15, t + dur);
    drone.connect(droneG);
    droneG.connect(c.destination);
    drone.start(t);
    drone.stop(t + dur + 0.05);
    addLFO(c, droneG.gain, 5.5, 0.025, t, dur);

    noise(c, t, dur, 0.04, 800, 0, "highpass");

    for (const at of [0.3, 0.65]) {
      const creak = c.createOscillator();
      creak.type = "sine";
      creak.frequency.setValueAtTime(180, t + at);
      creak.frequency.exponentialRampToValueAtTime(90, t + at + 0.12);
      const creakG = c.createGain();
      creakG.gain.setValueAtTime(0.09, t + at);
      creakG.gain.exponentialRampToValueAtTime(0.0005, t + at + 0.16);
      creak.connect(creakG);
      creakG.connect(c.destination);
      creak.start(t + at);
      creak.stop(t + at + 0.18);
    }
  } catch {
    // AudioContext unavailable (browser policy, iOS gesture lock) — silent
  }
}

/** CRACK (~0.4s) — a beat of silence, then the lock gives all at once:
 *  a felt sub punch under a metallic impact, a resonant ring, and a
 *  bright shatter trailing off. */
export function playCrack(): void {
  try {
    const c = ac();
    const t = c.currentTime;
    const hold = 0.06; // micro-pause before impact, matching the visual freeze

    noise(c, t + hold, 0.08, 0.7, 1200, 0.3, "bandpass", 4000);

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(55, t + hold);
    sub.frequency.exponentialRampToValueAtTime(32, t + hold + 0.1);
    const subG = c.createGain();
    subG.gain.setValueAtTime(0.5, t + hold);
    subG.gain.exponentialRampToValueAtTime(0.0008, t + hold + 0.12);
    sub.connect(subG);
    subG.connect(c.destination);
    sub.start(t + hold);
    sub.stop(t + hold + 0.14);

    metallicPing(c, t + hold + 0.01, 1760, 0.09, 0.8, 0.5);

    noise(c, t + hold + 0.08, 0.3, 0.22, 6000, 0.25, "highpass");
  } catch {
    // silent
  }
}

/** ERUPTION (~0.7s) — the lid blows open: a filtered whoosh sweeping
 *  upward, three sines blooming in like a space suddenly opening, and a
 *  sub-bass swell underneath the whole thing. */
export function playEruption(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    noise(c, t, 0.5, 0.35, 200, 0.25, "bandpass", 3000);

    [880, 1320, 1760].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.3 + i * 0.03);
      g.gain.linearRampToValueAtTime(0, t + 0.65);
      osc.connect(g);
      g.connect(c.destination);
      const wetG = c.createGain();
      wetG.gain.value = 0.45;
      g.connect(wetG);
      wetG.connect(reverbSend(c));
      osc.start(t);
      osc.stop(t + 0.7);
    });

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 50;
    const subG = c.createGain();
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(0.22, t + 0.3);
    subG.gain.linearRampToValueAtTime(0, t + 0.7);
    sub.connect(subG);
    subG.connect(c.destination);
    sub.start(t);
    sub.stop(t + 0.72);
  } catch {
    // silent
  }
}

/**
 * REVEAL (~0.8s, ringing on into settle via reverb) — a melodic lead tone
 * with vibrato carries the payoff, an overtone shimmers above it, and the
 * rarity's harmonic chord arpeggiates in underneath. Higher rarity → richer
 * chord, longer sustain. Apex rarities (Covert/Gold) land a felt sub hit
 * the instant the item is known — the "kingslayer" beat.
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
      boom.frequency.setValueAtTime(55, chordAt);
      boom.frequency.exponentialRampToValueAtTime(30, chordAt + 0.5);
      const boomG = c.createGain();
      boomG.gain.setValueAtTime(0.4, chordAt);
      boomG.gain.exponentialRampToValueAtTime(0.0008, chordAt + 0.6);
      boom.connect(boomG);
      boomG.connect(c.destination);
      boom.start(chordAt);
      boom.stop(chordAt + 0.62);
    }

    // Melodic lead with vibrato — the voice that carries the payoff.
    const lead = c.createOscillator();
    lead.type = "sine";
    lead.frequency.value = 1320;
    const leadG = c.createGain();
    leadG.gain.setValueAtTime(0, chordAt);
    leadG.gain.linearRampToValueAtTime(0.1, chordAt + 0.4);
    leadG.gain.exponentialRampToValueAtTime(0.0006, chordAt + 0.8);
    lead.connect(leadG);
    leadG.connect(c.destination);
    const leadWet = c.createGain();
    leadWet.gain.value = 0.3;
    leadG.connect(leadWet);
    leadWet.connect(send);
    addLFO(c, lead.frequency, 5, 15, chordAt, 0.8);
    lead.start(chordAt);
    lead.stop(chordAt + 0.85);

    // Overtone shimmer, an octave and a fifth above.
    const over = c.createOscillator();
    over.type = "sine";
    over.frequency.value = 2640;
    const overG = c.createGain();
    overG.gain.setValueAtTime(0, chordAt);
    overG.gain.linearRampToValueAtTime(0.04, chordAt + 0.4);
    overG.gain.exponentialRampToValueAtTime(0.0004, chordAt + 0.8);
    over.connect(overG);
    overG.connect(c.destination);
    over.start(chordAt);
    over.stop(chordAt + 0.85);

    // The rarity's harmonic chord, arpeggiated in underneath the lead.
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
    const baseVol = isApex ? 0.12 : isHigh ? 0.09 : 0.07;
    const stagger = isHigh ? 0.05 : 0.03;

    freqs.forEach((freq, i) => {
      const at = chordAt + 0.05 + i * stagger;
      const partVol = (baseVol / freqs.length) * (freq > 500 ? 0.7 : 1.0) * 1.4;

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
