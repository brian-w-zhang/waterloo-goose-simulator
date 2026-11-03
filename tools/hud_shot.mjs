// Real game page (HUD, crowd, live loop): node tools/hud_shot.mjs OUT.png [x z yaw dist]
import { chromium } from "@playwright/test";
const [out = "review/look/hud.png", x, z, yaw = "30", dist = "20"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?yaw=${yaw}${process.env.HUD === "0" ? "&hud=0" : ""}`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
if (x !== undefined) await page.evaluate(async ({ x, z, dist }) => {
  const [px, pz] = window.__wgs.goose.nearestPathPoint(Number(x), Number(z));
  await window.__wgs.goose.place(px, pz);
  window.__wgs.setFollow({ dist: Number(dist) });
}, { x, z, dist });
await page.waitForTimeout(2500);
await page.keyboard.down("KeyW"); await page.waitForTimeout(800); await page.keyboard.up("KeyW");
await page.screenshot({ path: out });
await browser.close();
