import * as THREE from "three/webgpu";
import { abs, attribute, equal, float, fract, mix, mx_noise_float, positionWorld, normalWorld, select, step, uniform, vec3 } from "three/tsl";
import { styleRules, swatch } from "@/config";

/**
 * Debug views for the harness (doc 08 sections 2.2 and 3.2):
 * - "id": unlit flat colours, buildings / paths / water / everything else (top-down registration);
 * - "palette": each material's base palette colour, no lighting, jitter, AO or fog (palette lock).
 */
export type DebugMode = "id" | "palette" | null;

type Style = { wall: string; band: string; roof: string; storey_m: number; band_lo: number; band_hi: number };

function basic(colorNode: ReturnType<typeof vec3> | ReturnType<typeof uniform>): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = colorNode as never;
  m.fog = false;
  return m;
}

export function debugMaterial(mesh: THREE.Mesh, mode: Exclude<DebugMode, null>, classes: string[]): THREE.Material | null {
  const name = mesh.name;
  const dc = (k: string) => uniform(swatch(k, "debug"));
  if (mode === "id") {
    if (name.startsWith("buildings_")) return basic(dc("id_building"));
    if (name === "lakes") return basic(dc("id_water"));
    if (name === "terrain") return basic(dc("id_ground"));
    if (name === "ground_pieces") {
      const cls = attribute("cls", "float");
      const [r, pv, pa] = ["road", "paving", "path"].map((k) => equal(cls, float(classes.indexOf(k))).select(float(1), float(0)));
      const isPath = r.add(pv).add(pa);
      const isWater = equal(cls, float(classes.indexOf("water"))).select(float(1), float(0));
      return basic(select(isWater.greaterThan(0.5), dc("id_water"), select(isPath.greaterThan(0.5), dc("id_path"), dc("id_ground"))) as never);
    }
    return null;  // trees and props are hidden in the id view
  }
  if (name.startsWith("buildings_")) {
    const s = (styleRules.styles as Record<string, Style>)[name.slice("buildings_".length)];
    const st = fract(positionWorld.y.div(s.storey_m));
    const inBand = step(float(s.band_lo), st).mul(float(1).sub(step(float(s.band_hi), st)));
    const isRoof = step(0.7, abs(normalWorld.y));
    const wall = mix(uniform(swatch(s.wall)), uniform(swatch(s.band)), inBand.mul(float(1).sub(isRoof)));
    return basic(mix(wall, uniform(swatch(s.roof)), isRoof) as never);
  }
  if (name === "terrain") {
    const patches = step(0.2, mx_noise_float(positionWorld.xz.mul(0.035)));
    return basic(mix(uniform(swatch("grass_dark")), uniform(swatch("grass")), patches) as never);
  }
  if (name === "lakes") return basic(uniform(swatch("water")));
  const src = mesh.material as THREE.Material & { vertexColors?: boolean; color?: THREE.Color };
  if (name === "ground_pieces" || src.vertexColors) {
    const m = new THREE.MeshBasicNodeMaterial();
    m.vertexColors = true;
    m.fog = false;
    return m;
  }
  const base = (src as { colorNode?: unknown }).colorNode ?? (src.color ? uniform(src.color) : null);
  return base ? basic(base as never) : null;
}

/** Swap every mesh under `roots` to its debug material (or hide it), or restore the originals. */
export function applyDebugView(roots: THREE.Object3D[], mode: DebugMode, classes: string[]) {
  for (const root of roots) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const ud = mesh.userData as { orig?: THREE.Material; origVisible?: boolean; origInstanceColor?: unknown };
      if (ud.orig) {
        mesh.material = ud.orig;
        mesh.visible = ud.origVisible ?? true;
        const im = mesh as THREE.InstancedMesh;
        if (ud.origInstanceColor !== undefined) im.instanceColor = ud.origInstanceColor as THREE.InstancedBufferAttribute | null;
        delete ud.orig; delete ud.origVisible; delete ud.origInstanceColor;
      }
      if (!mode) return;
      const dm = debugMaterial(mesh, mode, classes);
      ud.orig = mesh.material as THREE.Material;
      ud.origVisible = mesh.visible;
      if (!dm) { mesh.visible = false; return; }
      const im = mesh as THREE.InstancedMesh;
      if (im.isInstancedMesh) { ud.origInstanceColor = im.instanceColor; im.instanceColor = null; }
      mesh.material = dm;
    });
  }
}
