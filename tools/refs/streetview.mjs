// Street View captures for the reference catalogue (private, git-ignored).
//   node tools/refs/streetview.mjs [--pages 2] [--limit N]
// For each probe point (docs/refs/sv_points.json) asks Google Maps for the nearest panorama; a new
// panorama within 40 m of the point is captured at six headings into docs/refs/streetview/private/.
// docs/refs/sv_panos.jsonl records every probe (resumable). Google car panoramas and the 360 photos
// people (including UW) posted are both kept; "src" says which.
import { chromium } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PAGES = Number(arg("--pages", 2));
const LIMIT = Number(arg("--limit", 1e9));
const OUT = "docs/refs/streetview/private";
const LOG = "docs/refs/sv_panos.jsonl";
const MAX_M = 40;
const HEADINGS = { car: [0, 90, 180, 270], photo: [0, 60, 120, 180, 240, 300] };
const FOV = { car: 100, photo: 90 };
const SKIP_M = 15;     // a panorama this close to one already taken adds little
mkdirSync(OUT, { recursive: true });

const R = 6371000, D2R = Math.PI / 180;
const dist = (a, b) => Math.hypot((b.lng - a.lng) * D2R * R * Math.cos(a.lat * D2R), (b.lat - a.lat) * D2R * R);
const probed = new Set(), panos = new Map();
if (existsSync(LOG)) for (const line of readFileSync(LOG, "utf8").split("\n")) {
  if (!line) continue;
  const r = JSON.parse(line);
  probed.add(`${r.qlat},${r.qlng}`);
  if (r.id && r.kept) panos.set(r.id, r);
}
const points = JSON.parse(readFileSync("docs/refs/sv_points.json", "utf8")).filter((p) => !probed.has(`${p.lat},${p.lng}`)).slice(0, LIMIT);
console.log(`${points.length} points to probe, ${panos.size} panoramas already`);

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-CA" });
const near = (p) => { for (const q of panos.values()) if (dist(p, q) < SKIP_M) return true; return false; };

async function open(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForURL(/!1s[^!]+/, { timeout: 15000 });
  const u = page.url();
  const m = u.match(/@(-?[\d.]+),(-?[\d.]+),/);
  return { id: (u.match(/!1s([^!]+)!/) || [])[1], lat: m ? Number(m[1]) : NaN, lng: m ? Number(m[2]) : NaN, src: /!2e10/.test(u) ? "photo" : "car" };
}

let next = 0, kept = 0;
async function worker(k) {
  const page = await ctx.newPage();
  while (next < points.length) {
    const p = points[next++];
    if (near(p)) { appendFileSync(LOG, JSON.stringify({ qlat: p.lat, qlng: p.lng, skipped: "near" }) + "\n"); continue; }
    let r;
    try {
      r = await open(page, `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}&heading=0&pitch=0&fov=90`);
    } catch (e) {
      appendFileSync(LOG, JSON.stringify({ qlat: p.lat, qlng: p.lng, none: true }) + "\n");
      continue;
    }
    const d = Number.isFinite(r.lat) ? dist(p, r) : Infinity;
    const isNew = r.id && !panos.has(r.id) && d < MAX_M;
    appendFileSync(LOG, JSON.stringify({ qlat: p.lat, qlng: p.lng, ...r, d: Math.round(d), kept: !!isNew }) + "\n");
    if (!isNew) continue;
    panos.set(r.id, r);
    for (const h of HEADINGS[r.src]) {
      const f = `${OUT}/${r.id}_${String(h).padStart(3, "0")}.jpg`;
      if (existsSync(f)) continue;
      try {
        await page.goto(`https://www.google.com/maps/@?api=1&map_action=pano&pano=${r.id}&heading=${h}&pitch=2&fov=${FOV[r.src]}`, { waitUntil: "domcontentloaded" });
        await page.waitForURL(/!1s/, { timeout: 15000 });
        await page.waitForTimeout(3000);
        if (!r.date) r.date = await page.evaluate(() => (document.body.innerText.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/) || [""])[0]);
        // below the date card, left of the controls, above the minimap
        await page.screenshot({ path: f, type: "jpeg", quality: 85, clip: { x: 0, y: 190, width: 1540, height: 700 } });
      } catch (e) {
        console.warn(`page ${k}: ${f} failed: ${e.message.split("\n")[0]}`);
      }
    }
    appendFileSync("docs/refs/sv_dates.jsonl", JSON.stringify({ id: r.id, date: r.date ?? "", src: r.src, lat: r.lat, lng: r.lng }) + "\n");
    if (++kept % 20 === 0) console.log(`${kept} new panoramas (${next} / ${points.length} points)`);
  }
}
await Promise.all(Array.from({ length: PAGES }, (_, k) => worker(k)));
await browser.close();
console.log(`done: ${kept} new panoramas`);
