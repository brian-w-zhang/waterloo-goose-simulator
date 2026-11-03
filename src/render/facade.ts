import { abs, attribute, float, fract, fwidth, hash, mix, normalWorld, normalize, dot, positionWorld, smoothstep, step, uniform, vec2 } from "three/tsl";
import { styleRules, swatch } from "@/config";

export interface FacadeStyle {
  wall: string; accent: string; window: string; roof: string; pattern: "ribbon" | "punched" | "curtain" | "slot" | "none";
  storey_m: number; bay_m: number; w_lo?: number; w_hi?: number; b_lo?: number; b_hi?: number; stripe?: string; variants?: string[];
}

export function facadeStyle(name: string): FacadeStyle {
  const styles = styleRules.styles as unknown as Record<string, FacadeStyle>;
  return styles[name] ?? styles.limestone;
}

// TSL node graphs are dynamically typed at runtime; @types/three generics do not compose across mix/step.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/**
 * Base (unlit) facade colour from world position: storey and bay coordinates drive window patterns,
 * a cornice band at the top of every part, a darker plinth, roof colour on up-facing faces.
 * sharp = true gives hard edges and no tint variation (palette-ID debug view).
 */
export function facadeColor(name: string, sharp: boolean) {
  const s = facadeStyle(name);
  const band = (x: N, lo: number, hi: number) => {
    if (sharp) return step(float(lo), x).mul(float(1).sub(step(float(hi), x)));
    const aa = fwidth(x).mul(1.2);
    return smoothstep(float(lo).sub(aa), float(lo).add(aa), x).mul(float(1).sub(smoothstep(float(hi).sub(aa), float(hi).add(aa), x)));
  };
  const n = normalWorld;
  const tangent = normalize(vec2(n.z.negate(), n.x).add(vec2(1e-5, 0)));
  const u = dot(positionWorld.xz, tangent);
  const st = fract(positionWorld.y.div(s.storey_m)) as N;
  const su = fract(u.div(s.bay_m)) as N;
  const hAbove = attribute("hAbove", "float");
  const hTop = attribute("hTop", "float");
  const seed = attribute("seed", "float");
  const upper = step(float(s.storey_m * 0.8), hAbove);         // no windows in the plinth zone
  const below = step(hAbove, hTop.sub(0.7));                   // nor in the cornice band
  let win: N;
  switch (s.pattern) {
    case "ribbon": win = band(st, s.w_lo ?? 0.4, s.w_hi ?? 0.75).mul(float(1).sub(band(su, 0, 0.06))); break;
    case "punched": win = band(st, s.w_lo ?? 0.3, s.w_hi ?? 0.75).mul(band(su, s.b_lo ?? 0.3, s.b_hi ?? 0.7)); break;
    case "slot": win = band(st, 0.06, 0.94).mul(band(su, s.b_lo ?? 0.4, s.b_hi ?? 0.6)); break;
    // curtain wall: the wall colour is the glass; the "window" mask draws the mullion grid
    case "curtain": win = float(1).sub(band(st, 0.06, 0.94).mul(band(su, 0.05, 0.95))); break;
    default: win = float(0);
  }
  win = win.mul(upper).mul(below);
  let wallBase = uniform(swatch(s.wall)) as N;
  if (s.variants) {
    const k = hash(seed.add(7.3));
    const v = s.variants.map((c) => uniform(swatch(c)) as N);
    wallBase = v.slice(1).reduce((acc, c, i) => mix(acc, c, step(float((i + 1) / v.length), k)) as N, v[0]);
  }
  let wall = mix(wallBase, uniform(swatch(s.window)), win) as N;
  if (s.stripe) wall = mix(wall, uniform(swatch(s.stripe)), band(st, 0.84, 0.96).mul(upper)) as N;
  wall = mix(wall, uniform(swatch(s.accent)), step(hTop.sub(0.7), hAbove)) as N;
  const isRoof = step(0.7, abs(n.y));
  return { color: mix(wall, uniform(swatch(s.roof)), isRoof), isRoof, hAbove, seed };
}
