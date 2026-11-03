import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { createScene } from "@/render/scene";
import { makeMaterials } from "@/world/materials";
import { WorldStream } from "@/world/stream";

const D2R = THREE.MathUtils.degToRad;
const CAM = campus.camera;

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
}

declare global { interface Window { __wgs?: GameHandle } }

export async function startGame(canvas: HTMLCanvasElement): Promise<() => void> {
  const params = new URLSearchParams(window.location.search);
  const testMode = params.has("test");
  const rig = await createScene(canvas, params.has("webgl"));
  const { renderer, scene } = rig;
  const mats = makeMaterials();
  const stream = new WorldStream(mats);
  await stream.init();
  scene.add(stream.root);

  const camera = new THREE.PerspectiveCamera(CAM.play_vfov_deg, 1, 0.5, 4000);
  const follow: Follow = {
    x: Number(params.get("x") ?? 960), z: Number(params.get("z") ?? -340),
    yaw: Number(params.get("yaw") ?? 0), pitch: CAM.play_pitch_deg, dist: CAM.play_distance_m, fov: CAM.play_vfov_deg,
  };
  let pose: Pose | null = null;

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
    } else {
      const gy = stream.heightAt(follow.x, follow.z);
      target.set(follow.x, Number.isFinite(gy) ? gy : 15, follow.z);
      camera.fov = follow.fov;
      const back = new THREE.Vector3(-Math.sin(D2R(follow.yaw)), 0, Math.cos(D2R(follow.yaw)));
      camera.position.copy(target)
        .addScaledVector(back, follow.dist * Math.cos(D2R(follow.pitch)))
        .add(new THREE.Vector3(0, follow.dist * Math.sin(D2R(follow.pitch)), 0));
      camera.lookAt(target);
    }
    camera.updateProjectionMatrix();
    rig.followShadow(target);
  };

  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => { if (e.type === "keydown") keys.add(e.code); else keys.delete(e.code); };
  const onWheel = (e: WheelEvent) => {
    follow.dist = THREE.MathUtils.clamp(follow.dist * Math.exp(e.deltaY * 0.001), CAM.play_min_distance_m, CAM.play_max_distance_m);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("wheel", onWheel, { passive: true });

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
  };
  window.__wgs = handle;
  console.log(`[wgs] backend ${rig.backend}`);

  let running = true;
  let last = performance.now();
  let lastChunk = "";
  const frame = () => {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!testMode) {
      const sp = (keys.has("ShiftLeft") ? 40 : 12) * dt;
      const f = new THREE.Vector3(Math.sin(D2R(follow.yaw)), 0, -Math.cos(D2R(follow.yaw)));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      if (keys.has("KeyW") || keys.has("ArrowUp")) { follow.x += f.x * sp; follow.z += f.z * sp; }
      if (keys.has("KeyS") || keys.has("ArrowDown")) { follow.x -= f.x * sp; follow.z -= f.z * sp; }
      if (keys.has("KeyD") || keys.has("ArrowRight")) { follow.x += r.x * sp; follow.z += r.z * sp; }
      if (keys.has("KeyA") || keys.has("ArrowLeft")) { follow.x -= r.x * sp; follow.z -= r.z * sp; }
      if (keys.has("KeyQ")) follow.yaw -= 60 * dt;
      if (keys.has("KeyE")) follow.yaw += 60 * dt;
      const ck = stream.chunkOf(follow.x, follow.z).join("_");
      if (ck !== lastChunk) { lastChunk = ck; void stream.update(follow.x, follow.z); }
      placeCamera();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  };
  if (!testMode) await stream.update(follow.x, follow.z);
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
