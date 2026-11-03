// First-load transfer (doc 06 M1: under 10 MB before the first frame): node tools/firstload.mjs
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
let bytes = 0;
const byType = {};
cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; });
cdp.on("Network.responseReceived", (e) => { byType[e.requestId] = e.response.url; });
const t0 = Date.now();
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 90000 });
const ms = Date.now() - t0;
await page.waitForTimeout(500);
const sha = execSync("git rev-parse --short HEAD").toString().trim();
const out = { sha, transferred_bytes_at_ready: bytes, transferred_mb: +(bytes / 1e6).toFixed(2), ms_to_ready: ms,
  requests: Object.keys(byType).length, gate_mb: 10, note: "Production server (next start, compression on), cold cache, localhost" };
writeFileSync(`bench/results/firstload-${new Date().toISOString().slice(0, 10)}-${sha}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
await browser.close();
