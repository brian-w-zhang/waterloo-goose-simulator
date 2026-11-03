import * as THREE from "three/webgpu";
import { color, fog, rangeFogFactor } from "three/tsl";
import { campus, swatch, swatchHex } from "@/config";

export interface SceneRig {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  backend: "webgpu" | "webgl2";
  /** Keep the shadow camera centred on the point of interest. */
  followShadow: (target: THREE.Vector3) => void;
}

export async function createScene(canvas: HTMLCanvasElement, forceWebGL: boolean): Promise<SceneRig> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "webgpu" : "webgl2";
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = swatch("sky");
  scene.fogNode = fog(color(swatchHex("sky")), rangeFogFactor(campus.fog.near_m, campus.fog.far_m));

  const hemi = new THREE.HemisphereLight(swatch("sky", "light"), swatch("ground", "light"), 1.6);
  const sun = new THREE.DirectionalLight(swatch("sun", "light"), 1.3);
  const az = THREE.MathUtils.degToRad(campus.sun.azimuth_deg);
  const el = THREE.MathUtils.degToRad(campus.sun.elevation_deg);
  // direction toward the sun: azimuth clockwise from north (-z), elevation above the horizon
  const toSun = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  sun.castShadow = true;
  sun.shadow.intensity = campus.sun.shadow_intensity;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  const ext = campus.sun.shadow_extent_m / 2;
  const cam = sun.shadow.camera as THREE.OrthographicCamera;
  cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
  cam.near = 1; cam.far = 800;
  scene.add(hemi, sun, sun.target);

  const followShadow = (target: THREE.Vector3) => {
    // snap to shadow texels so shadows do not swim as the camera moves
    const texel = (2 * ext) / sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel, tz = Math.round(target.z / texel) * texel;
    sun.target.position.set(tx, target.y, tz);
    sun.position.copy(sun.target.position).addScaledVector(toSun, 400);
  };
  return { renderer, scene, sun, backend, followShadow };
}
