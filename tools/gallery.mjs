// Key-building gallery: node tools/gallery.mjs OUT.jpg  (game-style camera, two angles per building)
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const out = process.argv[2] ?? "review/look/gallery";
mkdirSync(out, { recursive: true });
const native = JSON.parse(readFileSync("verify/truth-native/landmarks_native.json", "utf8")).buildings;
const campus = JSON.parse(readFileSync("config/campus.json", "utf8"));
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
for (const [id, b] of Object.entries(native)) {
  const x = b.utm_e - campus.origin.e, z = -(b.utm_n - campus.origin.n);
  for (const yaw of [200, 20]) {
    await page.evaluate(async ({ x, z, yaw }) => {
      const g = window.__wgs; await g.load(x, z, 1);
      g.setFollow({ x, z, yaw, pitch: 30, dist: 160, fov: 30 }); g.render(); g.render();
    }, { x, z, yaw });
    await page.screenshot({ path: `${out}/${id}_${yaw}.png` });
  }
}
await browser.close();
console.log("gallery", Object.keys(native).length);
