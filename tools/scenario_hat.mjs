// Scenario: bow with the spare hard hat beside the tour guide (spec I-17); writes review/look/hardhat.png
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:3100/?mute&yaw=30");
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.keyboard.press("Enter");
const hat = (await page.evaluate(() => window.__wgs.hotspot.items())).find((i) => i.name === "a spare hard hat");
await page.evaluate(({ x, z }) => window.__wgs.goose.place(x, z), hat);
await page.waitForTimeout(300);
await page.keyboard.press("KeyG");
await page.waitForTimeout(300);
const npcs = await page.evaluate(() => window.__wgs.hotspot.npcs());
const k = npcs.find((n) => n.id === "green:guide");
await page.evaluate(({ x, z }) => window.__wgs.goose.simulate(0.05, {}).then(() => 0), k);
// walk next to the keeper, then bow
await page.evaluate(async ({ x, z }) => { const g = window.__wgs.goose; }, k);
{ const n = (await page.evaluate(() => window.__wgs.hotspot.npcs())).find((n) => n.id === "green:guide");
  await page.evaluate(({ x, z }) => window.__wgs.goose.place(x + 1.1, z + 0.4), n); }
await page.evaluate(() => window.__wgs.setFollow?.({ yaw: 120, pitch: 22, dist: 6 }));
const st = await page.evaluate(() => ({ g: window.__wgs.goose.state(), n: window.__wgs.hotspot.npcs().find((n) => n.id === "green:guide"), h: window.__wgs.hotspot.items().find((i) => i.name === "a spare hard hat") })); console.log(JSON.stringify(st));
await page.evaluate(() => window.__wgs.goose.simulate(2, { crouch: true }));
console.log(JSON.stringify(await page.evaluate(() => window.__wgs.hotspot.npcs().find((n) => n.id === "green:guide"))));
await page.waitForTimeout(400);
console.log(JSON.stringify(await page.evaluate(() => window.__wgs.hotspot.tasks().filter((t) => t.done).map((t) => t.text))));
await page.screenshot({ path: "review/look/hardhat.png" });
await browser.close();
