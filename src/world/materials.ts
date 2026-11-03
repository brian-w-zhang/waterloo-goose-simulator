import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { swatch } from "@/config";
import {
  makeFacadeMaterial, makeGroundMaterial, makePieceMaterial, makeVertexColorMaterial, makeWaterMaterial,
} from "@/render/materials";

export interface Materials {
  ground: THREE.Material;
  pieces: THREE.Material;
  water: THREE.Material;
  canopy: THREE.Material;
  conifer: THREE.Material;
  trunk: THREE.Material;
  vertexColor: THREE.Material;
  facade: (style: string) => THREE.Material;
  geo: { blob: THREE.BufferGeometry; cone: THREE.BufferGeometry; trunk: THREE.BufferGeometry };
  props: Record<string, THREE.BufferGeometry>;
}

function solid(color: string, mat?: THREE.MeshToonNodeMaterial): THREE.MeshToonNodeMaterial {
  const m = mat ?? new THREE.MeshToonNodeMaterial();
  m.color = swatch(color);
  return m;
}

/** A primitive translated and painted with one palette colour (vertex colours, for merging). */
function part(g: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.translate(x, y, z);
  const c = swatch(color);
  const n = ng.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  ng.deleteAttribute("uv");
  return ng;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);

function propGeometries(): Record<string, THREE.BufferGeometry> {
  const bench = mergeGeometries([
    part(box(1.8, 0.07, 0.42), "prop_wood", 0, 0.45, 0),
    part(box(1.8, 0.3, 0.06), "prop_wood", 0, 0.72, -0.22),
    part(box(0.08, 0.45, 0.4), "prop_metal", -0.75, 0.22, 0),
    part(box(0.08, 0.45, 0.4), "prop_metal", 0.75, 0.22, 0),
  ]);
  const bin = mergeGeometries([
    part(cyl(0.28, 0.85), "prop_bin", 0, 0.425, 0),
    part(cyl(0.3, 0.06), "prop_metal", 0, 0.88, 0),
  ]);
  const rack = mergeGeometries([0, 1, 2, 3].flatMap((k) => [
    part(box(0.05, 0.8, 0.05), "prop_metal", -0.9 + k * 0.6, 0.4, -0.3),
    part(box(0.05, 0.8, 0.05), "prop_metal", -0.9 + k * 0.6, 0.4, 0.3),
    part(box(0.05, 0.05, 0.65), "prop_metal", -0.9 + k * 0.6, 0.8, 0),
  ]));
  const lamp = mergeGeometries([
    part(cyl(0.07, 5.0, 8), "prop_lamp", 0, 2.5, 0),
    part(box(0.5, 0.18, 0.3), "prop_lamp", 0.15, 5.0, 0),
  ]);
  const picnic = mergeGeometries([
    part(box(1.8, 0.06, 0.75), "prop_wood", 0, 0.74, 0),
    part(box(1.8, 0.05, 0.28), "prop_wood", 0, 0.44, 0.62),
    part(box(1.8, 0.05, 0.28), "prop_wood", 0, 0.44, -0.62),
    part(box(0.08, 0.74, 1.5), "prop_wood", -0.7, 0.37, 0),
    part(box(0.08, 0.74, 1.5), "prop_wood", 0.7, 0.37, 0),
  ]);
  const shelter = mergeGeometries([
    part(box(3.2, 2.2, 0.06), "prop_shelter", 0, 1.1, -0.7),
    part(box(0.06, 2.2, 1.4), "prop_shelter", -1.6, 1.1, 0),
    part(box(3.4, 0.1, 1.6), "prop_metal", 0, 2.25, 0),
    part(box(2.4, 0.06, 0.4), "prop_wood", 0, 0.45, -0.45),
  ]);
  const hydrant = mergeGeometries([
    part(cyl(0.14, 0.6), "prop_hydrant", 0, 0.3, 0),
    part(new THREE.SphereGeometry(0.15, 10, 6), "prop_hydrant", 0, 0.62, 0),
    part(cyl(0.06, 0.38).rotateZ(Math.PI / 2), "prop_hydrant", 0, 0.42, 0),
  ]);
  return {
    bench, waste_basket: bin, bicycle_parking: rack, street_lamp: lamp,
    picnic_table: picnic, bus_stop: shelter, fire_hydrant: hydrant,
  };
}

function treeGeometries() {
  // Deciduous crown: three soft spheres in a unit box (y 0 to 1, radius about 1).
  const s = (r: number, x: number, y: number, z: number) => {
    const g = new THREE.SphereGeometry(r, 12, 8);
    g.scale(1, 0.5 / 0.6, 1);
    g.translate(x, y, z);
    g.deleteAttribute("uv");
    return g;
  };
  const blob = mergeGeometries([s(0.82, 0, 0.5, 0), s(0.55, 0.42, 0.42, 0.18), s(0.5, -0.36, 0.5, -0.24)]);
  const c1 = new THREE.ConeGeometry(1, 0.62, 9); c1.translate(0, 0.31, 0);
  const c2 = new THREE.ConeGeometry(0.72, 0.55, 9); c2.translate(0, 0.68, 0);
  [c1, c2].forEach((g) => g.deleteAttribute("uv"));
  const cone = mergeGeometries([c1, c2]);
  const trunk = new THREE.CylinderGeometry(0.8, 1, 1, 6);
  trunk.translate(0, 0.5, 0);
  trunk.deleteAttribute("uv");
  return { blob, cone, trunk };
}

export function makeMaterials(): Materials {
  const facades = new Map<string, THREE.Material>();
  return {
    ground: makeGroundMaterial(),
    pieces: makePieceMaterial(),
    water: makeWaterMaterial(),
    canopy: solid("tree_canopy"),
    conifer: solid("conifer"),
    trunk: solid("trunk"),
    vertexColor: makeVertexColorMaterial(),
    facade: (style) => {
      let m = facades.get(style);
      if (!m) { m = makeFacadeMaterial(style); facades.set(style, m); }
      return m;
    },
    geo: treeGeometries(),
    props: propGeometries(),
  };
}
