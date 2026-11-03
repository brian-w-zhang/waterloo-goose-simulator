import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type DecisionRequest, mockDecide, situationKey } from "@/ai/decide";

/**
 * Server-side decision proxy (doc 05 section 9.3). AI_GATEWAY_API_KEY was not available when this
 * was built, so only the replay and mock paths exist: recorded answers from data/jev/recorded.json
 * by situation key, otherwise the deterministic mock. The key never reaches the client.
 */
let recorded: Record<string, { choice: string; confidence: number }> | null = null;

function replay(key: string) {
  if (recorded === null) {
    try {
      recorded = JSON.parse(readFileSync(join(process.cwd(), "data", "jev", "recorded.json"), "utf8"));
    } catch {
      recorded = {};
    }
  }
  return recorded![key];
}

export async function POST(req: Request) {
  const body = (await req.json()) as DecisionRequest;
  if (!body || typeof body.situation !== "string" || !Array.isArray(body.options) || body.options.length === 0
      || body.options.length > 8 || body.situation.length > 600) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const rec = replay(situationKey(body));
  if (rec) return Response.json({ ...rec, source: "replay" });
  return Response.json(mockDecide(body));
}
