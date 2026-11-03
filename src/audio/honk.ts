/** Synthesised Canada goose honk (Web Audio, no recordings): a nasal two-oscillator glide through a formant filter. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function honk(pitch = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const out = a.createGain();
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
  formant.connect(body).connect(out).connect(a.destination);
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
