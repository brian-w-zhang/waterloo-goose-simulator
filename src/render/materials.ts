import * as THREE from "three/webgpu";
import {
  dot, float, floor, fract, hash, length, mix, mx_noise_float, positionView, positionWorld,
  screenCoordinate, smoothstep, step, uniform, vec2, vec3,
} from "three/tsl";
import { swatch } from "@/config";
import { facadeColor } from "./facade";

/**
 * Occlusion see-through (doc 02 section 8): fragments closer to the camera than the goose, inside a
 * screen-space circle around it, are removed with a dithered rim, so the goose stays visible behind
 * buildings and trees without fading whole walls.
 */
export const occlusion = {
  screen: uniform(new THREE.Vector2(-1e4, -1e4)),
  depth: uniform(0),
  radius: uniform(120),
  enabled: uniform(1),
};

function occlusionMask() {
  const d = length(screenCoordinate.xy.sub(occlusion.screen));
  const nearer = step(positionView.z.negate(), occlusion.depth.sub(1.5));
  const inside = float(1).sub(smoothstep(occlusion.radius.mul(0.75), occlusion.radius, d));
  const fade = inside.mul(nearer).mul(occlusion.enabled);
  const p = floor(screenCoordinate.xy);
  const ign = fract(float(52.9829189).mul(fract(dot(p, vec2(0.06711056, 0.00583715)))));
  return ign.greaterThanEqual(fade);
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

/** Reaction marks: unlit, unfogged vertex colours so "?" and "!" always read. */
export function makeMarkMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.vertexColors = true;
  m.fog = false;
  m.depthTest = false;
  return m;
}
