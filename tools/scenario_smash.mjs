// Scenario: grab a lemonade, sprint, and drop it at a run so it shatters (spec I-9); writes review/look/smash.png
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?mute&yaw=30`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.keyboard.press("Enter");
const lem = (await page.evaluate(() => window.__wgs.hotspot.items())).find((i) => i.name === "a lemonade");
// put the goose so its bill (about 0.35 m ahead of the body) is on the lemonade
await page.evaluate(({ x, z }) => window.__wgs.goose.place(x, z), lem);
const yaw = (await page.evaluate(() => window.__wgs.goose.state())).yaw;
await page.evaluate(({ x, z, yaw }) => window.__wgs.goose.place(x - Math.sin(yaw) * 0.35, z - Math.cos(yaw) * 0.35), { ...lem, yaw });
await page.evaluate(() => window.__wgs.setFollow({ dist: 9, pitch: 30 }));
await page.waitForTimeout(400);
await page.keyboard.press("KeyG");
await page.keyboard.down("KeyD"); await page.keyboard.down("ShiftLeft");
await page.waitForTimeout(1300);
await page.keyboard.press("KeyG");
await page.keyboard.up("ShiftLeft"); await page.keyboard.up("KeyD");
await page.waitForTimeout(250);
await page.screenshot({ path: "review/look/smash.png" });
const ev = await page.evaluate(() => window.__wgs.hotspot.events(6));
console.log(JSON.stringify(ev.filter((e) => ["grab", "release", "broke"].includes(e.type))));
await browser.close();
