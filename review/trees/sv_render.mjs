// Render the game from given camera poses (see review/trees/sv.py): node review/trees/sv_render.mjs JSON
import { chromium } from "@playwright/test";
const poses = JSON.parse(process.argv[2]);
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: poses[0].w, height: poses[0].h } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 120000 });
for (const p of poses) {
  await page.evaluate(async (p) => {
    const g = window.__wgs;
    await g.load(p.x, p.z, 1);
    g.setPose({ x: p.x, y: g.heightAt(p.x, p.z) + p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: p.fov });
    await new Promise((r) => setTimeout(r, 2500));   // tree and art models load asynchronously
    g.render(); g.render();
  }, p);
  await page.screenshot({ path: p.out });
}
await browser.close();
