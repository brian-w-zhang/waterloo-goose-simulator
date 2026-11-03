// Usage: node tools/shot.mjs out.png '{"follow":{...}}|{"pose":{...}}' [--webgl] [--size=1280x720] [--radius=1]
import { chromium } from "@playwright/test";

const [out, spec = "{}", ...flags] = process.argv.slice(2);
const s = JSON.parse(spec);
const webgl = flags.includes("--webgl");
const size = (flags.find((f) => f.startsWith("--size=")) ?? "--size=1280x720").slice(7).split("x").map(Number);
const radius = Number((flags.find((f) => f.startsWith("--radius=")) ?? "--radius=1").slice(9));
const url = `http://localhost:${process.env.PORT ?? 3100}/?test${webgl ? "&webgl" : ""}`;
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__wgs, null, { timeout: 60000 });
const info = await page.evaluate(async ({ s, radius }) => {
  const g = window.__wgs;
  const p = s.pose ?? s.follow;
  await g.load(p.x, p.z, radius);
  if (s.pose) g.setPose(s.pose); else g.setFollow(s.follow);
  g.render(); g.render();
  await new Promise((r) => setTimeout(r, 300));
  g.render();
  return g.info();
}, { s, radius });
await page.screenshot({ path: out });
console.log(JSON.stringify({ ...info, loaded: info.loaded.length }));
const errs = logs.filter((l) => /error|warn/i.test(l));
if (errs.length) console.log(errs.slice(0, 10).join("\n"));
await browser.close();
