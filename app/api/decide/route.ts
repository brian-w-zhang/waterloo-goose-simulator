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
    let text = "";
    try {
      text = readFileSync(REC, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("[jev] cannot read the recording", e);
    }
    // one bad line (a torn append) is skipped with a warning, never the rest of the file
    text.split("\n").forEach((line, k) => {
      if (!line.trim()) return;
      try {
        const r = JSON.parse(line) as { key: string; choice: string; confidence: number };
        recorded!.set(r.key, { choice: r.choice, confidence: r.confidence, source: "replay" });
      } catch {
        console.warn(`[jev] recording line ${k + 1} is not valid JSON; skipped`);
      }
    });
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
    const conf = Number(a.confidence);
    if (!Number.isFinite(conf)) { console.warn("[jev] answer had no numeric confidence; using the mock"); return null; }
    const ans: Answer = { choice: a.choice, confidence: conf, source: "live", ms: Date.now() - t0 };
    if (process.env.JEV_RECORD === "1") {
      // a failed write (read-only file system) keeps the good answer; only the recording is lost
      try {
        mkdirSync(join(process.cwd(), "data", "jev"), { recursive: true });
        appendFileSync(REC, JSON.stringify({ key, choice: ans.choice, confidence: ans.confidence, order: opts,
          ms: ans.ms, generationId: j?.providerMetadata?.gateway?.generationId, model: j?.model }) + "\n");
      } catch (e) {
        console.error("[jev] could not record the answer", e);
      }
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
  let body: DecisionRequest;
  try {
    body = (await req.json()) as DecisionRequest;
  } catch {
    return Response.json({ error: "body is not JSON" }, { status: 400 });
  }
  if (!body || typeof body.situation !== "string" || !Array.isArray(body.options) || body.options.length === 0
      || body.options.length > 8 || body.situation.length > 600) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const key = situationKey(body);
  const hit = cache.get(key) ?? replay(key);
  if (hit) return Response.json(hit);
  const ans = (await live(body, key)) ?? mockDecide(body);
  // only live answers are cached: a fallback after a timeout must not pin the mock for this situation
  if (ans.source === "live") cache.set(key, ans);
  return Response.json(ans);
}

/**
 * Warm-up: the first gateway call after a server start pays for TLS and a cold connection and can
 * overrun the 1.4 s budget. The client calls this once when ?jev=1 starts; a keyless HEAD to the
 * gateway host opens the connection (no key is sent, nothing is billed).
 */
export async function GET() {
  if (!process.env.AI_GATEWAY_API_KEY) return Response.json({ warm: false, reason: "no key" });
  const t0 = Date.now();
  try {
    await fetch(new URL(GATEWAY).origin, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return Response.json({ warm: true, ms: Date.now() - t0 });
  } catch (e) {
    console.warn("[jev] warm-up failed", (e as Error).message);
    return Response.json({ warm: false, ms: Date.now() - t0 });
  }
}
