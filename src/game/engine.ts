import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { Goose, type GooseInput } from "@/goose/goose";
import { type Network, WalkGraph } from "@/nav/graph";
import { bakeNavMesh, type NavBake, planner as navPlanner } from "@/nav/navmesh";
import { HOTSPOTS } from "./hotspot";
import type { V2 } from "@/sim/sim";
import { loadRapier, Physics } from "@/physics/physics";
import { makeGooseMaterial, makeMarkMaterial, occlusion } from "@/render/materials";
import { AmbientCrowd } from "./ambient";
import { preloadPeople } from "./actors";
import { IonTrain } from "./train";
import { HOTSPOT_SEED, HotspotRuntime } from "./hotspotRuntime";
import { chime, step as footstep } from "@/audio/honk";
import { Music } from "@/audio/music";
import { DecisionClient } from "@/ai/decide";
import { applyDebugView, type DebugMode } from "@/render/debug";
import { createScene } from "@/render/scene";
import { swatch } from "@/config";
import { FarWorld } from "@/world/far";
import { makeMaterials } from "@/world/materials";
import { fetchJson, WorldStream } from "@/world/stream";

const D2R = THREE.MathUtils.degToRad;
const CAM = campus.camera;
const FIXED_DT = 1 / 60;
const AMBIENT_COUNT = 160;
// game clock (doc 05 section 3.2): one game hour is four real minutes, starting mid-morning
const GAME_MIN_PER_S = 0.25;
const START_MIN = 10 * 60 + 12;
const MAX_LIFT_DEG = 14;

export interface Pose { x: number; y: number; z: number; yaw: number; pitch: number; fov: number }
export interface Follow { x: number; z: number; yaw: number; pitch: number; dist: number; fov: number }

/** Test and debug handle exposed as window.__wgs. */
export interface GameHandle {
  backend: string;
  /** True once the world, goose and hotspot are all set up. */
  ready: boolean;
  setPose(p: Pose): void;
  setFollow(f: Partial<Follow>): void;
  /** the live follow camera (its yaw moves when the camera swings around walls) */
  follow(): Follow;
  load(x: number, z: number, radius?: number): Promise<void>;
  render(): void;
  info(): { backend: string; calls: number; triangles: number; loaded: string[]; loads: number; evictions: number;
    failedChunks: Record<string, string>; frameErrors: number };
  heightAt(x: number, z: number): number;
  /** ground class under a point ("lawn" where none is mapped) */
  surfaceAt(x: number, z: number): string | null;
  /** Triangles per mesh name across the loaded world (instances counted). */
  census(): Record<string, number>;
  /** Debug material views and the magenta hole background (doc 08 sections 2.2, 2.3, 3.2). */
  debugView(mode: DebugMode): void;
  holeBackground(on: boolean): void;
  /** Orthographic straight-down render of chunk (i, j) at `px` pixels per side. */
  topDown(i: number, j: number): void;
  /** Decoded-geometry audit: NaN or out-of-world vertices and building counts per loaded chunk. */
  audit(): { badVertices: number; buildingMismatch: string[]; loaded: string[] };
  goose: {
    place(x: number, z: number): Promise<void>;
    /** Player teleport with the transition (flap, paper iris wipe, chunk load behind it, iris open); `label`
     * names the destination on the wipe. Inputs are ignored while it runs; a second call during one is dropped. */
    teleport(x: number, z: number, label?: string): Promise<void>;
    /** True while a teleport transition runs. */
    teleporting(): boolean;
    /** Run the simulation for `seconds` with a fixed input; returns the goose position afterwards. */
    simulate(seconds: number, input: Partial<GooseInput> & { mx?: number; my?: number }): Promise<{ x: number; y: number; z: number; ground: number }>;
    state(): { x: number; y: number; z: number; yaw: number; speed: number; grounded: boolean };
    show(v: boolean): void;
    /** Walk along the outdoor path graph to (x, z) using ordinary goose inputs; for the M1 walk gate. */
    walkTo(x: number, z: number, maxSeconds?: number): Promise<WalkResult>;
    nearestPathPoint(x: number, z: number): [number, number];
  };
  hotspot: {
    grab(): string | null;
    honk(): void;
    npcs(): { id: string; state: string; mark: string; x: number; z: number; holding: string | null }[];
    tasks(): { text: string; done: boolean }[];
    items(): { id: string; name: string; x: number; z: number; heldBy: string | null }[];
    music(): string;
    navmeshes(): { id: string; ms: number; tris: number }[];
    /** the last n simulation events, for scenario scripts */
    events(n: number): unknown[];
    crowd(): number;
  };
}

export interface WalkResult {
  arrived: boolean; falls: number; stuck: boolean; seconds: number; routeLength: number; minClearance: number;
  end: { x: number; y: number; z: number };
}

declare global { interface Window { __wgs?: GameHandle } }

/** Teleport transition phases, sent as a "wgs:teleport" window event for the HUD's iris wipe (src/ui/TeleportWipe.tsx). */
export interface TeleportEvent { phase: "out" | "in" | "done"; x: number; y: number; label?: string; ms: number }

export interface HudState { clock: string; menace: { banked: number; pending: number; multiplier: number; window: number; lastBail: number };
  area: string; tasks: { text: string; done: boolean }[]; prompt: string; holding: string | null; backend: string; toast: string }

export async function startGame(canvas: HTMLCanvasElement, onHud?: (h: HudState) => void): Promise<() => void> {
  const params = new URLSearchParams(window.location.search);
  const testMode = params.has("test");
  // ?noaa: no MSAA, used by the palette-ID check so every pixel is exactly one material colour
  const rig = await createScene(canvas, params.has("webgl"), !params.has("noaa"));
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
  const net = await fetchJson<Network>("/world/network.json");
  const graph = new WalkGraph(net);

  const goose = new Goose(makeGooseMaterial());
  scene.add(goose.rig.root);

  const camera = new THREE.PerspectiveCamera(CAM.play_vfov_deg, 1, 0.3, 4000);
  let frameErrors = 0;   // exceptions caught by the frame loop (see frame())
  let lastDraw: { calls: number; triangles: number } | null = null;   // counters of the last live frame
  const follow: Follow = {
    // default spawn: the open green between MC and DC (23 m from the nearest wall or path)
    x: Number(params.get("x") ?? 940), z: Number(params.get("z") ?? -382),
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
  // smart follow: when a building blocks the view of the goose, lift the camera toward top-down
  let lift = 0;
  let blockedFor = 0;
  let pull = 1;
  let yawGoal: number | null = null;
  let lastSteer = 0;
  const occluded = (from: THREE.Vector3, to: THREE.Vector3) => {
    const d = to.clone().sub(from);
    const L = d.length();
    const hit = physics.world.castRay(new R.Ray(from, d.divideScalar(L)), L, true, undefined, undefined, undefined, undefined,
      (c) => c.parent() === null);
    return !!hit && hit.timeOfImpact < L - 0.5;
  };
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
      // aim at the visible body: afloat it sits at the water surface, above the physics body on the lake bed
      const gy = followGoose ? (goose.swimming ? goose.rig.root.position.y : goose.position.y) : stream.heightAt(follow.x, follow.z);
      target.set(follow.x, (Number.isFinite(gy) ? gy : 15) + 0.4, follow.z);
      if (followGoose && !testMode) target.add(lean);
      camera.fov = follow.fov;
      const back = new THREE.Vector3(-Math.sin(D2R(follow.yaw)), 0, Math.cos(D2R(follow.yaw)));
      // a gentle tilt only: the see-through circle does the rest, so the diorama angle survives
      const pitch = follow.pitch + MAX_LIFT_DEG * lift;
      const dist = follow.dist * (1 - 0.15 * lift) * pull;
      camera.position.copy(target)
        .addScaledVector(back, dist * Math.cos(D2R(pitch)))
        .add(new THREE.Vector3(0, dist * Math.sin(D2R(pitch)), 0));
      if (followGoose && !testMode) {
        const head = goose.position.clone().setY(goose.position.y + 0.6);
        const blocked = occluded(head, camera.position);
        lift = THREE.MathUtils.clamp(lift + (blocked ? 0.04 : -0.02), 0, 1);
        if (!blocked) pull = Math.min(1, pull + 0.004);
        blockedFor = blocked ? blockedFor + 1 : 0;
        // whisker search: after a moment blocked, swing toward the nearest clear yaw (Q and E still steer)
        if (blockedFor > 20 && performance.now() - lastSteer > 1500) {
          const camAt = (yaw: number) => target.clone()
            .add(new THREE.Vector3(-Math.sin(D2R(yaw)), 0, Math.cos(D2R(yaw))).multiplyScalar(dist * Math.cos(D2R(pitch))))
            .add(new THREE.Vector3(0, dist * Math.sin(D2R(pitch)), 0));
          let found = false;
          for (const off of [25, -25, 50, -50, 75, -75, 100, -100, 125, -125]) {
            if (!occluded(head, camAt(follow.yaw + off))) { yawGoal = follow.yaw + off; found = true; break; }
          }
          // spring arm: no clear angle at this distance, so pull the camera in toward the goose
          if (!found) pull = Math.max(pull * 0.7, 0.35);
          blockedFor = 0;
        }
      }
      if (yawGoal !== null) {
        const d = yawGoal - follow.yaw;
        follow.yaw += d * 0.06;
        if (Math.abs(d) < 0.5) yawGoal = null;
      }
      camera.lookAt(target);
      occlusion.enabled.value = followGoose ? 1 : 0;
    }
    camera.updateProjectionMatrix();
    const focus = goose.position.clone().setY(goose.position.y + 0.45);
    occlusion.depth.value = camera.position.distanceTo(focus);
    occlusion.goose.value.copy(goose.position);
    const ndc = focus.clone().project(camera);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    occlusion.screen.value.set((ndc.x * 0.5 + 0.5) * size.x, (0.5 - ndc.y * 0.5) * size.y);
    occlusion.radius.value = size.y * 0.13 * Math.min(1.6, CAM.play_distance_m / Math.max(occlusion.depth.value, 1));
    rig.followShadow(target);
  };

  const keys = new Set<string>();
  // taps shorter than a simulation step still count: keydown latches until a step consumes it
  const tapped = new Set<string>();
  // free-fly debug camera (V): WASD fly, R and F up and down, Q and E turn, Z and X tilt, Shift faster
  let free: Pose | null = null;
  const onKey = (e: KeyboardEvent) => {
    if (e.type === "keydown") { keys.add(e.code); if (!e.repeat) tapped.add(e.code); } else keys.delete(e.code);
    if (e.code === "Space") e.preventDefault();
    if (e.type === "keydown" && e.code === "KeyV" && !e.repeat) {
      free = free ? null : { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: follow.yaw, pitch: -30, fov: 50 };
      pose = free;
    }
  };
  const onWheel = (e: WheelEvent) => {
    follow.dist = THREE.MathUtils.clamp(follow.dist * Math.exp(e.deltaY * 0.001), CAM.play_min_distance_m, CAM.play_max_distance_m);
  };
  // right-click and drag turns the camera: sideways for yaw, up and down for pitch.
  // A left click on open ground teleports the goose there (see onMouse).
  let drag: { x: number; y: number; moved: number } | null = null;
  let dragged = false;
  const onDown = (e: PointerEvent) => { if (e.button === 2) drag = { x: e.clientX, y: e.clientY, moved: 0 }; dragged = false; };
  const onDrag = (e: PointerEvent) => {
    if (!drag || !(e.buttons & 2)) { drag = null; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < 5) return;
    dragged = true;
    const cam = free ?? follow;
    cam.yaw += dx * 0.3;
    cam.pitch = free ? THREE.MathUtils.clamp(cam.pitch - dy * 0.2, -89, 60) : THREE.MathUtils.clamp(cam.pitch + dy * 0.2, 8, 80);
    yawGoal = null;
    lastSteer = performance.now();
  };
  const onUp = () => { drag = null; };
  const noMenu = (e: MouseEvent) => e.preventDefault();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("wheel", onWheel, { passive: true });
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onDrag);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener("contextmenu", noMenu);

  const readInput = (): GooseInput => {
    // teleport transition: no player input; the goose flaps while the iris closes
    if (tele) return { move: new THREE.Vector2(), run: false, crouch: false, honk: false, flap: tele === "out" };
    const mv = new THREE.Vector2(
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0));
    if (mv.lengthSq() > 1) mv.normalize();
    return { move: mv, run: keys.has("ShiftLeft") || keys.has("ShiftRight"), crouch: keys.has("KeyC") || keys.has("ControlLeft"),
      honk: keys.has("Space") || tapped.has("Space"), flap: keys.has("KeyF") || tapped.has("KeyF") };
  };

  let hotspot: HotspotRuntime | null = null;
  let hideTick = 0;
  const t0 = performance.now();
  const gameMinutes = () => START_MIN + ((performance.now() - t0) / 1000) * GAME_MIN_PER_S;
  /** UW 50-minute classes end at :20 and :50; the ten minutes after are the rush (doc 01 section 7). */
  const classChange = (m: number) => { const mm = m % 30; return mm >= 20 && mm < 30; };
  const clockText = () => {
    const m = gameMinutes(), h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
    const rush = classChange(m);
    const toRush = Math.ceil((20 - (m % 30) + 30) % 30);
    return `${h}:${String(mm).padStart(2, "0")} · ${rush ? "class change!" : `next class change in ${toRush} min`}`;
  };
  // camera lean toward nearby people (spec C-2): an inverse-distance weighted blend of everyone within
  // 12 m (chasers weigh triple), heavily smoothed so the frame never flips between people
  const lean = new THREE.Vector3();
  const updateLean = (dt: number) => {
    const want = new THREE.Vector3();
    let wsum = 0;
    for (const n of hotspot?.sim.npcs.values() ?? []) {
      const dx = n.pos.x - goose.position.x, dz = n.pos.z - goose.position.z, d = Math.hypot(dx, dz);
      if (d > 12 || d < 0.5) continue;
      const w = (1 / d) * (n.state === "chase" || n.state === "shoo" ? 3 : 1);
      want.x += dx * w; want.z += dz * w; wsum += w;
    }
    if (wsum > 0) want.multiplyScalar(0.35 / wsum);
    // at most a fifth of the camera distance (4 m at the play distance), so zoomed-in views keep the goose framed
    const maxLean = Math.min(4, follow.dist * 0.2);
    if (want.length() > maxLean) want.setLength(maxLean);
    lean.x = THREE.MathUtils.damp(lean.x, want.x, 1.5, dt);
    lean.z = THREE.MathUtils.damp(lean.z, want.z, 1.5, dt);
  };
  let lastChunk = "";
  const step = (dt: number, input: GooseInput) => {
    goose.waterLevel = stream.waterLevelAt(goose.position.x, goose.position.z);
    if (hotspot && (hideTick = (hideTick + 1) % 30) === 0) {
      hotspot.sim.hideSpots = stream.shrubsNear(goose.position.x, goose.position.z, 30).map(([x, z]) => ({ pos: { x, z }, r: 0.9 }));
    }
    goose.tugging = !!hotspot?.sim.tug;
    goose.attention = hotspot?.attention(goose.position.x, goose.position.z) ?? null;
    goose.holding = hotspot?.heldWeight() ?? null;
    goose.update(dt, input, follow.yaw);
    updateLean(dt);
    physics.world.step();
    hotspot?.step(dt, goose.position, goose.speed, input.crouch);
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

  // ---- teleport transition (UI): flap, the HUD's paper iris closes on the goose, the destination chunks
  // load behind it, the goose is placed, the iris opens on it while the camera settles in from a bit further out
  let tele: "out" | "in" | null = null;
  const TELE_OUT_MS = 420, TELE_IN_MS = 480;
  const gooseOnScreen = () => {
    const p = goose.position.clone().setY(goose.position.y + 0.4).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (0.5 - p.y * 0.5) * r.height };
  };
  const teleEvent = (detail: TeleportEvent) => window.dispatchEvent(new CustomEvent<TeleportEvent>("wgs:teleport", { detail }));
  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
  const teleport = async (x: number, z: number, label?: string) => {
    if (tele) return;
    tele = "out";
    try {
      teleEvent({ phase: "out", ...gooseOnScreen(), label, ms: TELE_OUT_MS });
      // the load starts now, behind the closing iris; the goose is placed once both are done
      const loading = stream.update(x, z);
      await Promise.all([sleep(TELE_OUT_MS), loading]);
      tele = "in";
      await handle.goose.place(x, z);
      const dist = follow.dist, from = Math.max(dist, Math.min(dist * 1.45, CAM.play_max_distance_m * 1.2));
      follow.dist = from;
      placeCamera();
      teleEvent({ phase: "in", ...gooseOnScreen(), label, ms: TELE_IN_MS });
      const t0 = performance.now();
      await new Promise<void>((res) => {
        const ease = () => {
          const k = Math.min((performance.now() - t0) / (TELE_IN_MS + 250), 1);
          follow.dist = dist + (from - dist) * (1 - k) ** 3;
          if (k < 1) setTimeout(ease, 16); else res();
        };
        ease();
      });
    } finally {
      tele = null;
      teleEvent({ phase: "done", x: 0, y: 0, label, ms: 0 });
    }
  };
  // ---- end teleport transition

  const handle: GameHandle = {
    hotspot: { grab: () => null, honk: () => undefined, npcs: () => [], tasks: () => [], items: () => [], music: () => "silent", navmeshes: () => [], events: () => [], crowd: () => 0 },
    ready: false,
    backend: rig.backend,
    setPose: (p) => { pose = p; placeCamera(); },
    setFollow: (f) => { pose = null; Object.assign(follow, f); placeCamera(); },
    follow: () => ({ ...follow }),
    load: async (x, z, radius) => { await stream.update(x, z, radius); placeCamera(); },
    render: () => {
      placeCamera();
      hotspot?.sync(1 / 60, performance.now() / 1000, camera, goose.rig.lowerBill.getWorldPosition(new THREE.Vector3()));
      renderer.render(scene, camera);
    },
    info: () => ({
      backend: rig.backend, calls: lastDraw?.calls ?? renderer.info.render.drawCalls,
      triangles: lastDraw?.triangles ?? renderer.info.render.triangles,
      loaded: stream.loadedKeys(), loads: stream.loadsTotal, evictions: stream.evictionsTotal,
      failedChunks: Object.fromEntries([...stream.failed].map(([k, f]) => [k, f.error])), frameErrors,
    }),
    heightAt: (x, z) => stream.heightAt(x, z),
    surfaceAt: (x, z) => stream.surfaceAt(x, z),
    census: () => {
      const out: Record<string, number> = {};
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        const g = m.geometry;
        const tris = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
        const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
        const key = m.name || m.parent?.name || "unnamed";
        out[key] = (out[key] ?? 0) + Math.round(tris * n);
      });
      return out;
    },
    debugView: (mode) => {
      applyDebugView([stream.root, far.root, goose.rig.root, ...(hotspot ? [hotspot.root] : [])], mode, stream.index.ground_classes);
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
      teleport: (x, z, label) => teleport(x, z, label),
      teleporting: () => tele !== null,
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
  handle.hotspot = {
    grab: () => hotspot?.grabOrDrop() ?? null,
    honk: () => hotspot?.honk(),
    npcs: () => [...(hotspot?.sim.npcs.values() ?? [])].map((n) => ({ id: n.id, state: n.state, mark: n.mark, x: n.pos.x, z: n.pos.z, holding: n.holding })),
    tasks: () => hotspot?.tasks.map((t) => ({ text: t.text, done: t.done })) ?? [],
    items: () => [...(hotspot?.sim.items.values() ?? [])].map((i) => ({ id: i.id, name: i.name, x: i.pos.x, z: i.pos.z, heldBy: i.heldBy })),
    crowd: () => crowd.size,
    music: () => music.current,
    events: (n) => hotspot?.sim.events.slice(-n) ?? [],
    navmeshes: () => [...bakes.entries()].filter(([, v]) => v).map(([k, v]) => ({ id: k, ms: v.bake.ms, tris: v.bake.triangles })),
  };
  window.__wgs = handle;
  console.log(`[wgs] backend ${rig.backend}`);

  await spawn(follow.x, follow.z);
  if (testMode) goose.rig.root.visible = false;
  await preloadPeople();   // the Blender villagers (art/models/people.py)
  hotspot = new HotspotRuntime(physics, (x, z) => stream.heightAt(x, z), mats.vertexColor, makeMarkMaterial(),
    mats.vertexColor, HOTSPOT_SEED);
  hotspot.gooseHeadGroup = goose.rig.head;
  scene.add(hotspot.root);
  if (params.get("jev") === "1") { hotspot.decisions = new DecisionClient(); hotspot.decisions.warm(); }
  // navmeshes per hotspot, baked when the goose first comes near (the chunks there are then loaded)
  const bakes = new Map<string, { bake: NavBake; at: { x: number; z: number }; plan: (a: V2, b: V2) => V2[] }>();
  const NAV_R = 70;
  const bakeFails = new Map<string, number>();
  // every chunk under the hotspot's square must be loaded, or the bake would miss walls and ground
  const covered = (x: number, z: number) => {
    const [i0, j1] = stream.chunkOf(x - NAV_R, z - NAV_R), [i1, j0] = stream.chunkOf(x + NAV_R, z + NAV_R);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!stream.isLoaded(i, j)) return false;
    return true;
  };
  const maybeBake = async () => {
    for (const h of HOTSPOTS) {
      if (bakes.has(h.id) || (bakeFails.get(h.id) ?? 0) >= 3) continue;
      if (Math.hypot(h.anchor.x - goose.position.x, h.anchor.z - goose.position.z) > 120 || !covered(h.anchor.x, h.anchor.z)) continue;
      bakes.set(h.id, null as never);
      let bake: NavBake | null = null, why = "the Recast bake returned no navmesh";
      try {
        const g = stream.geometryNear(h.anchor.x, h.anchor.z, NAV_R);
        bake = await bakeNavMesh(g.positions, g.indices);
      } catch (e) { why = (e as Error).message; }
      if (bake) { bakes.set(h.id, { bake, at: h.anchor, plan: navPlanner(bake, (x, z) => stream.heightAt(x, z)) }); console.log(`[wgs] navmesh ${h.id} ${bake.ms.toFixed(0)} ms, ${bake.triangles} tris`); }
      else {
        bakes.delete(h.id);
        const n = (bakeFails.get(h.id) ?? 0) + 1;
        bakeFails.set(h.id, n);
        console.warn(`[wgs] navmesh ${h.id} failed (${why}), attempt ${n} of 3; characters there walk straight lines`);
      }
    }
  };
  hotspot.sim.planner = (a, b) => {
    for (const v of bakes.values()) {
      if (v && Math.abs(a.x - v.at.x) < NAV_R - 2 && Math.abs(a.z - v.at.z) < NAV_R - 2) {
        return v.plan(a, b);
      }
    }
    return [b];
  };
  void maybeBake();
  // every 3 s: bake navmeshes that became possible, and retry chunks that failed to load
  const poll = setInterval(() => {
    void maybeBake();
    if (stream.failed.size) void stream.update(goose.position.x, goose.position.z);
  }, 3000);
  handle.ready = true;
  const crowd = new AmbientCrowd(graph, (x, z) => stream.heightAt(x, z), mats.vertexColor, AMBIENT_COUNT, HOTSPOT_SEED + 1);
  scene.add(crowd.root);
  const train = new IonTrain(net, mats.vertexColor, (x, z) => stream.heightAt(x, z));
  scene.add(train.root);
  goose.onHonk = () => {
    hotspot?.honk();
    const fled = crowd.honkAt(goose.position.x, goose.position.z);
    if (fled >= 3) hotspot?.menace.add("scatter", hotspot.sim.t, null, fled);
  };
  hotspot.isWater = (x, z) => stream.waterLevelAt(x, z) !== null;
  const hud = (): HudState => ({
    clock: clockText(),
    menace: { banked: hotspot!.menace.banked, pending: hotspot!.menace.pending, multiplier: hotspot!.menace.multiplier,
      window: hotspot!.menace.windowLeft(hotspot!.sim.t), lastBail: hotspot!.menace.lastBail },
    area: hotspot!.nearestHotspot(goose.position.x, goose.position.z).name,
    tasks: hotspot!.tasks.filter((t) => t.hotspot === hotspot!.nearestHotspot(goose.position.x, goose.position.z).id)
      .map((t) => ({ text: hotspot!.unlocked(t) ? t.text : `??? (finish ${t.gate} tasks to unlock)`, done: t.done })),
    prompt: hotspot!.sim.goose.holding ? `G: drop ${hotspot!.sim.items.get(hotspot!.sim.goose.holding)!.name}`
      : (hotspot!.nearestItem() ? `G: grab ${hotspot!.nearestItem()}` : ""),
    holding: hotspot!.sim.goose.holding, backend: rig.backend, toast,
  });
  let toast = "";
  hotspot.onSnatched = () => goose.startle();
  // audio starts on the first input (browsers block audio before a user gesture)
  const music = new Music();
  const startAudio = () => { if (!testMode && !params.has("mute")) music.start(); };
  window.addEventListener("keydown", startAudio, { once: true });
  window.addEventListener("pointerdown", startAudio, { once: true });
  // paved classes slap, everything else (lawn, pitches, woods) is soft
  const HARD = new Set(["road", "paving", "path", "parking", "marking", "stall", "rail"]);
  goose.onStep = (water) => {
    if (testMode || params.has("mute")) return;
    footstep(water ? "water" : HARD.has(stream.surfaceAt(goose.position.x, goose.position.z) ?? "lawn") ? "hard" : "grass");
  };
  hotspot.onTask = (t) => {
    toast = t.text;
    chime();
    onHud?.(hud());
    setTimeout(() => { if (toast === t.text) { toast = ""; onHud?.(hud()); } }, 3200);
  };
  const grab = () => { hotspot?.grabOrDrop(); onHud?.(hud()); };
  const onGrabKey = (e: KeyboardEvent) => { if (e.code === "KeyG" && !e.repeat && !tele) grab(); };
  // left click: cast a ray from the camera through the pointer; teleport only onto ground
  // (an up-facing hit at terrain height), never onto a roof or into a wall
  const onMouse = (e: MouseEvent) => {
    if (e.button !== 0 || dragged || free || tele) return;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const hit = physics.world.castRayAndGetNormal(new R.Ray(o, d), 2000, true, undefined, undefined, undefined, undefined,
      (c) => c.parent() === null);
    if (!hit) return;
    const p = o.clone().addScaledVector(d, hit.timeOfImpact);
    const ground = stream.heightAt(p.x, p.z);
    if (hit.normal.y < 0.7 || !Number.isFinite(ground) || Math.abs(p.y - ground) > 0.8) {
      console.debug(`[wgs] click at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is not open ground (normal y ${hit.normal.y.toFixed(2)}, ${(p.y - ground).toFixed(2)} m above it)`);
      return;
    }
    void handle.goose.teleport(p.x, p.z);
  };
  window.addEventListener("keydown", onGrabKey);
  canvas.addEventListener("click", onMouse);
  onHud?.(hud());
  let hudTimer = 0;
  // speech labels: plain DOM elements positioned over the canvas each frame
  const speechLayer = document.createElement("div");
  speechLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  canvas.parentElement?.appendChild(speechLayer);
  const labels: HTMLDivElement[] = [];
  const drawSpeech = () => {
    const lines = hotspot?.speech() ?? [];
    const w = canvas.clientWidth, h = canvas.clientHeight;
    lines.forEach((l, k) => {
      let el = labels[k];
      if (!el) {
        el = document.createElement("div");
        el.className = "wgs-speech"; // styled in app/globals.css
        speechLayer.appendChild(el);
        labels[k] = el;
      }
      const p = l.pos.clone().project(camera);
      el.style.display = p.z < 1 ? "block" : "none";
      el.style.left = `${(p.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(0.5 - p.y * 0.5) * h}px`;
      el.textContent = l.text;
    });
    for (let k = lines.length; k < labels.length; k++) labels[k].style.display = "none";
  };
  let lastCrowd = performance.now();
  const bill = new THREE.Vector3();

  let running = true;
  let last = performance.now();
  let acc = 0;
  const frame = () => {
    if (!running) return;
    // the next frame is queued first: one exception must not freeze the game for good
    requestAnimationFrame(frame);
    try {
      tick();
    } catch (e) {
      if (frameErrors++ % 300 === 0) console.error(`[wgs] frame failed (${frameErrors} so far)`, e);
    }
  };
  const tick = () => {
    const now = performance.now();
    acc += Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!testMode) {
      if (free) {
        const sp = (keys.has("ShiftLeft") ? 120 : 30) * Math.min(acc, 0.1);
        const fx = Math.sin(D2R(free.yaw)), fz = -Math.cos(D2R(free.yaw));
        if (keys.has("KeyW")) { free.x += fx * sp; free.z += fz * sp; }
        if (keys.has("KeyS")) { free.x -= fx * sp; free.z -= fz * sp; }
        if (keys.has("KeyD")) { free.x -= fz * sp; free.z += fx * sp; }
        if (keys.has("KeyA")) { free.x += fz * sp; free.z -= fx * sp; }
        if (keys.has("KeyR")) free.y += sp;
        if (keys.has("KeyF")) free.y -= sp;
        if (keys.has("KeyQ")) free.yaw -= 60 * Math.min(acc, 0.1);
        if (keys.has("KeyE")) free.yaw += 60 * Math.min(acc, 0.1);
        if (keys.has("KeyZ")) free.pitch = Math.max(-89, free.pitch - 40 * Math.min(acc, 0.1));
        if (keys.has("KeyX")) free.pitch = Math.min(60, free.pitch + 40 * Math.min(acc, 0.1));
        void stream.update(free.x, free.z);
      }
      const input = free ? { move: new THREE.Vector2(), run: false, crouch: false, honk: false, flap: false } : readInput();
      while (acc >= FIXED_DT) { step(FIXED_DT, input); acc -= FIXED_DT; tapped.clear(); input.honk = keys.has("Space"); }
      if (!free && (keys.has("KeyQ") || keys.has("KeyE"))) {
        follow.yaw += (keys.has("KeyE") ? 70 : -70) * FIXED_DT;
        yawGoal = null;
        lastSteer = performance.now();
      }
      placeCamera();
      goose.rig.lowerBill.getWorldPosition(bill);
      hotspot?.sync(1 / 60, now / 1000, camera, bill);
      crowd.count = classChange(gameMinutes()) ? AMBIENT_COUNT * 1.5 : AMBIENT_COUNT * 0.75;
      crowd.update(Math.min((now - lastCrowd) / 1000, 0.1), goose.position.x, goose.position.z);
      train.update(Math.min((now - lastCrowd) / 1000, 0.1));
      lastCrowd = now;
      if ((hudTimer += 1) % 15 === 0) {
        onHud?.(hud());
        const npcs = [...(hotspot?.sim.npcs.values() ?? [])];
        const chasing = npcs.some((n) => n.state === "chase" || n.state === "tug" || n.state === "shoo");
        const near = npcs.some((n) => Math.hypot(n.pos.x - goose.position.x, n.pos.z - goose.position.z) < 14);
        music.set(chasing ? "chase" : near ? "calm" : "silent");
      }
      drawSpeech();
      renderer.render(scene, camera);
      // snapshot the counters now: the renderer resets them at the start of its next frame
      lastDraw = { calls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles };
    }
  };
  requestAnimationFrame(frame);

  return () => {
    running = false;
    clearInterval(poll);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onGrabKey);
    canvas.removeEventListener("click", onMouse);
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onDrag);
    window.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("contextmenu", noMenu);
    speechLayer.remove();
    music.stop();
    renderer.dispose();
  };
}
