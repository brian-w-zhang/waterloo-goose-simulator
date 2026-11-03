import * as THREE from "three/webgpu";
import {
  abs, attribute, float, fract, fwidth, hash, mix, mx_noise_float, positionWorld, normalWorld,
  smoothstep, step, uniform, vec3,
} from "three/tsl";
import { styleRules, swatch } from "@/config";

type Style = { wall: string; band: string; roof: string; storey_m: number; band_lo: number; band_hi: number };

/** Lawn: flat grass with soft two-tone patches from world-space noise (no textures). */
export function makeGroundMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  const xz = positionWorld.xz;
  const patches = smoothstep(float(0.05), float(0.35), mx_noise_float(xz.mul(0.035)));
  const fine = mx_noise_float(xz.mul(0.4)).mul(0.015);
  m.colorNode = mix(uniform(swatch("grass_dark")), uniform(swatch("grass")), patches).add(fine);
  return m;
}

/** Draped ground pieces (paths, roads, water, parking...) coloured per vertex by class. */
export function makePieceMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  m.vertexColors = true;
  // vertexColors = true makes the material multiply by the vertex colour itself
  m.colorNode = vec3(mx_noise_float(positionWorld.xz.mul(0.25)).mul(0.02).add(1));
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -4;
  return m;
}

export function makeWaterMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  const ripple = mx_noise_float(positionWorld.xz.mul(0.08)).mul(0.02);
  m.colorNode = uniform(swatch("water")).add(ripple);
  return m;
}

/** Facade: wall colour with world-space storey bands on walls, roof colour on up-facing faces. */
export function makeFacadeMaterial(styleName: string): THREE.MeshToonNodeMaterial {
  const s = (styleRules.styles as Record<string, Style>)[styleName];
  const m = new THREE.MeshToonNodeMaterial();
  const st = fract(positionWorld.y.div(s.storey_m));
  const aa = fwidth(st).mul(1.5);
  const inBand = smoothstep(float(s.band_lo).sub(aa), float(s.band_lo).add(aa), st)
    .mul(float(1).sub(smoothstep(float(s.band_hi).sub(aa), float(s.band_hi).add(aa), st)));
  const isRoof = step(0.7, abs(normalWorld.y));
  const seed = attribute("seed", "float");
  const jitter = hash(seed).sub(0.5).mul(0.05);
  const wall = mix(uniform(swatch(s.wall)), uniform(swatch(s.band)), inBand.mul(float(1).sub(isRoof)));
  const lit = mix(wall, uniform(swatch(s.roof)), isRoof).add(vec3(jitter));
  // a whisper of ground darkening at the foot of every wall (baked-AO stand-in)
  const foot = smoothstep(float(0), float(1.2), attribute("hAbove", "float")).mul(0.12).add(0.88);
  m.colorNode = lit.mul(mix(foot, float(1), isRoof));
  return m;
}

export function makeVertexColorMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  m.vertexColors = true;
  return m;
}
