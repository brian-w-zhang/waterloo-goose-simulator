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
const state = () => page.evaluate(() => ({ g: window.__wgs.goose.state(), cam: window.__wgs.follow().yaw, npcs: window.__wgs.hotspot.npcs(), tasks: window.__wgs.hotspot.tasks(), music: window.__wgs.hotspot.music() }));
const held = new Set();
const press = async (want) => {
  for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
};
/** Steer with WASD toward (x, z) until within r metres or the time runs out, relative to the live camera yaw. */
async function goTo(x, z, r = 1.0, maxS = 25, run = false, follow = null) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxS * 1000) {
    const s = await state();
    const g = s.g;
    if (follow) { const n = s.npcs.find((q) => q.id === follow); x = n.x; z = n.z; }
    const dx = x - g.x, dz = z - g.z;
    if (Math.hypot(dx, dz) < r) break;
    const heading = (Math.atan2(dx, -dz) * 180) / Math.PI - s.cam;
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
const step = async (what, fn) => { const t = Date.now(); await fn(); const s = await state(); log.push({ what, ms: Date.now() - t, goose: s.g, music: s.music, done: s.tasks.filter((t) => t.done).map((t) => t.text),
  events: await page.evaluate(() => window.__wgs.hotspot.events(8)) }); };

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

// second hotspot: the SLC and PAC plaza. Getting there is a teleport (a test shortcut, not play);
// everything after it is real key input.
/** Run a leg, and once more if its task is still not done (players retry too). */
const attempt = async (task, fn) => {
  for (let k = 0; k < 2; k++) {
    if ((await state()).tasks.find((t) => t.text === task)?.done) return;
    await fn();
  }
};
const itemAt = async (name) => (await page.evaluate(() => window.__wgs.hotspot.items())).find((i) => i.name === name);
await step("teleport to the plaza", async () => {
  const hat = await itemAt("the busker's tip hat");
  await page.evaluate(({ x, z }) => window.__wgs.goose.place(x - 5, z + 3), hat);
  await page.waitForTimeout(800);
});
await step("pinch the busker's tip hat", async () => {
  const hat = await itemAt("the busker's tip hat");
  await goTo(hat.x, hat.z, 0.5, 10);
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(300);
  const { g } = await state();
  await goTo(g.x - 12, g.z + 10, 2, 8, true);
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(1500);
});
await step("carry the thesis laptop away", async () => {
  await attempt("Carry the thesis laptop 15 m away", async () => {
    const lap = await itemAt("Alex's thesis laptop");
    await goTo(lap.x, lap.z, 2.5, 30);   // about 25 m from the hat at walking pace
    // Alex sits beside the laptop and would snatch it straight back: two honks make a scaredy flee
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
    await page.waitForTimeout(900);
    await goTo(lap.x, lap.z, 0.5, 6);
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(300);
    const { g } = await state();
    await goTo(g.x + 14, g.z + 12, 2, 14, true);
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(1500);
  });
});

// third hotspot: the Village 1 ring (teleport, then real keys)
await step("teleport to Village 1", async () => {
  const sock = await itemAt("a stray sock");
  await page.evaluate(({ x, z }) => window.__wgs.goose.place(x + 4, z - 3), sock);
  await page.waitForTimeout(800);
});
await step("honk Riley into dropping the laundry basket", async () => {
  await goTo(0, 0, 1.6, 10, false, "village:laundry");
  await page.keyboard.press("Space");
  await page.waitForTimeout(900);
});
await step("run off with a stray sock", async () => attempt("Run off with a stray sock", async () => {
  // a first try may have ended holding something else: drop it before reaching for the sock
  if ((await page.evaluate(() => window.__wgs.hotspot.items())).some((i) => i.heldBy === "goose")) {
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(300);
  }
  const sock = await itemAt("a stray sock");
  // Riley's dropped basket can lie between the goose and the sock: come in from the far side of it
  const basket = await itemAt("a laundry basket");
  const ax = sock.x - basket.x, az = sock.z - basket.z, al = Math.hypot(ax, az) || 1;
  if (!sock.heldBy) {
    await goTo(sock.x + (ax / al) * 1.2, sock.z + (az / al) * 1.2, 0.4, 10);
    await goTo(sock.x, sock.z, 0.5, 4);
  }
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(300);
  const { g } = await state();
  await goTo(g.x + 12, g.z - 10, 2, 8, true);
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(1000);
}));

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
