// Photograph one building from all round: node tools/refs/around.mjs docs/refs/buildings/dc
// Uses <dir>/private/around_poses.json (python -m tools.refs.around DC). Two tabs in one Chrome window:
//  - Google Earth: every wall square-on and close-ups, every corner -> <dir>/private/around/earth_*.jpg
//  - Street View: for each probe, the nearest panorama (within 35 m of the probe, 60 m of the wall) is
//    aimed at the closest point of its wall (or corner) and taken twice: fov 70 looking slightly up for
//    detail, fov 100 for context -> <dir>/private/around/sv_<wall>_<pano>_<fov>.jpg; one panorama per wall.
// Metadata for every image (pose, date, source) goes to <dir>/private/around/index.jsonl.
import { chromium } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const dir = process.argv[2];
const P = JSON.parse(readFileSync(`${dir}/private/around_poses.json`, "utf8"));
const OUT = `${dir}/private/around`;
mkdirSync(OUT, { recursive: true });
const IDX = `${OUT}/index.jsonl`;
const R = 6371000, D2R = Math.PI / 180;
const xy = (o, p) => [(p[1] - o[1]) * D2R * R * Math.cos(o[0] * D2R), (p[0] - o[0]) * D2R * R];   // metres east, north of o
const dist = (a, b) => Math.hypot(...xy(a, b));
function nearestOnWall(p, w) {
  const [ax, ay] = xy(p, w.lat_lng[0]), [bx, by] = xy(p, w.lat_lng[1]);
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
  return [ax + dx * t, ay + dy * t];
}
const walls = Object.fromEntries(P.walls.map((w) => [w.id, w]));

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-CA" });

async function earthJob() {
  const p = await ctx.newPage();
  let first = true;
  for (const s of P.earth) {
    const f = `${OUT}/earth_${s.name}.jpg`;
    if (existsSync(f)) continue;
    await p.goto(s.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (first) {
      await p.waitForTimeout(20000);
      await p.mouse.click(47, 922); await p.waitForTimeout(1500);   // basemap settings -> Clean (no labels)
      await p.mouse.click(287, 396); await p.waitForTimeout(800);
      await p.mouse.click(295, 131);
      await p.goto(s.url, { waitUntil: "domcontentloaded" });
      first = false;
    }
    // a busy GPU (several capture windows) can stall a screenshot: retry once, then skip that view
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        await p.waitForTimeout(7000 + attempt * 6000);
        await p.screenshot({ path: f, type: "jpeg", quality: 88, clip: { x: 0, y: 86, width: 1600, height: 800 }, timeout: 60000 });
        ok = true;
      } catch (e) {
        console.warn(`earth ${s.name}: ${e.message.split("\n")[0]}`);
      }
    }
    if (ok) appendFileSync(IDX, JSON.stringify({ file: f.split("/").pop(), source: "earth", wall: s.wall, url: s.url }) + "\n");
  }
}

async function svJob() {
  const p = await ctx.newPage();
  const taken = new Set();
  for (const s of P.sv) {
    const key0 = `${s.wall ?? "c" + s.corner}`;
    try {
      await p.goto(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${s.lat_lng[0]},${s.lat_lng[1]}&heading=0&fov=90`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForURL(/!1s[^!]+/, { timeout: 15000 });
    } catch { continue; }
    const u = p.url();
    const m = u.match(/@(-?[\d.]+),(-?[\d.]+),/);
    const id = (u.match(/!1s([^!]+)!/) || [])[1];
    if (!m || !id) continue;
    const pano = [Number(m[1]), Number(m[2])];
    if (dist(s.lat_lng, pano) > 35 || taken.has(`${key0}:${id}`)) continue;
    let target;
    if (s.wall) {
      target = nearestOnWall(pano, walls[s.wall]);
      if (Math.hypot(...target) > 60) continue;
    } else target = xy(pano, s.aim);
    taken.add(`${key0}:${id}`);
    const heading = (Math.atan2(target[0], target[1]) / D2R + 360) % 360;
    const src = /!2e10/.test(u) ? "photo" : "car";
    for (const [fov, pitch] of [[70, 10], [100, 5]]) {
      const f = `${OUT}/sv_${key0}_${id}_${fov}.jpg`;
      if (existsSync(f)) continue;
      try {
        await p.goto(`https://www.google.com/maps/@?api=1&map_action=pano&pano=${id}&heading=${heading.toFixed(1)}&pitch=${pitch}&fov=${fov}`, { waitUntil: "domcontentloaded" });
        await p.waitForURL(/!1s/, { timeout: 15000 });
        await p.waitForTimeout(3200);
        const date = await p.evaluate(() => (document.body.innerText.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/) || [""])[0]);
        await p.screenshot({ path: f, type: "jpeg", quality: 88, clip: { x: 0, y: 190, width: 1540, height: 700 } });
        appendFileSync(IDX, JSON.stringify({ file: f.split("/").pop(), source: "streetview", kind: src, wall: s.wall ?? null, corner: s.corner ?? null,
          pano: id, lat: pano[0], lng: pano[1], heading: +heading.toFixed(1), pitch, fov, date, dist_m: +Math.hypot(...target).toFixed(1) }) + "\n");
      } catch { /* a panorama that will not open is skipped */ }
    }
  }
}

// --earth-only re-shoots missing Earth views without re-probing Street View
await Promise.all(process.argv.includes("--earth-only") ? [earthJob()] : [earthJob(), svJob()]);
await browser.close();
console.log("done", dir);
