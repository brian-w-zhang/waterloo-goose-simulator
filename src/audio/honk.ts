/** Synthesised Canada goose honk (Web Audio, no recordings): a nasal two-oscillator glide through a formant filter. */
let ctx: AudioContext | null = null;

let unavailable = false;

/** The shared AudioContext, or null where audio is unavailable (logged once; the game plays on silently). */
function audio(): AudioContext | null {
  if (typeof window === "undefined" || unavailable) return null;
  try {
    ctx ??= new AudioContext();
  } catch (e) {
    unavailable = true;
    console.warn("[audio] unavailable, playing silently", e);
    return null;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => { /* needs a user gesture; the next sound retries */ });
  return ctx;
}

/**
 * Item-modified honks (spec I-11): "cone" adds conical resonance (a louder, lower honk ringing in
 * a short comb); "muffled" honks into a cup (dull and quiet with a hollow slap).
 */
export type HonkMod = "none" | "cone" | "muffled";

export function honk(pitch = 1, mod: HonkMod = "none") {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const out = a.createGain();
  const dest = honkChain(a, mod);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.35, t + 0.025);
  out.gain.setValueAtTime(0.35, t + 0.16);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  const formant = a.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 1150;
  formant.Q.value = 3.5;
  const body = a.createBiquadFilter();
  body.type = "lowpass";
  body.frequency.value = 2600;
  for (const [type, mult, gain] of [["sawtooth", 1, 0.7], ["square", 2.01, 0.25]] as const) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(420 * pitch * mult, t);
    o.frequency.exponentialRampToValueAtTime(330 * pitch * mult, t + 0.28);
    const g = a.createGain();
    g.gain.value = gain;
    o.connect(g).connect(formant);
    o.start(t);
    o.stop(t + 0.34);
  }
  if (mod === "cone") { formant.frequency.value = 820; formant.Q.value = 2.2; body.frequency.value = 1800; }
  if (mod === "muffled") { formant.frequency.value = 700; body.frequency.value = 900; }
  formant.connect(body).connect(out).connect(dest);
}

function honkChain(a: AudioContext, mod: HonkMod): AudioNode {
  if (mod === "none") return a.destination;
  const level = a.createGain();
  level.gain.value = mod === "cone" ? 1.6 : 0.6;
  level.connect(a.destination);
  // a short feedback delay: a ringing tube for the cone, a hollow slap for the cup
  const delay = a.createDelay(0.2);
  delay.delayTime.value = mod === "cone" ? 0.011 : 0.045;
  const fb = a.createGain();
  fb.gain.value = mod === "cone" ? 0.72 : 0.35;
  const input = a.createGain();
  input.connect(level);
  input.connect(delay).connect(fb).connect(delay);
  fb.connect(level);
  return input;
}

/** Short click for grab and release. */
export function click(freq = 900) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.06);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.09);
}

/** Two-note chime for a finished task. */
export function chime() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  [660, 990].forEach((f, k) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + k * 0.12);
    g.gain.exponentialRampToValueAtTime(0.18, t + k * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.12 + 0.5);
    o.connect(g).connect(a.destination);
    o.start(t + k * 0.12);
    o.stop(t + k * 0.12 + 0.55);
  });
}

/** Footstep surfaces (doc 03 R-S2): a soft "fwap" on grass, a slap on paving, a splash when swimming. */
export type StepSurface = "grass" | "hard" | "water";

const STEP: Record<StepSurface, { len: number; decay: number; filter: BiquadFilterType; hz: number; q: number; gain: number }> = {
  grass: { len: 0.07, decay: 3, filter: "lowpass", hz: 520, q: 0.7, gain: 0.05 },
  hard: { len: 0.045, decay: 5, filter: "bandpass", hz: 1700, q: 1.2, gain: 0.07 },
  water: { len: 0.18, decay: 1.5, filter: "bandpass", hz: 900, q: 1, gain: 0.06 },
};

export function step(kind: StepSurface) {
  const a = audio();
  if (!a) return;
  const s = STEP[kind];
  const t = a.currentTime;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * s.len), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, s.decay);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = s.filter;
  f.frequency.value = s.hz;
  f.Q.value = s.q;
  const g = a.createGain();
  g.gain.value = s.gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** Glass shattering (spec I-9): a bright filtered noise burst with a few tinkles. */
export function smash() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.35);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2500;
  const g = a.createGain();
  g.gain.value = 0.3;
  src.connect(hp).connect(g).connect(a.destination);
  src.start(t);
  [3100, 4200, 5300].forEach((f, k) => {
    const o = a.createOscillator(), og = a.createGain();
    o.frequency.value = f;
    og.gain.setValueAtTime(0.05, t + 0.04 * (k + 1));
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 * (k + 1) + 0.25);
    o.connect(og).connect(a.destination);
    o.start(t + 0.04 * (k + 1));
    o.stop(t + 0.04 * (k + 1) + 0.3);
  });
}
