// Toon recipe for Waterloo Goose Simulator: UGG-style facade material, fog, lights and GTAO post for three.js r187 WebGPU (TSL).
// Node graph construction is smoke-tested in Node.js on Nov 2, 2026; rendering itself is untested. See ../02-graphics-approach.md.
import * as THREE from 'three/webgpu';
import {
  color, uniform, float, vec3, mix, smoothstep, step, fract, fwidth, abs, min,
  positionWorld, normalWorld, hash, vertexColor, fog, rangeFogFactor,
  pass, mrt, output, normalView, saturation, luminance
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

// 1. Palette-locked toon facade material with procedural storey bands (no textures).
export function makeFacadeMaterial({ wall, band, storey = 3.6, seed = 0 }) {
  const m = new THREE.MeshToonNodeMaterial();
  const uWall = uniform(new THREE.Color(wall));
  const uBand = uniform(new THREE.Color(band));
  const uStorey = uniform(storey);
  // world-space storey coordinate; window band occupies the middle 40% of each storey
  const s = fract(positionWorld.y.div(uStorey));
  const aa = fwidth(s).mul(1.5);
  const inBand = smoothstep(float(0.35).sub(aa), float(0.35).add(aa), s)
    .mul(float(1).sub(smoothstep(float(0.75).sub(aa), float(0.75).add(aa), s)));
  // only on walls, not roofs
  const isWall = float(1).sub(step(0.7, abs(normalWorld.y)));
  // tiny per-building tint variation, seeded
  const jitter = hash(float(seed)).sub(0.5).mul(0.06);
  const base = mix(uWall, uBand, inBand.mul(isWall)).add(jitter);
  // baked AO and ground darkening arrive as vertex colours from the pipeline
  m.colorNode = base.mul(vertexColor());
  m.vertexColors = true;
  return m;
}

// 2. Scene fog in sky colour (UGG haze).
export function setupFog(scene, sky = 0xdfe6d8) {
  scene.fogNode = fog(color(sky), rangeFogFactor(250, 1400));
}

// 3. Post: scene pass + GTAO at low strength, multiplied in, optional soft edges skipped.
export function setupPost(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, normal: normalView }));
  const sceneColor = scenePass.getTextureNode('output');
  const aoPass = ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera);
  aoPass.resolutionScale = 0.5;
  const aoTerm = mix(float(1), aoPass.getTextureNode().r, 0.35); // "a whiff of AO"
  pipeline.outputNode = sceneColor.mul(aoTerm);
  return pipeline;
}

// 4. Lights: bright hemisphere + one sun with faint soft shadows.
export function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff6e5, 0x9fb59a, 2.2);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-300, 600, 200);
  sun.castShadow = true;
  sun.shadow.intensity = 0.25;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  scene.add(hemi, sun);
  return sun;
}

// Smoke test: builds the node graphs without a GPU. Run: node toon-recipe.mjs (needs three@0.187.0)
const scene = new THREE.Scene();
const mat = makeFacadeMaterial({ wall: 0xc9b8a0, band: 0x8a9aa3, seed: 17 });
setupFog(scene); setupLights(scene);
console.log('ok', mat.type, mat.isMeshToonNodeMaterial, typeof scene.fogNode, THREE.REVISION);
