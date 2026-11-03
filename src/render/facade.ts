import { abs, attribute, float, fract, fwidth, hash, mix, normalWorld, normalize, dot, positionWorld, smoothstep, step, uniform, vec2 } from "three/tsl";
import { styleRules, swatch } from "@/config";

export interface FacadeStyle {
  wall: string; accent: string; window: string; roof: string; pattern: "ribbon" | "punched" | "curtain" | "slot" | "diamond" | "none";
  storey_m: number; bay_m: number; w_lo?: number; w_hi?: number; b_lo?: number; b_hi?: number; stripe?: string; variants?: string[];
  roof_alt?: string;
  /** a glazed ground storey with mullions and a fascia band above it (retail frontage) */
  storefront?: boolean;
  /** a differently clad base storey (e.g. QNC's charcoal brick plinth under the glass) */
  base?: string;
  base_m?: number;
  /** a curtain-wall bay this many metres wide in the middle of each long wall (M3's glass centre) */
  bay_w?: number;
  bay_glass?: string;
  mansard?: boolean;
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
  const hAbove = attribute("hAbove", "float");
  // storeys count up from each building's own ground, so window rows line up with its base
  const st = fract(hAbove.div(s.storey_m)) as N;
  const su = fract(u.div(s.bay_m)) as N;
  const hTop = attribute("hTop", "float");
  const seed = attribute("seed", "float");
  // vaulted glass roofs carry hTop >= 1000 (chunkMesh VAULT_GLASS): glass with mullions, not roof colour
  const vault = step(999, hTop);
  const upper = step(float(0.9), hAbove);                      // no windows below sill height
  const below = step(hAbove, hTop.sub(0.7));                   // nor in the cornice band
  let win: N;
  switch (s.pattern) {
    case "ribbon": win = band(st, s.w_lo ?? 0.4, s.w_hi ?? 0.75).mul(float(1).sub(band(su, 0, 0.06))); break;
    case "punched": win = band(st, s.w_lo ?? 0.3, s.w_hi ?? 0.75).mul(band(su, s.b_lo ?? 0.3, s.b_hi ?? 0.7)); break;
    case "slot": win = band(st, 0.06, 0.94).mul(band(su, s.b_lo ?? 0.4, s.b_hi ?? 0.6)); break;
    // curtain wall: the wall colour is the glass; the "window" mask draws the mullion grid
    case "curtain": win = float(1).sub(band(st, 0.06, 0.94).mul(band(su, 0.05, 0.95))); break;
    // faceted metal panels (E5): alternating light and shaded diamonds, a glazed ground storey
    case "diamond": {
      const dx = abs(su.sub(0.5)).mul(2), dy = abs(st.sub(0.5)).mul(2);
      win = sharp ? step(dx.add(dy), float(1)) : smoothstep(float(0.96), float(1.04), dx.add(dy)).oneMinus();
      break;
    }
    default: win = float(0);
  }
  win = win.mul(upper).mul(below);
  // window frames and a glint (UGG windows have light frames and a paler top to the pane):
  // a ring just outside each punched or ribbon window, and the top quarter of the pane lifted
  let frame: N = float(0);
  let glint: N = float(0);
  if (s.pattern === "punched" || s.pattern === "ribbon") {
    const lo = s.w_lo ?? (s.pattern === "punched" ? 0.3 : 0.4), hi = s.w_hi ?? 0.75;
    const outer = s.pattern === "punched"
      ? band(st, lo - 0.035, hi + 0.035).mul(band(su, (s.b_lo ?? 0.3) - 0.03, (s.b_hi ?? 0.7) + 0.03))
      : band(st, lo - 0.035, hi + 0.035);
    frame = outer.mul(upper).mul(below).sub(win).max(0) as N;
    glint = win.mul(step(float(hi - (hi - lo) * 0.25), st)) as N;
  }
  let wallBase = uniform(swatch(s.wall)) as N;
  if (s.variants) {
    const k = hash(seed.add(7.3));
    const v = s.variants.map((c) => uniform(swatch(c)) as N);
    wallBase = v.slice(1).reduce((acc, c, i) => mix(acc, c, step(float((i + 1) / v.length), k)) as N, v[0]);
  }
  const windowColor = s.pattern === "diamond" ? uniform(swatch("metal_shade")) : uniform(swatch(s.window));
  let wall = mix(wallBase, windowColor, win) as N;
  // full swatches, never blends: the palette lock wants every texel on a palette colour
  wall = mix(wall, uniform(swatch("mullion")), frame) as N;
  wall = mix(wall, uniform(swatch("window_glass")), glint) as N;
  if (s.stripe) wall = mix(wall, uniform(swatch(s.stripe)), band(st, 0.84, 0.96).mul(upper)) as N;
  wall = mix(wall, uniform(swatch(s.accent)), step(hTop.sub(0.7), hAbove).mul(float(1).sub(vault))) as N;
  if (s.base) wall = mix(wall, uniform(swatch(s.base)), step(hAbove, float(s.base_m ?? 4))) as N;
  if (s.bay_w) {
    const wf = attribute("wallF", "float");
    const inBay = step(abs(wf), float(s.bay_w / 2)).mul(step(float(0.3), hAbove)).mul(below);
    // panes 1.5 m wide, one per storey, with white mullions
    const pane = band(st, 0.05, 0.95).mul(band(fract(u.div(1.5)) as N, 0.06, 0.94));
    const glass = mix(uniform(swatch("mullion")), uniform(swatch(s.bay_glass ?? "glass_teal")), pane);
    wall = mix(wall, glass, inBay) as N;
  }
  if (s.storefront) {
    const ground = step(hAbove, float(3.0)).mul(step(float(0.25), hAbove)).mul(attribute("shopFront", "float"));
    const mull = band(fract(u.div(2.2)) as N, 0.04, 0.96);
    wall = mix(wall, mix(uniform(swatch("mullion")), uniform(swatch("window_glass")), mull), ground) as N;
    wall = mix(wall, uniform(swatch(s.accent)), step(float(3.0), hAbove).mul(step(hAbove, float(3.9)))) as N;
  }
  const isRoof = step(0.7, abs(n.y)).mul(float(1).sub(vault));
  // per-building roof swatch: a hard pick between two palette colours (no blend, palette-exact)
  const roof = s.roof_alt ? mix(uniform(swatch(s.roof)), uniform(swatch(s.roof_alt)), step(0.5, hash(seed.add(3.1)))) : uniform(swatch(s.roof));
  return { color: mix(wall, roof, isRoof), isRoof, hAbove, seed };
}
