import * as THREE from "three/webgpu";
import { campus, swatch } from "@/config";
import { createScene } from "@/render/scene";

/** Style test scene (doc 08 section 3.3): a 10 m cube on flat ground under the game lights. */
export async function startStyleScene(canvas: HTMLCanvasElement) {
  const params = new URLSearchParams(window.location.search);
  const rig = await createScene(canvas, params.has("webgl"));
  const { renderer, scene, sun } = rig;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshToonNodeMaterial());
  (ground.material as THREE.MeshToonNodeMaterial).color = swatch("grass");
  ground.receiveShadow = true;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10).translate(0, 5, 0), new THREE.MeshToonNodeMaterial());
  (cube.material as THREE.MeshToonNodeMaterial).color = swatch("concrete");
  cube.castShadow = true;
  scene.add(ground, cube);
  const camera = new THREE.PerspectiveCamera(campus.camera.style_vfov_deg, 1, 1, 2000);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // look north-east across the cube so its shadow (cast away from the sun) fills the frame
  const target = new THREE.Vector3(4, 0, -8);
  const pitch = THREE.MathUtils.degToRad(campus.camera.style_pitch_deg);
  const d = campus.camera.style_distance_m;
  camera.position.set(target.x, d * Math.sin(pitch), target.z + d * Math.cos(pitch));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  rig.followShadow(new THREE.Vector3(0, 0, 0));
  window.__wgsStyle = {
    backend: rig.backend,
    render: (shadows: boolean) => {
      sun.castShadow = shadows;
      renderer.render(scene, camera);
    },
  };
}

declare global { interface Window { __wgsStyle?: { backend: string; render(shadows: boolean): void } } }
