// Straight-down render of chunk (i, j) next to the 2025 summer orthophoto of the same 256 m square:
// PORT=31xx node review/trees/topdown.mjs i j OUT.png   (the ortho half comes from review/trees/ortho_chunk.py)
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const [i, j, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?hud=0`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 120000 });
const size = await page.evaluate(async ({ i, j }) => {
  const s = 256, idx = await (await fetch("/world/index.json")).json();
  const x = idx.grid_origin_e + (Number(i) + 0.5) * s - idx.origin.e, z = -(idx.grid_origin_n + (Number(j) + 0.5) * s - idx.origin.n);
  await window.__wgs.goose.place(...window.__wgs.goose.nearestPathPoint(x, z));
  await window.__wgs.load(x, z, 1);
  window.__wgs.goose.show(false);
  return s;
}, { i, j });
await page.waitForTimeout(4000);
const url = await page.evaluate(({ i, j }) => {
  window.__wgs.topDown(Number(i), Number(j));
  return document.querySelector("canvas").toDataURL("image/png");
}, { i, j });
writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
console.log("chunk", i, j, size, "m");
await browser.close();
