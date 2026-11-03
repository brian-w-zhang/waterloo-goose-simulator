// Headless playtest with real keyboard input and a screen recording.
// Usage: node tools/playtest.mjs [out_dir]   (production server on PORT, default 3100)
// The script only reads state through window.__wgs to decide which keys to press; movement, honks
// and grabs go through the same input path a player uses. Writes playtest.json and a .webm video.
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "review/playtest";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?yaw=30${process.env.WGS_WEBGL === "1" ? "&webgl" : ""}`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 90000 });
await page.keyboard.press("Enter"); // dismiss the title card
const state = () => page.evaluate(() => ({ g: window.__wgs.goose.state(), npcs: window.__wgs.hotspot.npcs(), tasks: window.__wgs.hotspot.tasks(), music: window.__wgs.hotspot.music() }));
const held = new Set();
const press = async (want) => {
  for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
};
/** Steer with WASD toward (x, z) until within r metres or the time runs out; camera yaw is 30 degrees. */
async function goTo(x, z, r = 1.0, maxS = 25, run = false, follow = null) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxS * 1000) {
    const s = await state();
    const g = s.g;
    if (follow) { const n = s.npcs.find((q) => q.id === follow); x = n.x; z = n.z; }
    const dx = x - g.x, dz = z - g.z;
    if (Math.hypot(dx, dz) < r) break;
    const heading = (Math.atan2(dx, -dz) * 180) / Math.PI - 30;
    const a = (heading * Math.PI) / 180, fx = Math.cos(a), sx = Math.sin(a);
    const keys = new Set();
    if (fx > 0.38) keys.add("KeyW");
    if (fx < -0.38) keys.add("KeyS");
    if (sx > 0.38) keys.add("KeyD");
    if (sx < -0.38) keys.add("KeyA");
    if (run) keys.add("ShiftLeft");
    await press(keys);
    await page.waitForTimeout(60);
  }
  await press(new Set());
}
const log = [];
const step = async (what, fn) => { const t = Date.now(); await fn(); const s = await state(); log.push({ what, ms: Date.now() - t, goose: s.g, music: s.music, done: s.tasks.filter((t) => t.done).map((t) => t.text) }); };

await step("walk to the professor", async () => {
  await goTo(0, 0, 1.8, 25, false, "green:prof");
});
await step("honk at the professor", async () => { await page.keyboard.press("Space"); await page.waitForTimeout(900); });
await step("grab the dropped coffee", async () => {
  const items = await page.evaluate(() => window.__wgs.hotspot.items?.() ?? []);
  const cup = items.find((i) => i.name === "the professor's coffee");
  if (cup) await goTo(cup.x, cup.z, 0.5, 8);
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(300);
});
await step("run away with it", async () => {
  const { g } = await state();
  await goTo(g.x + 40, g.z - 25, 2, 14, true);
  await page.waitForTimeout(500);
});
await step("drop it and wander", async () => { await page.keyboard.press("KeyG"); await page.waitForTimeout(3000); });

const final = await state();
const videoPath = await page.video()?.path();
await page.close();
await ctx.close();
await browser.close();
// rename this run's own recording (raw recordings have random names, so never pick by listing)
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const vid = videoPath ? videoPath.split("/").pop() : null;
if (vid) renameSync(videoPath, join(out, `playtest-${stamp}.webm`));
const result = { tasks_done: final.tasks.filter((t) => t.done).map((t) => t.text), steps: log, errors, video: vid ? `playtest-${stamp}.webm` : null };
writeFileSync(join(out, "playtest.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify({ tasks_done: result.tasks_done, errors: errors.length, video: result.video }));
