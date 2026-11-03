import * as THREE from "three/webgpu";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

/**
 * Art models built by art/build.py (Blender, headless) into public/models/<name>.glb.
 * Meshes carry palette colours in COLOR_0 and no materials; every mesh gets `material`.
 */
const cache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();

export function loadModel(name: string): Promise<GLTF> {
  let p = cache.get(name);
  if (!p) {
    p = loader.loadAsync(`/models/${name}.glb`).catch((e: Error) => {
      cache.delete(name);   // a failed load can be retried
      throw new Error(`model ${name}: ${e.message}`);
    });
    cache.set(name, p);
  }
  return p;
}

/** Give every mesh in `root` the shared palette material (vertex colours on). */
export function applyMaterial(root: THREE.Object3D, material: THREE.Material): THREE.Object3D {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.material = material; m.castShadow = true; m.receiveShadow = true; }
  });
  return root;
}
