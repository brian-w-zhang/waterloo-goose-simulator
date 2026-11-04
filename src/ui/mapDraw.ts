import { swatchHex } from "@/config";
import { displayName, MAIN_LABELS, type Place } from "./places";

/**
 * Illustrated campus map, drawn as vectors (crisp at any zoom) from public/world/minimap.json.
 * Shapes are bucketed into a coarse grid per layer and each bucket is one Path2D, so a view only fills the
 * few buckets it can see: the corner map redraws every frame for well under a millisecond.
 */
export interface MapData {
  layers: Record<string, number[][]>;
  buildings: { r: number[][]; uw: boolean; s: string }[];
  places: Place[];
}

type BB = [number, number, number, number];
interface Bucket { path: Path2D; bb: BB }
interface Building { rings: number[][]; bb: BB; uw: boolean; place?: Place }
export interface MapModel {
  layers: { name: string; buckets: Bucket[] }[];
  uw: Bucket[]; other: Bucket[]; trees: Bucket[];
  buildings: Building[];
  places: Place[];
  bounds: BB;
}
export interface View { cx: number; cz: number; scale: number; rot: number; w: number; h: number }

const CELL = 250;
const ORDER = ["wood", "pitch", "parking", "road", "paving", "path", "rail", "water"];
const ui = (k: string) => swatchHex(k, "ui");
const FILL: Record<string, string> = {
  wood: "map_wood", pitch: "map_pitch", parking: "map_parking", road: "map_road", paving: "map_paving",
  path: "map_path", rail: "map_rail", water: "map_water",
};

const ringBB = (r: number[]): BB => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); z0 = Math.min(z0, r[k + 1]); z1 = Math.max(z1, r[k + 1]); }
  return [x0, z0, x1, z1];
};
const grow = (a: BB, b: BB) => { a[0] = Math.min(a[0], b[0]); a[1] = Math.min(a[1], b[1]); a[2] = Math.max(a[2], b[2]); a[3] = Math.max(a[3], b[3]); };
const addRing = (p: Path2D, r: number[]) => { p.moveTo(r[0], r[1]); for (let k = 2; k < r.length; k += 2) p.lineTo(r[k], r[k + 1]); p.closePath(); };

function inRing(r: number[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Group rings into grid buckets (by the centre of each ring's box), one Path2D per bucket. */
function bucketise(rings: number[][], each?: (p: Path2D, r: number[]) => void): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const r of rings) {
    const bb = ringBB(r);
    const key = `${Math.floor((bb[0] + bb[2]) / 2 / CELL)},${Math.floor((bb[1] + bb[3]) / 2 / CELL)}`;
    let b = m.get(key);
    if (!b) m.set(key, b = { path: new Path2D(), bb: [...bb] as BB });
    (each ?? addRing)(b.path, r);
    grow(b.bb, bb);
  }
  return [...m.values()];
}

/** Trees as dots: a jittered grid inside the wooded areas (deterministic, so the map never shimmers). */
function treeDots(woods: number[][]): number[][] {
  const out: number[][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const STEP = 7;
  for (const r of woods) {
    const [x0, z0, x1, z1] = ringBB(r);
    for (let x = x0 + STEP / 2; x < x1; x += STEP) for (let z = z0 + STEP / 2; z < z1; z += STEP) {
      const px = x + (rnd() - 0.5) * STEP * 0.8, pz = z + (rnd() - 0.5) * STEP * 0.8;
      if (inRing(r, px, pz)) out.push([px, pz, 2 + rnd() * 1.4]);
    }
  }
  return out;
}

export function buildModel(d: MapData): MapModel {
  const layers = ORDER.filter((n) => d.layers[n]).map((name) => ({ name, buckets: bucketise(d.layers[name]) }));
  const dots = treeDots(d.layers.wood ?? []);
  const trees = bucketise(dots.map(([x, z, r]) => [x - r, z - r, x + r, z + r]), (p, b) => {
    const r = (b[2] - b[0]) / 2;
    p.moveTo(b[0] + 2 * r, b[1] + r); p.arc(b[0] + r, b[1] + r, r, 0, Math.PI * 2);
  });
  const buildings: Building[] = d.buildings.map((b) => {
    const bb = ringBB(b.r[0]);
    for (const r of b.r.slice(1)) grow(bb, ringBB(r));
    return { rings: b.r, bb, uw: b.uw };
  });
  // each building place's point lies inside its footprint (the pipeline uses representative_point)
  for (const p of d.places) {
    if (p.kind !== "building") continue;
    const b = buildings.find((b) => p.x >= b.bb[0] && p.x <= b.bb[2] && p.z >= b.bb[1] && p.z <= b.bb[3] && b.rings.some((r) => inRing(r, p.x, p.z)));
    if (b) b.place = p;
  }
  const bounds: BB = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of layers) for (const b of l.buckets) grow(bounds, b.bb);
  return {
    layers, trees, buildings, places: d.places, bounds,
    uw: bucketise(d.buildings.filter((b) => b.uw).flatMap((b) => b.r)),
    other: bucketise(d.buildings.filter((b) => !b.uw).flatMap((b) => b.r)),
  };
}

/** The building under a world point, if any. */
export function buildingAt(m: MapModel, x: number, z: number): Building | undefined {
  return m.buildings.find((b) => x >= b.bb[0] && x <= b.bb[2] && z >= b.bb[1] && z <= b.bb[3] && b.rings.some((r) => inRing(r, x, z)));
}

export const uiFont = () =>
  (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim()) || "ui-rounded, system-ui, sans-serif";

/** screen position of a world point in a view */
export function toScreen(v: View, x: number, z: number): [number, number] {
  const dx = (x - v.cx) * v.scale, dz = (z - v.cz) * v.scale, c = Math.cos(v.rot), s = Math.sin(v.rot);
  return [v.w / 2 + dx * c - dz * s, v.h / 2 + dx * s + dz * c];
}
export function toWorld(v: View, sx: number, sy: number): [number, number] {
  const dx = sx - v.w / 2, dy = sy - v.h / 2, c = Math.cos(-v.rot), s = Math.sin(-v.rot);
  return [v.cx + (dx * c - dy * s) / v.scale, v.cz + (dx * s + dy * c) / v.scale];
}

export interface DrawOpts {
  labels: "main" | "zoom";
  hover?: Building;
  markers?: { x: number; z: number; label: string }[];
}

/** Draw the map into the current canvas (the caller sets the device-pixel transform and clip). */
export function drawMap(g: CanvasRenderingContext2D, m: MapModel, v: View, o: DrawOpts) {
  const reach = Math.hypot(v.w, v.h) / 2 / v.scale;
  const seen = (bb: BB) => bb[2] >= v.cx - reach && bb[0] <= v.cx + reach && bb[3] >= v.cz - reach && bb[1] <= v.cz + reach;
  const px = 1 / v.scale; // one CSS pixel in metres
  g.fillStyle = ui("map_grass");
  g.fillRect(0, 0, v.w, v.h);
  g.save();
  g.translate(v.w / 2, v.h / 2); g.rotate(v.rot); g.scale(v.scale, v.scale); g.translate(-v.cx, -v.cz);
  g.lineJoin = "round";
  for (const l of m.layers) {
    g.fillStyle = ui(FILL[l.name]);
    for (const b of l.buckets) {
      if (!seen(b.bb)) continue;
      g.fill(b.path);
      if (l.name === "water") { g.strokeStyle = ui("map_water_edge"); g.lineWidth = 2 * px; g.stroke(b.path); }
      if (l.name === "road") { g.strokeStyle = ui("map_road_edge"); g.lineWidth = 1 * px; g.stroke(b.path); }
      if (l.name === "pitch" && v.scale > 0.6) { g.strokeStyle = ui("map_pitch_line"); g.lineWidth = 1.5 * px; g.stroke(b.path); }
    }
    if (l.name === "wood" && v.scale > 0.45) {
      // trees on top of the woods: a darker dot offset down-right, then the crown
      const off = Math.min(1.2, 1.4 * px);
      for (const b of m.trees) {
        if (!seen(b.bb)) continue;
        g.save(); g.translate(off, off); g.fillStyle = ui("map_tree_dark"); g.fill(b.path); g.restore();
        g.fillStyle = ui("map_tree"); g.fill(b.path);
      }
    }
  }
  // buildings: a soft drop shadow, a flat fill, a gentle outline
  const shadow = Math.max(1.5 * px, 1.2);
  for (const [set, fill] of [[m.other, "map_building"], [m.uw, "map_building_uw"]] as const) {
    g.save(); g.translate(shadow, shadow); g.fillStyle = ui("map_shadow");
    for (const b of set) if (seen(b.bb)) g.fill(b.path);
    g.restore();
    g.fillStyle = ui(fill); g.strokeStyle = ui("map_building_edge"); g.lineWidth = Math.max(px, 0.25);
    for (const b of set) if (seen(b.bb)) { g.fill(b.path); g.stroke(b.path); }
  }
  if (o.hover) {
    const p = new Path2D();
    o.hover.rings.forEach((r) => addRing(p, r));
    g.fillStyle = ui("map_building_hover"); g.fill(p);
    g.strokeStyle = ui("map_label"); g.lineWidth = 1.6 * px; g.stroke(p);
  }
  g.restore();

  // labels stay upright whatever the map rotation; a paper halo keeps them readable on any fill
  const font = uiFont();
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  const placed: BB[] = [];
  const label = (text: string, x: number, y: number, size: number, colour: string, weight = 800) => {
    g.font = `${weight} ${size}px ${font}`;
    const w = g.measureText(text).width / 2 + 2, h = size / 2 + 1;
    const bb: BB = [x - w, y - h, x + w, y + h];
    if (placed.some((q) => q[0] < bb[2] && q[2] > bb[0] && q[1] < bb[3] && q[3] > bb[1])) return;
    placed.push(bb);
    g.lineWidth = 3.5; g.strokeStyle = ui("paper"); g.strokeText(text, x, y);
    g.fillStyle = colour; g.fillText(text, x, y);
  };
  for (const mk of o.markers ?? []) {
    const [x, y] = toScreen(v, mk.x, mk.z);
    if (x < -20 || y < -20 || x > v.w + 20 || y > v.h + 20) continue;
    star(g, x, y, o.labels === "main" ? 7 : 10);
    placed.push([x - 10, y - 10, x + 10, y + 10]);
    if (o.labels === "zoom") label(mk.label, x, y + 20, 12, ui("accent_dark"), 900);
  }
  for (const p of m.places) {
    const water = p.kind === "water";
    if (o.labels === "main" ? !water && !MAIN_LABELS.has(p.id) : !water && v.scale < 0.55 && !MAIN_LABELS.has(p.id)) continue;
    const [x, y] = toScreen(v, p.x, p.z);
    if (x < -40 || y < -20 || x > v.w + 40 || y > v.h + 20) continue;
    if (water) label(displayName(p.name), x, y, o.labels === "main" ? 10 : 12, ui("map_water_edge"), 800);
    else label(p.id, x, y, o.labels === "main" ? 10.5 : v.scale > 1.5 ? 14 : 12, ui("map_label"));
  }
}

/** A gold star badge (hotspots: where the goose has business). */
export function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.arc(0, 1.5, r + 2.5, 0, Math.PI * 2); g.fillStyle = ui("map_shadow"); g.fill();
  g.beginPath(); g.arc(0, 0, r + 2.5, 0, Math.PI * 2); g.fillStyle = ui("keycap"); g.fill();
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = ui("gold"); g.fill();
  g.restore();
}

/** The goose marker: a paper disc with a pointed heading tip; `rot` turns the tip (0 = up). */
export function gooseMarker(g: CanvasRenderingContext2D, x: number, y: number, rot: number, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.arc(0, 2, 10, 0, Math.PI * 2); g.globalAlpha = 0.25; g.fillStyle = ui("shadow"); g.fill(); g.globalAlpha = 1;
  g.rotate(rot);
  g.beginPath();
  g.moveTo(0, -15); g.lineTo(6.5, -6.5); g.arc(0, 0, 9, -Math.PI / 4, Math.PI * 1.25); g.closePath();
  g.fillStyle = ui("keycap"); g.fill(); g.lineWidth = 2.5; g.strokeStyle = ui("text"); g.stroke();
  // a little goose head: black neck dot with the white chinstrap
  g.beginPath(); g.arc(0, -1, 4.2, 0, Math.PI * 2); g.fillStyle = ui("text"); g.fill();
  g.beginPath(); g.arc(0, 0.3, 1.9, 0, Math.PI); g.fillStyle = ui("keycap"); g.fill();
  g.restore();
}
