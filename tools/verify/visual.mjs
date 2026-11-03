// Browser verification suites against the production server (npm run build && npm start).
// Usage: node tools/verify/visual.mjs RUN_DIR [suite ...]   suites: walk flythrough topdown viewpoints style
// Writes RUN_DIR/<suite>.json (metrics evaluated later by gate.py through thresholds.json) and images.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [runDir, ...want] = process.argv.slice(2);
const suites = want.length ? want : ["walk", "flythrough", "topdown", "viewpoints", "style"];
const port = process.env.PORT ?? 3100;
const webgl = process.env.WGS_WEBGL === "1";
const campus = JSON.parse(readFileSync("config/campus.json", "utf8"));
const thresholds = JSON.parse(readFileSync("verify/thresholds.json", "utf8"));
const native = JSON.parse(readFileSync("verify/truth-native/landmarks_native.json", "utf8")).buildings;
mkdirSync(runDir, { recursive: true });

const world = (id) => ({ x: native[id].utm_e - campus.origin.e, z: -(native[id].utm_n - campus.origin.n) });

function evaluate(group, metrics) {
  const out = {};
  for (const [k, v] of Object.entries(metrics)) {
    const spec = thresholds[group]?.[k];
    let pass = null;
    if (spec && spec.op !== "record" && v !== null && v !== undefined) {
      const g = spec.gate;
      pass = { "<": v < g, "<=": v <= g, ">": v > g, ">=": v >= g, "==": v === g,
        between: Array.isArray(g) && v >= g[0] && v <= g[1] }[spec.op];
    }
    out[k] = { value: v, gate: spec?.gate ?? null, op: spec?.op ?? null, pass, report_only: !!spec?.report_only };
  }
  return out;
}

const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal", "--ignore-gpu-blocklist"] });

async function openPage(size = [1280, 720], extra = "") {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  const logs = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${port}/?test${webgl ? "&webgl" : ""}${extra}`);
  await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 90000 });
  return { page, logs };
}

const info = { suites: {}, backend: null };

if (suites.includes("walk")) {
  const { page, logs } = await openPage();
  const legs = [["DC", "SLC"], ["SLC", "V1"]];
  const results = [];
  const start = world(legs[0][0]);
  const res = await page.evaluate(async ({ start, legs }) => {
    const g = window.__wgs;
    const [sx, sz] = g.goose.nearestPathPoint(start.x, start.z);
    await g.goose.place(sx, sz);
    const out = [];
    for (const [, b, bx, bz] of legs) out.push({ to: b, ...(await g.goose.walkTo(bx, bz, 900)) });
    return { backend: g.backend, out };
  }, { start, legs: legs.map(([a, b]) => [a, b, world(b).x, world(b).z]) });
  info.backend = res.backend;
  results.push(...res.out);
  const falls = results.reduce((s, r) => s + r.falls, 0) + results.filter((r) => !r.arrived).length;
  writeFileSync(join(runDir, "walk.json"), JSON.stringify({
    metrics: evaluate("flythrough", { goose_walk_falls: falls }),
    detail: { legs: results, errors: logs.filter((l) => /error/i.test(l)).slice(0, 10) },
  }, null, 1));
  console.log("walk", JSON.stringify(results));
  await page.close();
}

const conv = campus.meridian_convergence_deg;
const viewpoints = JSON.parse(readFileSync("verify/ground-truth/viewpoints.json", "utf8")).viewpoints;
let calibrated = {};
try { calibrated = JSON.parse(readFileSync("verify/viewpoints.calibrated.json", "utf8")).poses ?? {}; } catch { /* not calibrated yet */ }

// Viewpoint camera positions in world x, z, converted by pipeline/coords.py (tools/verify/viewpoints_world.py).
const vpWorld = JSON.parse(readFileSync("verify/viewpoints.world.json", "utf8"));

function photoPose(vp) {
  const c = calibrated[vp.id];
  const w = vpWorld[vp.id];
  const hfov = c?.hfov_deg ?? vp.camera.hfov_deg;
  const vfov = 2 * Math.atan(Math.tan((hfov * Math.PI) / 360) * 720 / 1280) * 180 / Math.PI;
  return { x: c?.x ?? w.x, z: c?.z ?? w.z, yaw: (c?.heading_true_deg ?? vp.camera.heading_true_deg) - conv,
    pitch: c?.pitch_deg ?? vp.camera.pitch_deg, fov: vfov, eye: vp.camera.eye_height_m };
}

/** Share of magenta (hole) pixels below the horizon row, counted in the page from the game canvas. */
async function countMagenta(page, horizonRow) {
  return page.evaluate((horizonRow) => {
    const src = document.querySelector("canvas");
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    window.__wgs.render();
    ctx.drawImage(src, 0, 0);
    const W = c.width, H = c.height;
    const y0 = Math.max(0, Math.min(H, Math.round(horizonRow * H / 360)));
    if (y0 >= H) return 0;
    const d = ctx.getImageData(0, 0, W, H).data;
    const mag = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) mag[k] = d[k * 4] > 240 && d[k * 4 + 1] < 20 && d[k * 4 + 2] > 240 ? 1 : 0;
    // sky = magenta connected to the top edge; a hole is magenta below the horizon that is either
    // cut off from that sky or more than 5% of the frame height below the horizon
    const sky = new Uint8Array(W * H);
    const stack = [];
    for (let x = 0; x < W; x++) if (mag[x]) { sky[x] = 1; stack.push(x); }
    while (stack.length) {
      const k = stack.pop(), x = k % W, y = (k - x) / W;
      for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) {
        if (nk >= 0 && mag[nk] && !sky[nk]) { sky[nk] = 1; stack.push(nk); }
      }
    }
    const deep = y0 + Math.round(0.05 * H);
    let n = 0;
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (mag[k] && (!sky[k] || y > deep)) n++;
    }
    return n / (W * (H - y0));
  }, horizonRow);
}

if (suites.includes("flythrough")) {
  const { page, logs } = await openPage([640, 360]);
  const net = JSON.parse(readFileSync("public/world/network.json", "utf8"));
  const idx = JSON.parse(readFileSync("public/world/index.json", "utf8"));
  // Ring Road loop: its way points ordered by angle around their centroid, sampled every 40 m
  const rr = net.ways.filter((w) => w.name === "Ring Road").flatMap((w) => w.pts);
  const cx = rr.reduce((a, p) => a + p[0], 0) / rr.length, cz = rr.reduce((a, p) => a + p[1], 0) / rr.length;
  rr.sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));
  const path = [];
  for (let k = 0; k < rr.length; k++) {
    const a = rr[k], b = rr[(k + 1) % rr.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t < d; t += 40) path.push({ x: a[0] + (b[0] - a[0]) * t / d, z: a[1] + (b[1] - a[1]) * t / d, alt: 40, pitch: -30 });
  }
  for (const vp of viewpoints) { const p = photoPose(vp); path.push({ x: p.x, z: p.z, alt: p.eye, pitch: p.pitch, yaw: p.yaw, fov: p.fov }); }
  // diagonal across the bbox, then a serpentine over rows so every chunk is visited
  const S = idx.chunk_size, o = campus.origin;
  const wx = (e) => e - o.e, wz = (n) => -(n - o.n);
  const e0 = idx.grid_origin_e, n0 = idx.grid_origin_n, e1 = e0 + idx.cols * S, n1 = n0 + idx.rows * S;
  for (let t = 0; t <= 1; t += 0.02) path.push({ x: wx(e0 + (e1 - e0) * t), z: wz(n0 + (n1 - n0) * t), alt: 40, pitch: -30 });
  [1, 4, 6].forEach((row, k) => {
    for (let c = 0; c < idx.cols; c++) {
      const col = k % 2 ? idx.cols - 1 - c : c;
      path.push({ x: wx(e0 + (col + 0.5) * S), z: wz(n0 + (row + 0.5) * S), alt: 40, pitch: -30 });
    }
  });
  const res = { frames: 0, holeFrames: [], ms: [], calls: [], tris: [], everLoaded: new Set(), mismatches: new Set(), bad: 0 };
  await page.evaluate(() => window.__wgs.holeBackground(true));
  for (let k = 0; k < path.length; k++) {
    const p = path[k];
    const prev = path[Math.max(0, k - 1)];
    const yaw = p.yaw ?? (Math.atan2(p.x - prev.x, -(p.z - prev.z)) * 180) / Math.PI;
    const r = await page.evaluate(async ({ p, yaw }) => {
      const g = window.__wgs;
      await g.load(p.x, p.z, 1);
      const y = g.heightAt(p.x, p.z);
      g.setPose({ x: p.x, y: (Number.isFinite(y) ? y : 15) + p.alt, z: p.z, yaw, pitch: p.pitch, fov: p.fov ?? 40 });
      const t0 = performance.now();
      g.render();
      const ms = performance.now() - t0;
      const a = g.audit();
      const i = g.info();
      return { ms, calls: i.calls, tris: i.triangles, audit: a };
    }, { p, yaw });
    res.frames++;
    res.ms.push(r.ms); res.calls.push(r.calls); res.tris.push(r.tris);
    r.audit.loaded.forEach((key) => res.everLoaded.add(key));
    r.audit.buildingMismatch.forEach((key) => res.mismatches.add(key));
    res.bad = Math.max(res.bad, r.audit.badVertices);
    const fovv = p.fov ?? 40;
    const horizon = Math.round(180 - (Math.tan((-p.pitch * Math.PI) / 180) / Math.tan((fovv * Math.PI) / 360)) * 180);
    const share = await countMagenta(page, horizon);
    if (share > 0.001) {
      res.holeFrames.push({ k, share, x: p.x, z: p.z });
      if (res.holeFrames.length <= 5) writeFileSync(join(runDir, `hole_${k}.png`), await page.screenshot());
    }
  }
  await page.evaluate(() => window.__wgs.holeBackground(false));
  const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  const never = idx.chunks.filter((c) => !res.everLoaded.has(`${c.i}_${c.j}`)).length;
  writeFileSync(join(runDir, "flythrough.json"), JSON.stringify({
    metrics: evaluate("flythrough", { hole_frames: res.holeFrames.length, chunks_never_loaded: never,
      bad_vertices: res.bad + res.mismatches.size, frame_ms_p95: q(res.ms, 0.95) }),
    detail: { frames: res.frames, holes: res.holeFrames, building_count_mismatch: [...res.mismatches],
      frame_ms_p50: q(res.ms, 0.5), draw_calls_p95: q(res.calls, 0.95), triangles_p95: q(res.tris, 0.95),
      note: "headless frame times are CPU submit times on the build machine, recorded only",
      errors: logs.filter((l) => /error/i.test(l)).slice(0, 10) },
  }, null, 1));
  console.log("flythrough", res.frames, "frames, holes", res.holeFrames.length, "never loaded", never);
  await page.close();
}

if (suites.includes("topdown")) {
  // ID buffers are rendered without MSAA so every pixel is exactly one class
  const { page } = await openPage([512, 512], "&noaa");
  const idx = JSON.parse(readFileSync("public/world/index.json", "utf8"));
  const dir = join(runDir, "topdown");
  mkdirSync(dir, { recursive: true });
  await page.evaluate(() => window.__wgs.debugView("id"));
  for (const c of idx.chunks) {
    await page.evaluate(async ({ i, j, x, z }) => {
      const g = window.__wgs;
      await g.load(x, z, 1);  // neighbours too: buildings belong to the chunk of their centroid
      g.debugView("id");  // re-apply so freshly loaded chunks get the id materials
      g.topDown(i, j);
    }, { i: c.i, j: c.j, x: idx.grid_origin_e + (c.i + 0.5) * idx.chunk_size - campus.origin.e,
      z: -(idx.grid_origin_n + (c.j + 0.5) * idx.chunk_size - campus.origin.n) });
    writeFileSync(join(dir, `td_${c.i}_${c.j}.png`), await page.screenshot());
  }
  await page.evaluate(() => window.__wgs.debugView(null));
  console.log("topdown", idx.chunks.length, "chunks");
  await page.close();
}

if (suites.includes("viewpoints")) {
  const { page } = await openPage([1280, 720]);
  const { page: noaa } = await openPage([1280, 720], "&noaa");
  const dir = join(runDir, "viewpoints");
  mkdirSync(dir, { recursive: true });
  const gc = JSON.parse(readFileSync("verify/ground-truth/viewpoints.json", "utf8")).game_camera_preset;
  const poses = {};
  for (const vp of viewpoints) {
    const p = photoPose(vp);
    const w = vpWorld[vp.id];
    poses[vp.id] = p;
    await page.evaluate(async ({ p }) => {
      const g = window.__wgs;
      await g.load(p.x, p.z, 1);
      const y = g.heightAt(p.x, p.z);
      g.setPose({ x: p.x, y: y + p.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: p.fov });
      g.render(); g.render();
    }, { p });
    writeFileSync(join(dir, `photo_${vp.id}.png`), await page.screenshot());
    // the style-suite camera follows a goose standing at the photo position, looking along its heading
    const tx = p.x, tz = p.z;
    for (const mode of [null, "palette"]) {
      const pg = mode ? noaa : page;
      await pg.evaluate(async ({ tx, tz, yaw, gc, mode }) => {
        const g = window.__wgs;
        await g.load(tx, tz, 1);
        g.debugView(mode);
        g.setFollow({ x: tx, z: tz, yaw, pitch: gc.pitch_deg, dist: gc.distance_m, fov: gc.vfov_deg });
        g.render(); g.render();
      }, { tx, tz, yaw: p.yaw, gc, mode });
      writeFileSync(join(dir, `${mode ? "palette" : "game"}_${vp.id}.png`), await pg.screenshot());
    }
  }
  writeFileSync(join(dir, "poses.json"), JSON.stringify(poses, null, 1));
  console.log("viewpoints", viewpoints.length);
  await page.close();
  await noaa.close();
}

if (suites.includes("calib")) {
  // pose calibration candidates (doc 08 section 2.4): heading offsets x camera stepped back along the heading
  const { page } = await openPage([640, 360]);
  const dir = join(runDir, "calib");
  mkdirSync(dir, { recursive: true });
  const only = (process.env.WGS_VP ?? "").split(",").filter(Boolean);
  const dh = (process.env.WGS_DH ?? "-24,-12,0,12,24").split(",").map(Number);
  const back = (process.env.WGS_BACK ?? "0,15,28").split(",").map(Number);
  const side = Number(process.env.WGS_SIDE ?? 0);
  for (const vp of viewpoints.filter((v) => !only.length || only.includes(v.id))) {
    const p0 = photoPose(vp);
    for (const b of back) {
      for (const d of dh) {
        const yawT = p0.yaw * Math.PI / 180;
        const x = p0.x - Math.sin(yawT) * b + Math.cos(yawT) * side, z = p0.z + Math.cos(yawT) * b + Math.sin(yawT) * side;
        await page.evaluate(async ({ x, z, yaw, pitch, fov, eye }) => {
          const g = window.__wgs;
          await g.load(x, z, 1);
          g.setPose({ x, y: g.heightAt(x, z) + eye, z, yaw, pitch, fov });
          g.render(); g.render();
        }, { x, z, yaw: p0.yaw + d, pitch: p0.pitch, fov: p0.fov, eye: p0.eye });
        writeFileSync(join(dir, `${vp.id}_b${b}_h${d}.png`), await page.screenshot());
      }
    }
  }
  await page.close();
}

if (suites.includes("style")) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/?scene=style${webgl ? "&webgl" : ""}`);
  await page.waitForFunction(() => window.__wgsStyle, null, { timeout: 60000 });
  for (const sh of [true, false]) {
    await page.evaluate((sh) => { window.__wgsStyle.render(sh); window.__wgsStyle.render(sh); }, sh);
    await page.waitForTimeout(200);
    await page.evaluate((sh) => window.__wgsStyle.render(sh), sh);
    writeFileSync(join(runDir, `style_scene_${sh ? "shadow" : "noshadow"}.png`), await page.screenshot());
  }
  info.backend = info.backend ?? await page.evaluate(() => window.__wgsStyle.backend);
  await page.close();
}

writeFileSync(join(runDir, "visual_info.json"), JSON.stringify(info, null, 1));
await browser.close();
