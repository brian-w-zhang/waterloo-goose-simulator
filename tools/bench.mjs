// Frame-time benchmark of the live game loop (doc 06 section 5): node tools/bench.mjs [seconds]
// Walks the goose with real key input on both backends and records requestAnimationFrame intervals.
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";

const seconds = Number(process.argv[2] ?? 12);
const sha = execSync("git rev-parse --short HEAD").toString().trim();
const results = { sha, date: new Date().toISOString(), device: `${os.cpus()[0].model}, ${os.platform()} ${os.release()}`,
  note: "Headless Chromium on the build machine at 1280x720, DPR 1; rAF intervals while the goose walks and runs across the MC and DC green with 220 ambient students.", runs: [] };
for (const webgl of [false, true]) {
  const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${process.env.PORT ?? 3100}/${webgl ? "?webgl" : ""}`);
  await page.waitForFunction(() => window.__wgs?.hotspot, null, { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const keys = ["KeyW", "KeyD", "KeyS", "KeyA"];
  for (let k = 0; k < seconds; k++) {
    await page.keyboard.down(keys[k % 4]);
    if (k % 2) await page.keyboard.down("ShiftLeft");
    await page.waitForTimeout(1000);
    await page.keyboard.up(keys[k % 4]);
    await page.keyboard.up("ShiftLeft");
  }
  const f = await page.evaluate(() => window.__frames.slice(5));
  const info = await page.evaluate(() => window.__wgs.info());
  const s = [...f].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  results.runs.push({ backend: info.backend, frames: f.length, p50_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99),
    mean_fps: 1000 / (f.reduce((a, b) => a + b, 0) / f.length), draw_calls: info.calls, triangles: info.triangles });
  await browser.close();
}
mkdirSync("bench/results", { recursive: true });
const out = `bench/results/frametime-${new Date().toISOString().slice(0, 10)}-${sha}.json`;
writeFileSync(out, JSON.stringify(results, null, 1));
console.log(out, JSON.stringify(results.runs));
