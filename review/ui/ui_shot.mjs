// UI review shots: node review/ui/ui_shot.mjs OUT_DIR (PORT=...): title, help, teleport wipe frames, combo chip, small window
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "review/ui";
mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? 3100;
const b = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(`http://localhost:${port}/?mute`);
await p.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/title.png` });
await p.keyboard.press("KeyX");
await p.waitForTimeout(400);
await p.keyboard.press("KeyH");
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/help.png` });
await p.keyboard.press("KeyH");
// teleport transition frames
const t0 = Date.now();
await p.evaluate(() => { const [x, z] = window.__wgs.goose.nearestPathPoint(722, -290); void window.__wgs.goose.teleport(x, z, "SLC and PAC plaza"); });
for (const ms of [180, 520, 900]) {
  await p.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  await p.screenshot({ path: `${out}/wipe_${ms}.png` });
}
await p.waitForFunction(() => !window.__wgs.goose.teleporting(), null, { timeout: 20000 });
console.log("teleport took", Date.now() - t0, "ms");
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/arrive.png` });
// a combo: grab items in the green
await p.evaluate(async () => {
  await window.__wgs.goose.place(932, -377);
});
await p.waitForTimeout(800);
const r = await p.evaluate(() => { const a = window.__wgs.hotspot.grab(); window.__wgs.hotspot.honk(); return a; });
console.log("grab", r);
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/combo.png` });
// full map: search, then hover a building for its name
await p.keyboard.press("KeyM");
await p.waitForTimeout(600);
await p.fill("input", "eng");
await p.mouse.move(600, 400);
await p.waitForTimeout(400);
await p.mouse.move(604, 404);
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/map_hover.png` });
await p.keyboard.press("Escape");
await p.setViewportSize({ width: 900, height: 560 });
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/small.png` });
await b.close();
