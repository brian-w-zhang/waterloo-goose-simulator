// Game vs Street View from the same pose: node tools/art/sv_compare.mjs dc [W2,W8] [OUT_DIR]
// Reads <building>/private/around/index.jsonl (tools/refs/around.mjs): for every fov-70 Street View
// capture (optionally only the listed walls) the game camera stands at the panorama (2.5 m eye height,
// about the Google car's camera), turns to the same heading and pitch, and uses the same horizontal
// field of view; the pair goes into review/art/<id>_sv_sheet.jpg.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const [id, wallArg, out = "review/art"] = process.argv.slice(2);
const want = wallArg ? new Set(wallArg.split(",")) : null;
const dir = `docs/refs/buildings/${id}`;
mkdirSync(out, { recursive: true });
const campus = JSON.parse(readFileSync("config/campus.json", "utf8"));
const rows = readFileSync(`${dir}/private/around/index.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => r.source === "streetview" && r.fov === 70 && (!want || want.has(r.wall ?? `c${r.corner}`)));
const utm = JSON.parse(execFileSync(".venv/bin/python", ["-c",
  "import json,sys; from pipeline.coords import lonlat_to_utm; print(json.dumps([lonlat_to_utm(p[1],p[0]) for p in json.loads(sys.argv[1])]))",
  JSON.stringify(rows.map((r) => [r.lat, r.lng]))], { encoding: "utf8" }));
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 3100}/?test`);
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
const pairs = [];
for (let k = 0; k < rows.length; k++) {
  const r = rows[k];
  const x = utm[k][0] - campus.origin.e, z = -(utm[k][1] - campus.origin.n);
  await page.evaluate(async ({ x, z, r }) => {
    const g = window.__wgs;
    await g.load(x, z, 1);
    const vfov = 2 * Math.atan(Math.tan((r.fov * Math.PI) / 360) * 1000 / 1600) * 180 / Math.PI;
    g.setPose({ x, y: g.heightAt(x, z) + 2.5, z, yaw: r.heading, pitch: r.pitch, fov: vfov });
    await new Promise((res) => setTimeout(res, 2000));
    g.render(); g.render();
  }, { x, z, r });
  const game = `${out}/${id}_sv_${r.file.replace(/\.jpg$/, "")}_game.jpg`;
  await page.screenshot({ path: game, type: "jpeg", quality: 85, clip: { x: 0, y: 190, width: 1540, height: 700 } });
  pairs.push({ photo: `${dir}/private/around/${r.file}`, game, note: `${r.wall ?? "corner " + r.corner} ${r.date} ${r.dist_m} m` });
}
await browser.close();
execFileSync(".venv/bin/python", ["-m", "tools.ref_sheet", out, `${id}_sv`, JSON.stringify(pairs)], { stdio: "inherit" });
