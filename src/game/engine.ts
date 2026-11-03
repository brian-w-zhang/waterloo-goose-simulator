import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { Goose, type GooseInput } from "@/goose/goose";
import { type Network, WalkGraph } from "@/nav/graph";
import { loadRapier, Physics } from "@/physics/physics";
import { makeGooseMaterial, occlusion } from "@/render/materials";
import { applyDebugView, type DebugMode } from "@/render/debug";
import { createScene } from "@/render/scene";
import { swatch } from "@/config";
import { FarWorld } from "@/world/far";
import { makeMaterials } from "@/world/materials";
import { WorldStream } from "@/world/stream";

const D2R = THREE.MathUtils.degToRad;
const CAM = campus.camera;
const FIXED_DT = 1 / 60;

export interface Pose { x: number; y: number; z: number; yaw: number; pitch: number; fov: number }
export interface Follow { x: number; z: number; yaw: number; pitch: number; dist: number; fov: number }

/** Test and debug handle exposed as window.__wgs. */
export interface GameHandle {
  backend: string;
  setPose(p: Pose): void;
  setFollow(f: Partial<Follow>): void;
  load(x: number, z: number, radius?: number): Promise<void>;
  render(): void;
  info(): { backend: string; calls: number; triangles: number; loaded: string[]; loads: number; evictions: number };
  heightAt(x: number, z: number): number;
  /** Debug material views and the magenta hole background (doc 08 sections 2.2, 2.3, 3.2). */
  debugView(mode: DebugMode): void;
  holeBackground(on: boolean): void;
  /** Orthographic straight-down render of chunk (i, j) at `px` pixels per side. */
  topDown(i: number, j: number): void;
  /** Decoded-geometry audit: NaN or out-of-world vertices and building counts per loaded chunk. */
  audit(): { badVertices: number; buildingMismatch: string[]; loaded: string[] };
  goose: {
    place(x: number, z: number): Promise<void>;
    /** Run the simulation for `seconds` with a fixed input; returns the goose position afterwards. */
    simulate(seconds: number, input: Partial<GooseInput> & { mx?: number; my?: number }): Promise<{ x: number; y: number; z: number; ground: number }>;
    state(): { x: number; y: number; z: number; yaw: number; speed: number; grounded: boolean };
    show(v: boolean): void;
    /** Walk along the outdoor path graph to (x, z) using ordinary goose inputs; for the M1 walk gate. */
    walkTo(x: number, z: number, maxSeconds?: number): Promise<WalkResult>;
    nearestPathPoint(x: number, z: number): [number, number];
  };
}

export interface WalkResult {
  arrived: boolean; falls: number; stuck: boolean; seconds: number; routeLength: number; minClearance: number;
  end: { x: number; y: number; z: number };
}

declare global { interface Window { __wgs?: GameHandle } }

export async function startGame(canvas: HTMLCanvasElement): Promise<() => void> {
  const params = new URLSearchParams(window.location.search);
  const testMode = params.has("test");
  const rig = await createScene(canvas, params.has("webgl"));
  const { renderer, scene } = rig;
  const mats = makeMaterials();
  const stream = new WorldStream(mats);
  const R = await loadRapier();
  const physics = new Physics(R);
  stream.onLoad = (key, c) => {
    const n = Math.round(Math.sqrt(c.heights.length));
    physics.addChunk(key, c.heights, n, stream.index.chunk_size, c.group.position.x, c.group.position.z, c.walls);
    far.setNear(key, true);
  };
  const far = new FarWorld(mats.vertexColor);
  stream.onEvict = (key) => { physics.removeChunk(key); far.setNear(key, false); };
  await stream.init();
  await far.load();
  scene.add(stream.root, far.root);
  const net: Network = await (await fetch("/world/network.json")).json();
  const graph = new WalkGraph(net);

  const goose = new Goose(makeGooseMaterial());
  scene.add(goose.rig.root);

  const camera = new THREE.PerspectiveCamera(CAM.play_vfov_deg, 1, 0.3, 4000);
  const follow: Follow = {
    x: Number(params.get("x") ?? 905), z: Number(params.get("z") ?? -385),
    yaw: Number(params.get("yaw") ?? 30), pitch: CAM.play_pitch_deg, dist: CAM.play_distance_m, fov: CAM.play_vfov_deg,
  };
  let pose: Pose | null = null;
  let followGoose = !testMode;

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const target = new THREE.Vector3();
  const placeCamera = () => {
    if (pose) {
      camera.fov = pose.fov;
      camera.position.set(pose.x, pose.y, pose.z);
      // yaw is a compass heading (clockwise from north = -z); pitch is degrees above the horizon
      const dir = new THREE.Vector3(Math.sin(D2R(pose.yaw)) * Math.cos(D2R(pose.pitch)), Math.sin(D2R(pose.pitch)),
        -Math.cos(D2R(pose.yaw)) * Math.cos(D2R(pose.pitch)));
      camera.lookAt(camera.position.clone().add(dir));
      target.copy(camera.position).addScaledVector(dir, 60);
      occlusion.enabled.value = 0;
    } else {
      const gy = followGoose ? goose.position.y : stream.heightAt(follow.x, follow.z);
      target.set(follow.x, (Number.isFinite(gy) ? gy : 15) + 0.4, follow.z);
      camera.fov = follow.fov;
      const back = new THREE.Vector3(-Math.sin(D2R(follow.yaw)), 0, Math.cos(D2R(follow.yaw)));
      camera.position.copy(target)
        .addScaledVector(back, follow.dist * Math.cos(D2R(follow.pitch)))
        .add(new THREE.Vector3(0, follow.dist * Math.sin(D2R(follow.pitch)), 0));
      camera.lookAt(target);
      occlusion.enabled.value = followGoose ? 1 : 0;
    }
    camera.updateProjectionMatrix();
    occlusion.camera.value.copy(camera.position);
    occlusion.focus.value.copy(goose.position).setY(goose.position.y + 0.5);
    rig.followShadow(target);
  };

  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    if (e.type === "keydown") keys.add(e.code); else keys.delete(e.code);
    if (e.code === "Space") e.preventDefault();
  };
  const onWheel = (e: WheelEvent) => {
    follow.dist = THREE.MathUtils.clamp(follow.dist * Math.exp(e.deltaY * 0.001), CAM.play_min_distance_m, CAM.play_max_distance_m);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("wheel", onWheel, { passive: true });

  const readInput = (): GooseInput => {
    const mv = new THREE.Vector2(
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0));
    if (mv.lengthSq() > 1) mv.normalize();
    return { move: mv, run: keys.has("ShiftLeft") || keys.has("ShiftRight"), crouch: keys.has("KeyC") || keys.has("ControlLeft"),
      honk: keys.has("Space"), flap: keys.has("KeyF") };
  };

  let lastChunk = "";
  const step = (dt: number, input: GooseInput) => {
    goose.update(dt, input, follow.yaw);
    physics.world.step();
    if (followGoose) {
      follow.x = THREE.MathUtils.damp(follow.x, goose.position.x, 6, dt);
      follow.z = THREE.MathUtils.damp(follow.z, goose.position.z, 6, dt);
    }
    const ck = stream.chunkOf(goose.position.x, goose.position.z).join("_");
    if (ck !== lastChunk) { lastChunk = ck; void stream.update(goose.position.x, goose.position.z); }
  };

  const spawn = async (x: number, z: number) => {
    await stream.update(x, z);
    const y = stream.heightAt(x, z);
    const p = new THREE.Vector3(x, Number.isFinite(y) ? y + 0.05 : 15, z);
    if (!goose.attached) goose.attach(physics, p); else goose.place(p);
    physics.world.step();
  };

  const handle: GameHandle = {
    backend: rig.backend,
    setPose: (p) => { pose = p; placeCamera(); },
    setFollow: (f) => { pose = null; Object.assign(follow, f); placeCamera(); },
    load: async (x, z, radius) => { await stream.update(x, z, radius); placeCamera(); },
    render: () => { placeCamera(); renderer.render(scene, camera); },
    info: () => ({
      backend: rig.backend, calls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles,
      loaded: stream.loadedKeys(), loads: stream.loadsTotal, evictions: stream.evictionsTotal,
    }),
    heightAt: (x, z) => stream.heightAt(x, z),
    debugView: (mode) => {
      applyDebugView([stream.root, far.root, goose.rig.root], mode, stream.index.ground_classes);
      far.root.visible = mode !== "id";
    },
    holeBackground: (on) => { scene.background = on ? swatch("clear_hole", "debug") : swatch("sky"); },
    topDown: (i, j) => {
      const size = stream.index.chunk_size;
      const e0 = stream.index.grid_origin_e + i * size, n1 = stream.index.grid_origin_n + (j + 1) * size;
      const cx = e0 - campus.origin.e + size / 2, cz = -(n1 - campus.origin.n) + size / 2;
      const ortho = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 1, 2000);
      ortho.position.set(cx, 900, cz);
      ortho.up.set(0, 0, -1);
      ortho.lookAt(cx, 0, cz);
      ortho.updateProjectionMatrix();
      renderer.render(scene, ortho);
    },
    audit: () => {
      let bad = 0;
      const mismatch: string[] = [];
      const lim = 6000;
      stream.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
        const a = m.geometry.getAttribute("position").array as Float32Array;
        const ox = m.parent?.position.x ?? 0, oz = m.parent?.position.z ?? 0;
        for (let k = 0; k < a.length; k += 3) {
          const x = a[k] + ox, y = a[k + 1], z = a[k + 2] + oz;
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || Math.abs(x) > lim || Math.abs(z) > lim || y < -200 || y > 400) bad++;
        }
      });
      for (const key of stream.loadedKeys()) {
        const [i, j] = key.split("_").map(Number);
        const want = stream.index.chunks.find((c) => c.i === i && c.j === j)?.buildings ?? -1;
        if (stream.buildingCount(key) !== want) mismatch.push(key);
      }
      return { badVertices: bad, buildingMismatch: mismatch, loaded: stream.loadedKeys() };
    },
    goose: {
      place: async (x, z) => { await spawn(x, z); followGoose = true; follow.x = x; follow.z = z; },
      simulate: async (seconds, inp) => {
        const input: GooseInput = { move: new THREE.Vector2(inp.mx ?? 0, inp.my ?? 0), run: !!inp.run,
          crouch: !!inp.crouch, honk: !!inp.honk, flap: !!inp.flap };
        const n = Math.round(seconds / FIXED_DT);
        for (let k = 0; k < n; k++) {
          step(FIXED_DT, input);
          if (k % 30 === 0) await stream.update(goose.position.x, goose.position.z);
        }
        const p = goose.position;
        return { x: p.x, y: p.y, z: p.z, ground: stream.heightAt(p.x, p.z) };
      },
      state: () => ({ x: goose.position.x, y: goose.position.y, z: goose.position.z, yaw: goose.yaw,
        speed: goose.speed, grounded: goose.grounded }),
      show: (v) => { goose.rig.root.visible = v; },
      nearestPathPoint: (x, z) => graph.pos.get(graph.nearest(x, z)) ?? [x, z],
      walkTo: async (x, z, maxSeconds = 900) => {
        const route = graph.route(graph.nearest(goose.position.x, goose.position.z), graph.nearest(x, z)) ?? [];
        let len = 0;
        for (let k = 1; k < route.length; k++) len += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]);
        let wp = 0, t = 0, falls = 0, lastProgress = 0, bestDist = Infinity, minClear = Infinity;
        let falling = false;
        while (wp < route.length && t < maxSeconds) {
          const [tx, tz] = route[wp];
          const dx = tx - goose.position.x, dz = tz - goose.position.z;
          const d = Math.hypot(dx, dz);
          if (d < (wp === route.length - 1 ? 2.0 : 1.5)) { wp++; bestDist = Infinity; continue; }
          if (d < bestDist - 0.5) { bestDist = d; lastProgress = t; }
          if (t - lastProgress > 12) break;
          const heading = Math.atan2(dx, -dz);
          const rel = heading - D2R(follow.yaw);
          step(FIXED_DT, { move: new THREE.Vector2(Math.sin(rel), Math.cos(rel)), run: true, crouch: false, honk: false, flap: false });
          t += FIXED_DT;
          if (Math.round(t / FIXED_DT) % 30 === 0) await stream.update(goose.position.x, goose.position.z);
          const ground = stream.heightAt(goose.position.x, goose.position.z);
          if (Number.isFinite(ground)) {
            const clear = goose.position.y - ground;
            minClear = Math.min(minClear, clear);
            const below = clear < -0.5;
            if (below && !falling) falls++;
            falling = below;
          }
        }
        const p = goose.position;
        return { arrived: wp >= route.length, falls, stuck: wp < route.length, seconds: Math.round(t),
          routeLength: Math.round(len), minClearance: minClear, end: { x: p.x, y: p.y, z: p.z } };
      },
    },
  };
  window.__wgs = handle;
  console.log(`[wgs] backend ${rig.backend}`);

  await spawn(follow.x, follow.z);
  if (testMode) goose.rig.root.visible = false;

  let running = true;
  let last = performance.now();
  let acc = 0;
  const frame = () => {
    if (!running) return;
    const now = performance.now();
    acc += Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!testMode) {
      const input = readInput();
      while (acc >= FIXED_DT) { step(FIXED_DT, input); acc -= FIXED_DT; }
      if (keys.has("KeyQ")) follow.yaw -= 70 * FIXED_DT;
      if (keys.has("KeyE")) follow.yaw += 70 * FIXED_DT;
      placeCamera();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return () => {
    running = false;
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    window.removeEventListener("wheel", onWheel);
    renderer.dispose();
  };
}
