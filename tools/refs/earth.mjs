// Google Earth Web oblique captures for the reference catalogue (private, git-ignored).
//   node tools/refs/earth.mjs [--only id,id] [--pages 3] [--limit N]
// Reads docs/refs/poses_earth.json (python -m tools.refs.poses), skips files that already exist, and
// saves the 3D view (toolbar and status bar cropped off) as JPEG. Runs the installed Chrome in a
// normal visible window (Earth needs the GPU); map labels are switched off once per tab.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const only = arg("--only") ? new Set(arg("--only").split(",")) : null;
const PAGES = Number(arg("--pages", 3));
const LIMIT = Number(arg("--limit", 1e9));
const SETTLE_MS = Number(arg("--settle", 7000));
let shots = JSON.parse(readFileSync("docs/refs/poses_earth.json", "utf8"))
  .filter((s) => (!only || only.has(s.item)) && !existsSync(s.file)).slice(0, LIMIT);
console.log(`${shots.length} shots to take`);
const LOG = "docs/refs/earth_log.tsv";

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-CA" });

async function cleanStyle(p) {
  // Basemap settings (thumbnail, bottom left) -> Details: Clean (no borders, labels, places or roads)
  try {
    await p.mouse.click(47, 922);
    await p.waitForTimeout(1500);
    await p.mouse.click(287, 396);
    await p.waitForTimeout(800);
    await p.mouse.click(295, 131);
    return true;
  } catch (e) {
    console.warn("could not switch to the Clean map style:", e.message.split("\n")[0]);
    return false;
  }
}

let next = 0, done = 0;
async function worker(k) {
  const p = await ctx.newPage();
  let first = true;
  while (next < shots.length) {
    const s = shots[next++];
    try {
      await p.goto(s.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      if (first) { await p.waitForTimeout(20000); await cleanStyle(p); await p.goto(s.url, { waitUntil: "domcontentloaded" }); first = false; }
      await p.waitForTimeout(SETTLE_MS);
      mkdirSync(dirname(s.file), { recursive: true });
      await p.screenshot({ path: s.file, type: "jpeg", quality: 85, clip: { x: 0, y: 86, width: 1600, height: 800 } });
      appendFileSync(LOG, `${new Date().toISOString()}\t${s.item}\t${s.file}\t${s.url}\n`);
      if (++done % 50 === 0) console.log(`${done} / ${shots.length}`);
    } catch (e) {
      console.warn(`page ${k}: ${s.file} failed: ${e.message.split("\n")[0]}`);
    }
  }
}
await Promise.all(Array.from({ length: PAGES }, (_, k) => worker(k)));
await browser.close();
console.log(`done ${done}`);
