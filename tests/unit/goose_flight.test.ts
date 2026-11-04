import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";
import { FLIGHT, Goose, type GooseInput } from "@/goose/goose";

const input = (o: Partial<GooseInput> = {}): GooseInput =>
  ({ move: new THREE.Vector2(0, 0), run: false, crouch: false, honk: false, flap: false, ...o });

function goose() {
  const g = new Goose(new THREE.MeshBasicNodeMaterial(), { loadModel: false });
  g.place(new THREE.Vector3(0, 10, 0));   // no physics attached: flat floor at the placed height
  return g;
}

function run(g: Goose, seconds: number, inp: GooseInput) {
  let top = -Infinity;
  for (let t = 0; t < seconds; t += 1 / 60) {
    g.update(1 / 60, inp, 0);
    top = Math.max(top, g.position.y - 10);
  }
  return top;
}

describe("goose flight", () => {
  it("a tap of flap is a short hop", () => {
    const g = goose();
    g.update(1 / 60, input({ flap: true }), 0);
    const top = run(g, 1.5, input());
    expect(top).toBeGreaterThan(0.1);
    expect(top).toBeLessThan(0.4);
    expect(g.airborne).toBe(false);
    expect(g.position.y).toBeCloseTo(10, 3);
  });

  it("holding flap climbs to a capped height on limited stamina, then glides down slowly", () => {
    const g = goose();
    const top = run(g, FLIGHT.stamina + 0.3, input({ flap: true, move: new THREE.Vector2(0, 1) }));
    expect(top).toBeGreaterThan(2.8);
    expect(top).toBeLessThan(FLIGHT.ceiling + 0.15);
    expect(g.stamina).toBe(0);
    // stamina gone: still holding flap, the goose sinks at about the glide rate
    const y0 = g.position.y;
    run(g, 1, input({ flap: true, move: new THREE.Vector2(0, 1) }));
    const sink = y0 - g.position.y;
    expect(sink).toBeGreaterThan(0.3);
    expect(sink).toBeLessThan(1.2);
    expect(g.flight).toBe("glide");
    // released: it comes down and lands, softly
    let fastest = 0;
    for (let t = 0; t < 6 && g.airborne; t += 1 / 60) {
      const y = g.position.y;
      g.update(1 / 60, input(), 0);
      if (g.position.y - 10 < 0.3) fastest = Math.max(fastest, (y - g.position.y) * 60);
    }
    expect(g.airborne).toBe(false);
    expect(fastest).toBeLessThan(FLIGHT.landSink + 0.3);
    // flying covered ground forward
    expect(Math.hypot(g.position.x, g.position.z)).toBeGreaterThan(5);
  });

  it("stamina recovers on the ground", () => {
    const g = goose();
    run(g, 1.5, input({ flap: true }));
    run(g, 5, input());
    expect(g.airborne).toBe(false);
    run(g, 3, input());
    expect(g.stamina).toBeCloseTo(FLIGHT.stamina, 3);
  });
});
