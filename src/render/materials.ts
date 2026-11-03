import * as THREE from "three/webgpu";
import {
  abs, attribute, clamp, dot, float, floor, fract, fwidth, hash, length, mix, mx_noise_float, positionWorld,
  normalWorld, screenCoordinate, smoothstep, step, uniform, vec2, vec3,
} from "three/tsl";
import { swatch } from "@/config";
import { facadeColor } from "./facade";

/**
 * Occlusion fade (doc 02 section 8): fragments near the segment from the camera to the goose, in front
 * of the goose, are dithered away in screen space so the goose stays visible behind buildings and trees.
 */
export const occlusion = {
  camera: uniform(new THREE.Vector3()),
  focus: uniform(new THREE.Vector3()),
  radius: uniform(3.2),
  enabled: uniform(1),
};

function occlusionMask() {
  const seg = occlusion.focus.sub(occlusion.camera);
  const len = length(seg);
  const dir = seg.div(len);
  const rel = positionWorld.sub(occlusion.camera);
  const t = dot(rel, dir);
  const dist = length(rel.sub(dir.mul(t)));
  const inFront = step(float(0), t).mul(step(t, len.sub(1.2)));
  const fade = float(1).sub(smoothstep(occlusion.radius, occlusion.radius.add(2.5), dist)).mul(inFront).mul(occlusion.enabled);
  const p = floor(screenCoordinate.xy);
  const ign = fract(float(52.9829189).mul(fract(dot(p, vec2(0.06711056, 0.00583715)))));
  return ign.greaterThan(clamp(fade.mul(0.85), 0, 1));
}

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

/** Facade: researched wall colour and window pattern per style, roof colour, baked foot darkening. */
export function makeFacadeMaterial(styleName: string): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  const f = facadeColor(styleName, false);
  const jitter = hash(f.seed).sub(0.5).mul(0.04);
  // a whisper of ground darkening at the foot of every wall (baked-AO stand-in)
  const foot = smoothstep(float(0), float(1.2), f.hAbove).mul(0.12).add(0.88);
  m.colorNode = f.color.add(vec3(jitter)).mul(mix(foot, float(1), f.isRoof));
  m.maskNode = occlusionMask();
  return m;
}

/** Tree crowns: flat colour (instance colour adds variation), dithered when they hide the goose. */
export function makeCanopyMaterial(colorName: string): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  m.colorNode = uniform(swatch(colorName));
  m.maskNode = occlusionMask();
  return m;
}

/** Goose: vertex-painted plumage with a slight value lift so it reads against the campus. */
export function makeGooseMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  m.vertexColors = true;
  m.colorNode = vec3(1.08);
  return m;
}

export function makeVertexColorMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  m.vertexColors = true;
  return m;
}
