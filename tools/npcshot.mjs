// Close-up of a hotspot character for art review: node tools/npcshot.mjs OUT.png npcId [yaw]
import { chromium } from "@playwright/test";
const [out, id = "green:guide", yaw = "250"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.evaluate(async ({ id, yaw }) => {
  const g = window.__wgs; const p = g.hotspot.npcs().find((n) => n.id === id);
  await g.goose.place(p.x + 2.5, p.z + 1.5); await g.goose.simulate(0.1, {}); g.goose.show(true);
  const q = g.hotspot.npcs().find((n) => n.id === id);
  g.setFollow({ x: q.x, z: q.z, yaw: Number(yaw), pitch: 18, dist: 6.5, fov: 30 }); g.render(); g.render();
}, { id, yaw });
await page.waitForTimeout(300);
await page.evaluate(() => window.__wgs.render());
await page.screenshot({ path: out });
await browser.close();
