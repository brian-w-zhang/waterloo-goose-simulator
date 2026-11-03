import { describe, expect, it } from "vitest";
import { DecisionClient, mockDecide } from "../../src/ai/decide";

const req = { npc: "prof", state: "giveup", situation: "a goose took my coffee and ran off", options: ["routine", "search_again", "shoo"] };

describe("optional decision layer", () => {
  it("mock answers are deterministic and come from the allowed options", () => {
    const a = mockDecide(req), b = mockDecide(req);
    expect(a).toEqual(b);
    expect(req.options).toContain(a.choice);
  });

  it("falls back (null) when the service fails, and caches good answers", async () => {
    const failing = new DecisionClient("/x", async () => { throw new Error("offline"); });
    expect(await failing.decide(req)).toBeNull();
    let calls = 0;
    const ok = new DecisionClient("/x", async () => { calls++; return new Response(JSON.stringify({ choice: "shoo", confidence: 0.9, source: "mock" })); });
    expect((await ok.decide(req))?.choice).toBe("shoo");
    expect((await ok.decide(req))?.choice).toBe("shoo");
    expect(calls).toBe(1);
  });

  it("rejects choices outside the options or below the confidence threshold", async () => {
    const odd = new DecisionClient("/x", async () => new Response(JSON.stringify({ choice: "call_security", confidence: 0.99, source: "mock" })));
    expect(await odd.decide(req)).toBeNull();
    const unsure = new DecisionClient("/x", async () => new Response(JSON.stringify({ choice: "shoo", confidence: 0.4, source: "mock" })));
    expect(await unsure.decide(req)).toBeNull();
  });
});
