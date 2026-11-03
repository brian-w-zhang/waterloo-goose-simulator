/**
 * Adaptive piano (spec S-8 to S-11): mostly silence; a sparse, low-energy phrase while people are
 * near and calm; a brisk chase phrase while someone chases or tugs. The state changes on the next
 * beat so the music seems to watch the player. The music is an original procedural composition
 * (no recordings, no existing piece) played by a small Web Audio piano voice.
 */
export type MusicState = "silent" | "calm" | "chase";

const BEAT_S = 0.42;
// C major-ish progression with a playful turn; chord tones in MIDI notes
const CHORDS = [[48, 55, 64], [53, 57, 65], [55, 59, 67], [48, 52, 60], [45, 52, 60], [50, 53, 62], [43, 50, 59], [48, 55, 64]];
const CALM_MELODY = [76, -1, 74, -1, 72, -1, -1, -1, 74, -1, 76, -1, 79, -1, -1, -1];
const CHASE_MELODY = [72, 74, 76, 79, 77, 76, 74, 72, 71, 72, 74, 76, 74, 72, 71, 67];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private state: MusicState = "silent";
  private want: MusicState = "silent";
  private beat = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  volume = 0.5;

  start() {
    if (typeof window === "undefined" || this.timer) return;
    try {
      this.ctx = new AudioContext();
    } catch (e) {
      console.warn("[music] audio unavailable, no music", e);
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.35;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  set(state: MusicState) { this.want = state; }

  get current() { return this.state; }

  private note(m: number, t: number, dur: number, vel: number) {
    const a = this.ctx!, out = this.master!;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2400 + vel * 3000;
    for (const [type, mul, lvl] of [["triangle", 1, 1], ["sine", 2, 0.35], ["sine", 3, 0.12]] as const) {
      const o = a.createOscillator();
      o.type = type;
      o.frequency.value = hz(m) * mul;
      const og = a.createGain();
      og.gain.value = lvl;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    f.connect(g).connect(out);
  }

  /** Lookahead scheduler: state switches only on beat boundaries. */
  private schedule() {
    const a = this.ctx;
    if (!a) return;
    if (a.state === "suspended") a.resume().catch(() => { /* needs a user gesture; retried every 50 ms */ });
    while (this.next < a.currentTime + 0.25) {
      if (this.want !== this.state && this.beat % 2 === 0) this.state = this.want;
      const t = this.next;
      const bar = Math.floor(this.beat / 4) % CHORDS.length;
      const chord = CHORDS[bar];
      const step = this.beat % 16;
      if (this.state === "calm") {
        if (this.beat % 4 === 0) chord.forEach((m, k) => this.note(m, t + k * 0.03, 1.6, 0.12));
        const mel = CALM_MELODY[step];
        if (mel > 0) this.note(mel, t, 0.9, 0.16);
      } else if (this.state === "chase") {
        // stride bass on beats, chord stabs on off-beats, running melody in eighths
        this.note(chord[0] - (this.beat % 2 ? 0 : 12), t, 0.25, 0.2);
        this.note(chord[1] + 12, t + BEAT_S * 0.5, 0.18, 0.11);
        this.note(chord[2] + 12, t + BEAT_S * 0.5, 0.18, 0.1);
        this.note(CHASE_MELODY[step], t, 0.2, 0.18);
        this.note(CHASE_MELODY[(step + 1) % 16], t + BEAT_S * 0.5, 0.2, 0.15);
      }
      this.beat++;
      this.next += this.state === "chase" ? BEAT_S * 0.72 : BEAT_S;
    }
  }
}
