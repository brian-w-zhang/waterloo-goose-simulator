import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type DecisionRequest, mockDecide, situationKey } from "@/ai/decide";

/**
 * Server-side decision proxy (doc 05 section 9.3). Order: in-memory cache, recorded answers
 * (data/jev/recorded.jsonl, by situation key), the live Jev model through the Vercel AI Gateway when
 * AI_GATEWAY_API_KEY is set (never sent to the client), otherwise the deterministic mock.
 * JEV_RECORD=1 appends live answers to the recording so tests and benchmarks can replay them.
 */
const MODEL = "typesafe-ai/jev-1.14.0";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/evaluate";
const TIMEOUT_MS = 1400;   // under the client deadline (1.5 s)
const REC = join(process.cwd(), "data", "jev", "recorded.jsonl");

type Answer = { choice: string; confidence: number; source: "mock" | "replay" | "live"; ms?: number };
const cache = new Map<string, Answer>();
let recorded: Map<string, Answer> | null = null;

function replay(key: string) {
  if (!recorded) {
    recorded = new Map();
    try {
      for (const line of readFileSync(REC, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const r = JSON.parse(line) as { key: string; choice: string; confidence: number };
        recorded.set(r.key, { choice: r.choice, confidence: r.confidence, source: "replay" });
      }
    } catch { /* no recording yet */ }
  }
  return recorded.get(key);
}

async function live(body: DecisionRequest, key: string): Promise<Answer | null> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) return null;
  // shuffle option order per call (Jev leans toward the first option); the order is logged with the answer
  const opts = [...body.options].sort(() => Math.random() - 0.5);
  const criteria = Object.fromEntries(opts.map((o) => [o, body.labels?.[o] ?? o.replace(/_/g, " ")]));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(GATEWAY, {
      method: "POST", signal: ctl.signal,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, state: body.situation,
        questions: { action: { type: "choice", instructions: body.question ?? "What does this person most likely do next?", criteria } } }),
    });
    if (!r.ok) { console.warn(`[jev] gateway HTTP ${r.status} after ${Date.now() - t0} ms; using the mock`); return null; }
    const j = await r.json();
    const a = j?.answers?.action;
    if (!a?.choice || !body.options.includes(a.choice)) { console.warn("[jev] answer had no allowed choice; using the mock"); return null; }
    const ans: Answer = { choice: a.choice, confidence: Number(a.confidence ?? 0), source: "live", ms: Date.now() - t0 };
    if (process.env.JEV_RECORD === "1") {
      mkdirSync(join(process.cwd(), "data", "jev"), { recursive: true });
      appendFileSync(REC, JSON.stringify({ key, choice: ans.choice, confidence: ans.confidence, order: opts,
        ms: ans.ms, generationId: j?.providerMetadata?.gateway?.generationId, model: j?.model }) + "\n");
    }
    return ans;
  } catch (e) {
    const why = (e as Error).name === "AbortError" ? `timed out at ${TIMEOUT_MS} ms` : (e as Error).message;
    console.warn(`[jev] gateway call failed (${why}); using the mock`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as DecisionRequest;
  if (!body || typeof body.situation !== "string" || !Array.isArray(body.options) || body.options.length === 0
      || body.options.length > 8 || body.situation.length > 600) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const key = situationKey(body);
  const hit = cache.get(key) ?? replay(key);
  if (hit) return Response.json(hit);
  const ans = (await live(body, key)) ?? mockDecide(body);
  cache.set(key, ans);
  return Response.json(ans);
}
