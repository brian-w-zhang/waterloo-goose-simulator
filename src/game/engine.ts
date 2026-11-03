import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { Goose, type GooseInput } from "@/goose/goose";
import { loadRapier, Physics } from "@/physics/physics";
import { makeGooseMaterial, occlusion } from "@/render/materials";
import { createScene } from "@/render/scene";
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
  goose: {
    place(x: number, z: number): Promise<void>;
    /** Run the simulation for `seconds` with a fixed input; returns the goose position afterwards. */
    simulate(seconds: number, input: Partial<GooseInput> & { mx?: number; my?: number }): Promise<{ x: number; y: number; z: number; ground: number }>;
    state(): { x: number; y: number; z: number; yaw: number; speed: number; grounded: boolean };
    show(v: boolean): void;
  };
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
  };
  stream.onEvict = (key) => physics.removeChunk(key);
  await stream.init();
  scene.add(stream.root);

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
