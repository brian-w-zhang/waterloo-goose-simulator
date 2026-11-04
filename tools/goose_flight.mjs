// Goose flight check: node tools/goose_flight.mjs OUT.jpg — hold flap (F) and W from the lawn, then glide and land.
// Real held keys at the default follow camera (DIST=5 for a closer one, AT=x,z for the spot); logs the height above the take-off point and checks the cap and landing.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "review/goose/flight_strip.jpg";
const dir = "/tmp/wgs-flight";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
const logs = [];
page.on("console", (m) => { if (m.text().includes("goose")) logs.push(m.text()); });
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?mute&hud=0`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.keyboard.press("Enter");
const [x0, z0] = (process.env.AT ?? "925,-395").split(",").map(Number);
await page.evaluate(([x, z]) => window.__wgs.goose.place(x, z), [x0, z0]);
if (process.env.DIST) await page.evaluate((d) => window.__wgs.setFollow({ dist: d, pitch: 22 }), Number(process.env.DIST));
await page.waitForTimeout(800);
const state = () => page.evaluate(() => window.__wgs.goose.state());
const s0 = await state();
const shots = [];
const trace = [];
const snap = async (name) => {
  const s = await state();
  trace.push({ name, h: +(s.y - s0.y).toFixed(2), grounded: s.grounded });
  const p = `${dir}/${shots.length}_${name}_${(s.y - s0.y).toFixed(1)}m.png`; await page.screenshot({ path: p }); shots.push(p);
};
await snap("start");
await page.keyboard.down("KeyF");
await page.keyboard.down("KeyW");
for (let k = 0; k < 6; k++) { await page.waitForTimeout(450); await snap("climb"); }
for (let k = 0; k < 3; k++) { await page.waitForTimeout(500); await snap("glide"); }
await page.keyboard.down("KeyD"); await page.waitForTimeout(600); await snap("steer"); await page.keyboard.up("KeyD");
await page.keyboard.up("KeyF");
for (let k = 0; k < 3; k++) { await page.waitForTimeout(400); await snap("descend"); }
await page.keyboard.up("KeyW");
await page.waitForTimeout(2500); await snap("landed");
// a tap on the ground is only a hop
await page.keyboard.down("KeyF"); await page.waitForTimeout(60); await page.keyboard.up("KeyF");
await page.waitForTimeout(150); await snap("hop");
await page.waitForTimeout(1200);
const end = await state();
await browser.close();
const max = Math.max(...trace.map((t) => t.h));
console.log(JSON.stringify(trace));
console.log(`max height ${max.toFixed(2)} m; landed ${end.grounded}; moved ${Math.hypot(end.x - s0.x, end.z - s0.z).toFixed(1)} m`);
if (logs.length) console.log(logs.join("\n"));
execFileSync(".venv/bin/python", ["-c", `
import sys
from PIL import Image, ImageDraw
ps=sys.argv[1:]; ims=[Image.open(p).convert('RGB') for p in ps]
cols=5; W,H=ims[0].size; rows=(len(ims)+cols-1)//cols
s=Image.new('RGB',(cols*W,rows*H),'white')
for k,(p,im) in enumerate(zip(ps,ims)):
    s.paste(im,((k%cols)*W,(k//cols)*H)); ImageDraw.Draw(s).text(((k%cols)*W+6,(k//cols)*H+4),p.split('/')[-1][:-4],fill='black')
s.save('${out}')`, ...shots]);
console.log(out, shots.length);
// heights are from the take-off body position (from water that is the lake bed), so the cap check is for land take-offs
if ((!process.env.AT && (max > 4.2 || max < 2)) || !end.grounded) { console.error("FLIGHT CHECK FAILED"); process.exit(1); }
