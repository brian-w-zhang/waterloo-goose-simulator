// Reference photo vs game, side by side: node tools/ref_compare.mjs ID [OUT_DIR]
// Reads docs/refs/ID/poses.json: [{ "photo": "file.jpg", "x": .., "z": .., "y": eye height above ground (default 1.6),
//   "yaw": compass deg, "pitch": deg, "fov": vertical deg, "note": ".." }] (poses are estimated by eye from each photo)
// and writes OUT_DIR/ID_<photo>.jpg plus OUT_DIR/ID_sheet.jpg. Uses the game's test page (no HUD, goose hidden).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
const [id, out = "review/refs"] = process.argv.slice(2);
if (!id) { console.error("usage: node tools/ref_compare.mjs ID [OUT_DIR]"); process.exit(2); }
const dir = `docs/refs/${id}`;
const poses = JSON.parse(readFileSync(`${dir}/poses.json`, "utf8"));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test${process.env.WGS_WEBGL === "1" ? "&webgl" : ""}`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
const pairs = [];
for (const p of poses) {
  if (!existsSync(`${dir}/${p.photo}`)) { console.warn(`missing ${dir}/${p.photo}`); continue; }
  await page.evaluate(async (p) => {
    const g = window.__wgs;
    await g.load(p.x, p.z, 1);
    const y = g.heightAt(p.x, p.z) + (p.y ?? 1.6);
    g.setPose({ x: p.x, y, z: p.z, yaw: p.yaw, pitch: p.pitch ?? 0, fov: p.fov ?? 50 });
    await new Promise((r) => setTimeout(r, 1500));   // art models load asynchronously
    g.render(); g.render();
  }, p);
  const game = `${out}/${id}_${p.photo.replace(/\.\w+$/, "")}_game.png`;
  await page.screenshot({ path: game });
  pairs.push({ photo: `${dir}/${p.photo}`, game, note: p.note ?? "" });
}
await browser.close();
execFileSync(".venv/bin/python", ["-m", "tools.ref_sheet", out, id, JSON.stringify(pairs)], { stdio: "inherit" });
