/** Synthesised Canada goose honk (Web Audio, no recordings): a nasal two-oscillator glide through a formant filter. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
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

/** Soft "fwap" footstep (spec S-4); splash variant when swimming. */
export function step(kind: "land" | "water") {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = kind === "water" ? 0.18 : 0.06;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, kind === "water" ? 1.5 : 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = kind === "water" ? "bandpass" : "lowpass";
  f.frequency.value = kind === "water" ? 900 : 700;
  const g = a.createGain();
  g.gain.value = kind === "water" ? 0.06 : 0.05;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
