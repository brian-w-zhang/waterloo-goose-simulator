/**
 * Optional NPC decision layer (doc 05 section 9), off by default (?jev=1). Fallback first: the
 * deterministic sim always acts at once; an answer that arrives within the deadline may switch the
 * NPC only if it is still in the same state and the choice is one of the allowed options.
 */

export interface DecisionRequest {
  npc: string; state: string; situation: string; options: string[];
  /** Plain-language description per option (Jev choice criteria). */
  labels?: Record<string, string>;
  question?: string;
}
export interface DecisionAnswer { choice: string; confidence: number; source: "mock" | "replay" | "live" }

const DEADLINE_MS = 1500;
const MAX_IN_FLIGHT = 8;
const MIN_CONFIDENCE = 0.6;

/** Situation key: identical situations reuse answers (bounds cost and keeps replays stable). */
export function situationKey(r: DecisionRequest) {
  return `${r.state}|${r.situation}|${r.options.join(",")}`;
}

export class DecisionClient {
  private cache = new Map<string, DecisionAnswer>();
  private inFlight = 0;
  stats = { requests: 0, cacheHits: 0, late: 0, applied: 0 };

  constructor(private endpoint = "/api/decide", private fetchFn: typeof fetch = (...a) => fetch(...a)) {}

  /** Resolves with an answer, or null if the deadline passes, the cap is hit or the call fails. */
  async decide(r: DecisionRequest): Promise<DecisionAnswer | null> {
    const key = situationKey(r);
    const hit = this.cache.get(key);
    if (hit) { this.stats.cacheHits++; return hit; }
    if (this.inFlight >= MAX_IN_FLIGHT) return null;
    this.inFlight++;
    this.stats.requests++;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DEADLINE_MS);
    try {
      const res = await this.fetchFn(this.endpoint, { method: "POST", body: JSON.stringify(r), signal: ctl.signal,
        headers: { "content-type": "application/json" } });
      if (!res.ok) return null;
      const a = (await res.json()) as DecisionAnswer;
      if (!r.options.includes(a.choice) || a.confidence < MIN_CONFIDENCE) return null;
      this.cache.set(key, a);
      return a;
    } catch {
      this.stats.late++;
      return null;
    } finally {
      clearTimeout(timer);
      this.inFlight--;
    }
  }
}

/** Deterministic mock: a stable pick from the options by a hash of the situation (no network). */
export function mockDecide(r: DecisionRequest): DecisionAnswer {
  let h = 2166136261;
  for (const ch of situationKey(r)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const u = (h >>> 0) / 4294967296;
  return { choice: r.options[Math.floor(u * r.options.length)], confidence: 0.6 + 0.4 * ((u * 7) % 1), source: "mock" };
}
