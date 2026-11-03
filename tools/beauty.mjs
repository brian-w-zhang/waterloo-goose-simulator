// Look-iteration beauty shots (GOAL-PROMPT section 0 item 6): node tools/beauty.mjs OUT_DIR
// Live game page (crowd, hotspot), goose on the nearest path to each spot, gameplay camera.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

export const SPOTS = [
  { id: "B1_green", x: 940, z: -382, yaw: 30, dist: 24 },
  { id: "B2_slc_plaza", x: 770, z: -290, yaw: 200, dist: 26 },
  { id: "B3_arts_quad", x: 1000, z: -60, yaw: 20, dist: 30 },
  { id: "B4_village1", x: 398, z: -250, yaw: 0, dist: 30 },
  { id: "B5_ion_station", x: 1101, z: -484, yaw: 120, dist: 28 },
  { id: "B6_hagey", x: 1030, z: 90, yaw: 60, dist: 30 },
];
const out = process.argv[2] ?? "review/look/beauty";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?hud=0`);
await page.waitForFunction(() => window.__wgs?.hotspot, null, { timeout: 90000 });
for (const s of SPOTS) {
  await page.evaluate(async (s) => {
    const g = window.__wgs;
    const [px, pz] = g.goose.nearestPathPoint(s.x, s.z);
    await g.goose.place(px, pz);
    g.setFollow({ yaw: s.yaw, dist: s.dist });
  }, s);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/${s.id}.png` });
}
await browser.close();
console.log("beauty", SPOTS.length);
