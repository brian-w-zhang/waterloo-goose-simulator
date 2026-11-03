// Scenario: grab the tour guide's tote and drag it (Rapier joint); writes review/look/drag.png and prints the trail
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?mute&yaw=30`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.keyboard.press("Enter");
const cone = (await page.evaluate(() => window.__wgs.hotspot.items())).find((i) => i.name === "a tote of brochures");
await page.evaluate(({ x, z }) => window.__wgs.goose.place(x - 0.6, z), cone);
await page.waitForTimeout(300);
await page.keyboard.press("KeyG");
await page.waitForTimeout(300);
const trail = [];
for (let k = 0; k < 6; k++) {
  await page.evaluate(() => window.__wgs.goose.simulate(0.5, { mx: 1, my: -0.4, run: true }));
  const s = await page.evaluate(() => ({ g: window.__wgs.goose.state(), c: window.__wgs.hotspot.items().find((i) => i.heldBy === "goose") }));
  if (k === 1) await page.screenshot({ path: "review/look/drag.png" });
  trail.push(s.c ? { gx: +s.g.x.toFixed(2), gz: +s.g.z.toFixed(2), cx: +s.c.x.toFixed(2), cz: +s.c.z.toFixed(2) } : null);
}
await page.keyboard.press("KeyG");
await page.evaluate(() => window.__wgs.goose.simulate(4.5, {}));
const rest = (await page.evaluate(() => window.__wgs.hotspot.items())).find((i) => i.id === cone.id);
console.log(JSON.stringify(await page.evaluate(() => window.__wgs.hotspot.events(12)))); console.log(JSON.stringify({ trail, rest: rest && { x: +rest.x.toFixed(2), z: +rest.z.toFixed(2), heldBy: rest.heldBy } }));
await browser.close();
