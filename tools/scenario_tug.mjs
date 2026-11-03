// Tug-of-war scenario with screenshots: node tools/scenario_tug.mjs OUT_DIR
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "review/look/tug";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
const snap = async (name) => {
  await page.evaluate(() => { const g = window.__wgs; const s = g.goose.state(); g.setFollow({ x: s.x, z: s.z, yaw: 30, pitch: 32, dist: 9, fov: 30 }); g.render(); g.render(); });
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(await page.evaluate(() => window.__wgs.hotspot.npcs().filter((n) => n.id === "plaza:vendor"))));
};
await page.evaluate(async () => {
  const g = window.__wgs; const v = g.hotspot.npcs().find((n) => n.id === "plaza:vendor");
  await g.goose.place(v.x + 1.0, v.z + 0.3); g.goose.show(true); await g.goose.simulate(0.1, {});
  g.hotspot.grab();
  await g.goose.simulate(0.6, { my: -1 });
});
await snap("1_tug");
await page.evaluate(async () => { await window.__wgs.goose.simulate(0.7, { my: -1 }); });
await snap("2_won");
await page.evaluate(async () => { await window.__wgs.goose.simulate(0.5, {}); });
await snap("3_fallen");
await browser.close();
