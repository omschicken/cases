/**
 * OPENING SOUND — procedural Web Audio synthesis.
 *
 * No audio files. Everything is generated at runtime from oscillators and
 * shaped noise so the whole module weighs nothing and loads instantly.
 *
 * Two entry points:
 *   playChestOpen()           — call when the opening animation starts
 *   playRevealChord(rarity)   — call when the item is revealed after the reel
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

/**
 * Plays when the chest's opening animation begins (isOpening → true).
 * Timeline: sub-bass swell → rising whine → lock snap → burst.
 */
export function playChestOpen(): void {
  try {
    const c = ac();
    const t = c.currentTime;

    // Sub-bass swell (0 → 0.46s) — the pressure building inside
    const sub = c.createOscillator();
    sub.type = "sawtooth";
    sub.frequency.setValueAtTime(30, t);
    sub.frequency.linearRampToValueAtTime(62, t + 0.38);
    const subG = c.createGain();
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(0.11, t + 0.28);
    subG.gain.linearRampToValueAtTime(0, t + 0.46);
    const subF = c.createBiquadFilter();
    subF.type = "lowpass";
    subF.frequency.value = 160;
    sub.connect(subF);
    subF.connect(subG);
    subG.connect(c.destination);
    sub.start(t);
    sub.stop(t + 0.5);

    // Rising whine (charge-up: 0.30 → 0.52s)
    const whine = c.createOscillator();
    whine.type = "sine";
    whine.frequency.setValueAtTime(260, t + 0.30);
    whine.frequency.exponentialRampToValueAtTime(1800, t + 0.50);
    const whineG = c.createGain();
    whineG.gain.setValueAtTime(0, t + 0.30);
    whineG.gain.linearRampToValueAtTime(0.16, t + 0.44);
    whineG.gain.linearRampToValueAtTime(0, t + 0.52);
    whine.connect(whineG);
    whineG.connect(c.destination);
    whine.start(t + 0.30);
    whine.stop(t + 0.55);

    // Metallic snap — lock shattering at 0.46s
    const snapLen = Math.ceil(c.sampleRate * 0.055);
    const snapBuf = c.createBuffer(1, snapLen, c.sampleRate);
    const snapD = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      snapD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.008));
    }
    const snap = c.createBufferSource();
    snap.buffer = snapBuf;
    const snapG = c.createGain();
    snapG.gain.value = 0.46;
    const snapF = c.createBiquadFilter();
    snapF.type = "bandpass";
    snapF.frequency.value = 2600;
    snapF.Q.value = 0.9;
    snap.connect(snapF);
    snapF.connect(snapG);
    snapG.connect(c.destination);
    snap.start(t + 0.46);

    // Explosion burst (0.50s → fade)
    noise(c, t + 0.50, 0.62, 0.48, 2200);
  } catch {
    // AudioContext unavailable (browser policy, iOS gesture lock) — silent
  }
}

/**
 * Plays when the reel finishes and the item is revealed.
 * Higher rarity → richer chord, longer sustain, more harmonic overtones.
 * COVERT / GOLD get a brief silence then a thunderclap before the chord.
 */
export function playRevealChord(rarity: string): void {
  try {
    const c = ac();
    const t = c.currentTime;

    const isApex = rarity === "COVERT" || rarity === "GOLD";
    const isHigh = isApex || rarity === "CLASSIFIED";

    // Apex: near-silence first — then the chord hits hard with a noise burst
    const delay = isApex ? 0.28 : 0.05;
    const chordAt = t + delay;
    const chordLen = isApex ? 4.2 : isHigh ? 2.8 : 2.0;

    if (isApex) {
      noise(c, chordAt - 0.04, 0.44, 0.52, 1600);
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
    const freqs = freqMap[rarity] ?? freqMap.CONSUMER_GRADE;
    const baseVol = isApex ? 0.14 : isHigh ? 0.10 : 0.07;

    for (const freq of freqs) {
      const osc = c.createOscillator();
      osc.type = freq < 280 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const g = c.createGain();
      const partVol = (baseVol / freqs.length) * (freq > 500 ? 0.65 : 1.0);
      g.gain.setValueAtTime(0, chordAt);
      g.gain.linearRampToValueAtTime(partVol, chordAt + 0.07);
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
