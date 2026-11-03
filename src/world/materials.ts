import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { swatch } from "@/config";
import {
  makeCanopyMaterial, makeFacadeMaterial, makeGroundMaterial, makePieceMaterial, makeVertexColorMaterial, makeWaterMaterial,
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
  geo: { blob: THREE.BufferGeometry; cone: THREE.BufferGeometry; trunk: THREE.BufferGeometry;
    tufts: [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry] };
  props: Record<string, THREE.BufferGeometry>;
  door: THREE.BufferGeometry;
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
    const g = new THREE.SphereGeometry(r, 9, 6);
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

/** Grass tuft (four leaning blades) and two flower clusters, about 0.3 m tall, vertex-coloured. */
function tuftGeometries(): [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry] {
  const blades = (color: string, tip: string) => {
    const pos: number[] = [], col: number[] = [], nrm: number[] = [];
    const base = swatch(color), top = swatch(tip);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4 * k;
      const ox = Math.cos(a) * 0.06, oz = Math.sin(a) * 0.06;
      const lean = 0.08 + 0.04 * (k % 2);
      const h = 0.32 + 0.1 * ((k * 7) % 3) / 2;
      const sx = -Math.sin(a) * 0.05, sz = Math.cos(a) * 0.05;
      pos.push(ox - sx, 0, oz - sz, ox + sx, 0, oz + sz, ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean);
      for (let v = 0; v < 3; v++) nrm.push(Math.cos(a) * 0.3, 0.9, Math.sin(a) * 0.3);
      col.push(base.r, base.g, base.b, base.r, base.g, base.b, top.r, top.g, top.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  // flat six-petal discs facing up (a few triangles each) on top of a tuft
  const disc = (r: number, color: string, x: number, y: number, z: number) =>
    part(new THREE.CircleGeometry(r, 6).rotateX(-Math.PI / 2), color, x, y, z);
  const flower = (petal: string) => mergeGeometries([
    blades("grass_dark", "grass"),
    disc(0.06, petal, 0.02, 0.3, 0.01), disc(0.025, "flower_yellow", 0.02, 0.305, 0.01),
    disc(0.05, petal, -0.06, 0.24, 0.05),
  ].map((g) => (g.index ? g.toNonIndexed() : g)));
  return [blades("grass_shadow", "grass"), flower("stucco_white"), flower("flower_pink")];
}

export function makeMaterials(): Materials {
  const facades = new Map<string, THREE.Material>();
  return {
    ground: makeGroundMaterial(),
    pieces: makePieceMaterial(),
    water: makeWaterMaterial(),
    canopy: makeCanopyMaterial("tree_canopy"),
    conifer: makeCanopyMaterial("conifer"),
    trunk: solid("trunk"),
    vertexColor: makeVertexColorMaterial(),
    facade: (style) => {
      let m = facades.get(style);
      if (!m) { m = makeFacadeMaterial(style); facades.set(style, m); }
      return m;
    },
    geo: { ...treeGeometries(), tufts: tuftGeometries() },
    props: propGeometries(),
    // a glazed double door in a pale frame, front face toward local +z
    door: mergeGeometries([
      part(box(2.1, 2.6, 0.12), "mullion", 0, 1.3, 0.02),
      part(box(1.8, 2.35, 0.06), "window_dark", 0, 1.2, 0.08),
      part(box(0.05, 2.35, 0.07), "mullion", 0, 1.2, 0.1),
    ]),
  };
}
