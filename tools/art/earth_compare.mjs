// Game vs Google Earth from the same camera: node tools/art/earth_compare.mjs ITEM [shot,shot] [OUT_DIR]
// ITEM is a catalogue id (docs/refs/catalog.json); shots default to the 8 orbit views. The Earth URL of
// each shot (docs/refs/poses_earth.json) gives the look-at point, distance, heading and tilt; the game
// camera is put at the same place and the two images are written side by side (review/art/).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";

const [item, shotArg, out = "review/art"] = process.argv.slice(2);
const want = shotArg ? new Set(shotArg.split(",")) : null;
mkdirSync(out, { recursive: true });
const campus = JSON.parse(readFileSync("config/campus.json", "utf8"));
const poses = JSON.parse(readFileSync("docs/refs/poses_earth.json", "utf8"))
  .filter((s) => s.item === item && existsSync(s.file))
  .filter((s) => { const n = s.file.match(/earth_(.+)\.jpg$/)[1]; return want ? want.has(n) : n.startsWith("orbit"); });
// lat/lng -> UTM 17N via the python helper (one call for all shots)
const parsed = poses.map((s) => {
  const m = s.url.match(/@(-?[\d.]+),(-?[\d.]+),([\d.]+)a,([\d.]+)d,([\d.]+)y,([\d.]+)h,([\d.]+)t/);
  return { ...s, lat: +m[1], lng: +m[2], alt: +m[3], d: +m[4], fov: +m[5], h: +m[6], t: +m[7] };
});
const utm = JSON.parse(execFileSync(".venv/bin/python", ["-c",
  "import json,sys; from pipeline.coords import lonlat_to_utm; print(json.dumps([lonlat_to_utm(p[1],p[0]) for p in json.loads(sys.argv[1])]))",
  JSON.stringify(parsed.map((p) => [p.lat, p.lng]))], { encoding: "utf8" }));
const base = campus.base_elevation_m;
const D2R = Math.PI / 180;

const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
const pairs = [];
for (let k = 0; k < parsed.length; k++) {
  const p = parsed[k];
  const [e, n] = utm[k];
  // target in game coordinates, then step back along the view direction
  const tx = e - campus.origin.e, tz = -(n - campus.origin.n), ty = p.alt - base;
  const hz = Math.sin(p.t * D2R) * p.d;
  const cam = { x: tx - Math.sin(p.h * D2R) * hz, z: tz + Math.cos(p.h * D2R) * hz, y: ty + Math.cos(p.t * D2R) * p.d };
  await page.evaluate(async ({ cam, p, tx, tz, vf }) => {
    const g = window.__wgs;
    await g.load(tx, tz, 1);
    // Earth's "y" is the vertical field of view (checked on DC: the building spans the same width at 35);
    // VFOV=... overrides for calibration
    const vfov = Number(vf ?? 0) || p.fov;
    g.setPose({ x: cam.x, y: cam.y, z: cam.z, yaw: p.h, pitch: -(90 - p.t), fov: vfov });
    await new Promise((r) => setTimeout(r, 2500));
    g.render(); g.render();
  }, { cam, p, tx, tz, vf: process.env.VFOV });
  const name = p.file.match(/earth_(.+)\.jpg$/)[1];
  const game = `${out}/${item}_${name}_game.jpg`;
  await page.screenshot({ path: game, type: "jpeg", quality: 85, clip: { x: 0, y: 86, width: 1600, height: 800 } });
  pairs.push({ photo: p.file, game, note: `${item} ${name}` });
}
await browser.close();
execFileSync(".venv/bin/python", ["-m", "tools.ref_sheet", out, item, JSON.stringify(pairs)], { stdio: "inherit" });
