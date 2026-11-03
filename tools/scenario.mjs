// Scripted hotspot scenario with screenshots: node tools/scenario.mjs OUT_DIR
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "review/look/scenario";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
const snap = async (name, yaw = 250, dist = 26) => {
  await page.evaluate(({ yaw, dist }) => {
    const g = window.__wgs; const s = g.goose.state();
    g.setFollow({ x: s.x, z: s.z, yaw, pitch: 45, dist, fov: 26 }); g.render(); g.render();
  }, { yaw, dist });
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(await page.evaluate(() => window.__wgs.hotspot.npcs().map((n) => `${n.id}:${n.state}${n.mark}`))));
};
await page.evaluate(async () => {
  const g = window.__wgs;
  const prof = g.hotspot.npcs().find((n) => n.id === "green:prof");
  await g.goose.place(prof.x + 1.5, prof.z + 0.5);
  g.goose.show(true);
  await g.goose.simulate(0.2, {});
  g.hotspot.honk();                       // close honk: the professor drops the coffee
  await g.goose.simulate(0.3, {});
  const p2 = g.hotspot.npcs().find((n) => n.id === "green:prof");
  await g.goose.place(p2.x + 0.6, p2.z + 0.3);
  await g.goose.simulate(0.1, {});
  console.log("grabbed", g.hotspot.grab());
});
await snap("1_grab");
await page.evaluate(async () => { await window.__wgs.goose.simulate(1.0, { mx: 1, my: 0.2, run: true }); });
await snap("2_run");
await page.evaluate(async () => { await window.__wgs.goose.simulate(1.5, { mx: 1, my: 0.2, run: true }); });
await snap("3_chase");
await page.evaluate(async () => { await window.__wgs.goose.simulate(8, { mx: 1, my: 0.1, run: true }); });
await snap("4_later");
console.log(JSON.stringify(await page.evaluate(() => window.__wgs.hotspot.tasks())));
await browser.close();
