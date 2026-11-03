/**
 * Menace score (doc 04 section 4): Tony Hawk style combos with no-harm rules. A combo stays alive
 * while events arrive within 4 s; multiplier = 1 + 0.5 x distinct event types; the n-th repeat of a
 * type scores base x 0.6^(n-1); one character scores at most 3 times per combo; a bail (someone takes
 * the item back) loses the pending points; a timeout or a finished task banks them.
 */
export const MENACE_BASE = {
  honk_wonder: 10, honk_drop: 50, steal_hand: 75, steal_worn: 100, drag_10m: 5, into_water: 120,
  chase_10s: 40, lose_chaser: 150, scatter: 60, slapstick: 150, smash: 120, interrupt: 200, task: 500,
} as const;
export type MenaceEvent = keyof typeof MENACE_BASE;

export const COMBO_WINDOW_S = 4;
const REPEAT_DECAY = 0.6;
const SAME_TARGET_MAX = 3;

export interface ComboEntry { type: MenaceEvent; target: string | null; points: number }

export class Menace {
  banked = 0;
  combo: ComboEntry[] = [];
  private last = -Infinity;
  lastBank = 0;
  lastBail = 0;

  get multiplier() { return 1 + 0.5 * new Set(this.combo.map((c) => c.type)).size; }
  get pending() { return Math.round(this.combo.reduce((s, c) => s + c.points, 0) * this.multiplier); }

  /** Score an event at time t (seconds); returns the raw points added (0 if capped). */
  add(type: MenaceEvent, t: number, target: string | null = null, count = 1): number {
    this.tick(t);
    if (target && this.combo.filter((c) => c.target === target).length >= SAME_TARGET_MAX) return 0;
    const n = this.combo.filter((c) => c.type === type).length;
    const points = MENACE_BASE[type] * count * Math.pow(REPEAT_DECAY, n);
    this.combo.push({ type, target, points });
    this.last = t;
    if (type === "task") this.bank();
    return points;
  }

  /** Bank the combo when its window has run out. */
  tick(t: number) {
    if (this.combo.length && t - this.last > COMBO_WINDOW_S) this.bank();
  }

  bank() {
    this.lastBank = this.pending;
    this.banked += this.lastBank;
    this.combo = [];
  }

  /** Someone grabbed the item back: pending points are lost. */
  bail() {
    this.lastBail = this.pending;
    this.combo = [];
  }

  /** Time left in the current combo window. */
  windowLeft(t: number) { return this.combo.length ? Math.max(0, COMBO_WINDOW_S - (t - this.last)) : 0; }
}
