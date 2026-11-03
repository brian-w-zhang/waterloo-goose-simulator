import * as THREE from "three/webgpu";
import {
  abs, attribute, dot, float, floor, fract, hash, length, mix, mx_noise_float, positionView, positionWorld,
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

function occlusionMask(scale = 1) {
  const d = length(screenCoordinate.xy.sub(occlusion.screen));
  const nearer = step(positionView.z.negate(), occlusion.depth.sub(1.5));
  const r = occlusion.radius.mul(scale);
  const inside = float(1).sub(smoothstep(r.mul(0.75), r, d));
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
/** Index of the "paving" ground class; set from public/world/index.json once the world loads. */
export const pavingClass = uniform(-1);

export function makePieceMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  m.vertexColors = true;
  // paving slabs: thin darker joints on a 1.2 m world grid, only on the paving class
  const g = fract(positionWorld.xz.div(1.2));
  const joint = float(1).sub(step(0.05, g.x).mul(step(0.05, g.y)));
  const isPaving = step(abs(attribute("cls", "float").sub(pavingClass)), float(0.5));
  // vertexColors = true makes the material multiply by the vertex colour itself
  m.colorNode = vec3(mx_noise_float(positionWorld.xz.mul(0.25)).mul(0.02).add(1).sub(joint.mul(isPaving).mul(0.07)));
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -4;
  return m;
}

/** Water: flat colour with a lighter band near the shore (distance attribute from the pipeline). */
export function makeWaterMaterial(): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  const ripple = mx_noise_float(positionWorld.xz.mul(0.08)).mul(0.02);
  const edge = float(1).sub(smoothstep(float(0.8), float(3.0), attribute("shore", "float")));
  m.colorNode = mix(uniform(swatch("water")), uniform(swatch("water_edge")), edge).add(ripple);
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
  // crowns open wider than walls: a big canopy right in front of the goose hides everything else
  m.maskNode = occlusionMask(2.2);
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
