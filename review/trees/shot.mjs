// Trees in the game: PORT=31xx node review/trees/shot.mjs OUT.png x z [yaw dist pitch]
// Places the goose at the nearest path point to (x, z) (game metres: x = E - 536000, z = 4813000 - N),
// waits for the tree models, screenshots and prints window.__wgs.info() (triangles, draw calls).
import { chromium } from "@playwright/test";
const [out, x, z, yaw = "30", dist = "30", pitch = "0.6"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("console", m.text()); });
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?yaw=${yaw}&hud=0`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 120000 });
await page.evaluate(async ({ x, z, dist, pitch }) => {
  const [px, pz] = window.__wgs.goose.nearestPathPoint(Number(x), Number(z));
  await window.__wgs.goose.place(px, pz);
  window.__wgs.setFollow({ dist: Number(dist), pitch: Number(pitch) });
}, { x, z, dist, pitch });
await page.waitForTimeout(5000);
await page.screenshot({ path: out });
console.log(JSON.stringify(await page.evaluate(() => {
  const i = window.__wgs.info();
  const c = window.__wgs.census();
  const sum = (f) => Object.entries(c).filter(([k]) => f(k)).reduce((a, [, v]) => a + v, 0);
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { calls: i.calls, drawnTriangles: i.triangles, loaded: i.loaded.length, loadedTriangles: sum(() => true),
    treeTriangles: sum((k) => k.startsWith("tree_") || k.startsWith("trunk_")), top };
})));
await browser.close();
