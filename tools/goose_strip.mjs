// Goose animation strip: node tools/goose_strip.mjs OUT.jpg — walk, run, honk, crouch, swim frames, close camera
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "review/look/goose_strip.jpg";
const dir = "/tmp/wgs-strip";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?mute&hud=0`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.keyboard.press("Enter");
const shots = [];
const snap = async (name) => { const p = `${dir}/${shots.length}_${name}.png`; await page.screenshot({ path: p }); shots.push(p); };
const cam = (yaw) => page.evaluate((yaw) => window.__wgs.setFollow({ yaw, pitch: 12, dist: 3.2, fov: 40 }), yaw);
await page.evaluate(() => window.__wgs.goose.place(925, -395));
await cam(90);
await page.waitForTimeout(400); await snap("idle");
// real held keys, so frames show the pose at speed (a simulate() call returns after the goose has slowed)
await cam(0);
await page.keyboard.down("KeyD");
await page.waitForTimeout(500);
for (let k = 0; k < 3; k++) { await page.waitForTimeout(110); await snap("walk"); }
await page.keyboard.down("ShiftLeft");
await page.waitForTimeout(700);
for (let k = 0; k < 3; k++) { await page.waitForTimeout(90); await snap("run"); }
await page.keyboard.up("ShiftLeft"); await page.keyboard.up("KeyD");
await page.waitForTimeout(800);
await page.keyboard.down("Space"); await page.waitForTimeout(120); await snap("honk"); await page.keyboard.up("Space");
await page.waitForTimeout(90); await snap("honk2");
await page.keyboard.down("KeyC"); await page.waitForTimeout(500); await snap("crouch"); await page.keyboard.up("KeyC");
await page.evaluate(() => { const g = window.__wgs.goose.state(); window.__wgs.setFollow({ yaw: (g.yaw * 180) / Math.PI + 180, pitch: 15, dist: 3.2 }); }); await page.waitForTimeout(300);
await page.keyboard.down("KeyF"); await page.waitForTimeout(150); await snap("flap"); await page.keyboard.up("KeyF");
// Laurel Lake (a point inside the packed lake polygon) for swimming
await page.evaluate(() => window.__wgs.goose.place(871.2, 224.2));
await page.evaluate(() => window.__wgs.goose.simulate(4, { my: 1 }));
await page.waitForTimeout(300); await snap("swim"); await page.evaluate(() => window.__wgs.goose.simulate(0.3, { my: 1 })); await snap("swim2");
await browser.close();
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
