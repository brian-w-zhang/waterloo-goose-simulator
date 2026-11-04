import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { swatch } from "@/config";

/** Fallback Canada goose built from code primitives (used if public/models/goose.glb fails to load); faces +z, feet at y = 0, about 0.9 m tall with the neck up. */

type Painter = (p: THREE.Vector3) => string;

function painted(g: THREE.BufferGeometry, paint: Painter): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  const pos = ng.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  // paint per triangle (by its centroid) so colour borders stay crisp, like flat-painted toys
  for (let t = 0; t < pos.count; t += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(pos, t + k));
    v.divideScalar(3);
    const c = swatch(paint(v), "goose");
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (t + k) * 3);
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return ng;
}

function ellipsoid(rx: number, ry: number, rz: number, ws = 18, hs = 12) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

export interface GooseRig {
  root: THREE.Group;        // placed in the world; yaw only
  body: THREE.Group;        // bob, roll, pitch
  neck: THREE.Mesh;         // tube rebuilt each frame along the neck curve
  head: THREE.Group;
  /** a point at the bill (grab socket); the procedural bill mesh, or an anchor on the skinned jaw bone */
  lowerBill: THREE.Object3D;
  wings: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  feet: [THREE.Mesh, THREE.Mesh];
  material: THREE.Material;
  honkLines: THREE.Group;
  ripple: THREE.Mesh;
}

const NECK_SEGS = 12;
const NECK_RADIAL = 9;

export function makeNeckGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const n = (NECK_SEGS + 1) * NECK_RADIAL;
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const c = swatch("neck", "goose");
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) col.set([c.r, c.g, c.b], k * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const idx: number[] = [];
  for (let s = 0; s < NECK_SEGS; s++) {
    for (let r = 0; r < NECK_RADIAL; r++) {
      const a = s * NECK_RADIAL + r, b = s * NECK_RADIAL + ((r + 1) % NECK_RADIAL);
      const c2 = a + NECK_RADIAL, d = b + NECK_RADIAL;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  g.setIndex(idx);
  return g;
}

/** Rebuild the neck tube along a quadratic Bezier from base to head, tapering. */
export function updateNeck(g: THREE.BufferGeometry, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const pt = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const ref = new THREE.Vector3(1, 0, 0);
  for (let s = 0; s <= NECK_SEGS; s++) {
    const t = s / NECK_SEGS, u = 1 - t;
    pt.set(0, 0, 0).addScaledVector(p0, u * u).addScaledVector(p1, 2 * u * t).addScaledVector(p2, t * t);
    tan.copy(p1).sub(p0).multiplyScalar(2 * u).addScaledVector(p2.clone().sub(p1), 2 * t).normalize();
    side.crossVectors(tan, ref).normalize();
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    up.crossVectors(side, tan).normalize();
    const rad = 0.062 * (1 - t) + 0.043 * t + 0.012 * Math.sin(Math.PI * t * 0.9) * (1 - t);
    for (let r = 0; r < NECK_RADIAL; r++) {
      const a = (r / NECK_RADIAL) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const nx = side.x * dx + up.x * dy, ny = side.y * dx + up.y * dy, nz = side.z * dx + up.z * dy;
      const k = s * NECK_RADIAL + r;
      pos.setXYZ(k, pt.x + nx * rad, pt.y + ny * rad, pt.z + nz * rad);
      nrm.setXYZ(k, nx, ny, nz);
    }
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  g.computeBoundingSphere();
}

export function makeGoose(material: THREE.Material): GooseRig {
  const root = new THREE.Group();
  root.name = "goose";
  const body = new THREE.Group();
  root.add(body);

  // body: brown-grey back, pale tan breast, white undertail and belly-rear
  const bodyGeo = painted(ellipsoid(0.2, 0.17, 0.36, 22, 14), (p) => {
    if (p.z < -0.17 && p.y < 0.02) return "undertail";
    if (p.z > 0.1 && p.y < 0.07) return "breast";
    if (p.y < -0.08) return p.z > -0.05 ? "breast" : "undertail";
    return "body";
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, material);
  bodyMesh.position.set(0, 0.42, 0);
  bodyMesh.rotation.x = -0.12;
  body.add(bodyMesh);

  // tail: short black wedge, slightly upturned
  const tailGeo = painted(new THREE.ConeGeometry(0.09, 0.2, 8).rotateX(-Math.PI / 2).scale(1.3, 0.45, 1), () => "tail");
  const tail = new THREE.Mesh(tailGeo, material);
  tail.position.set(0, 0.5, -0.4);
  tail.rotation.x = -0.35;
  body.add(tail);

  // wings: a solid brown wing over a slightly larger pale ellipsoid that shows as a clean lower rim
  // (the layered feather edge of a folded Canada goose wing), dark primaries at the tip
  const wingGeo = mergeGeometries([
    painted(ellipsoid(0.06, 0.12, 0.3, 16, 12), (p) => (p.z < -0.24 ? "tail" : "body")),
    painted(ellipsoid(0.055, 0.1, 0.27, 14, 10).translate(0.004, -0.035, 0.01), () => "body_edge"),
  ]);
  const wings: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  [-1, 1].forEach((sgn, k) => {
    const w = wings[k];
    w.position.set(sgn * 0.13, 0.52, 0.06);
    const m = new THREE.Mesh(wingGeo, material);
    m.position.set(sgn * 0.035, -0.04, -0.12);
    m.rotation.x = -0.1;
    w.add(m);
    body.add(w);
  });

  // neck tube
  const neck = new THREE.Mesh(makeNeckGeometry(), material);
  neck.frustumCulled = false;
  body.add(neck);

  // head: black with the white chinstrap wrapping the cheeks and under the chin
  const head = new THREE.Group();
  const headGeo = painted(ellipsoid(0.058, 0.062, 0.095, 16, 12), (p) => {
    const cheek = p.z > -0.06 && p.z < 0.035 && p.y < 0.02;
    return cheek && (Math.abs(p.x) > 0.03 || p.y < -0.035) ? "chinstrap" : "neck";
  });
  const headMesh = new THREE.Mesh(headGeo, material);
  headMesh.position.set(0, 0, 0.02);
  head.add(headMesh);
  const upperBill = new THREE.Mesh(painted(new THREE.ConeGeometry(0.03, 0.085, 8).rotateX(Math.PI / 2).scale(1, 0.55, 1), () => "bill"), material);
  upperBill.position.set(0, 0.0, 0.135);
  head.add(upperBill);
  const lowerBill = new THREE.Mesh(painted(new THREE.ConeGeometry(0.022, 0.07, 8).rotateX(Math.PI / 2).scale(1, 0.4, 1), () => "bill"), material);
  lowerBill.position.set(0, -0.012, 0.125);
  head.add(lowerBill);
  // procedural head meshes are hidden when the skinned model takes over (rig.head itself stays: worn items live on it)
  for (const m of [headMesh, upperBill, lowerBill]) m.userData.procedural = true;
  body.add(head);

  // legs and webbed feet (dark grey-black)
  const legGeo = painted(new THREE.CylinderGeometry(0.016, 0.014, 0.26, 6).translate(0, -0.13, 0), () => "legs");
  const footShape = new THREE.Shape();
  footShape.moveTo(0, -0.01); footShape.lineTo(0.05, 0.085); footShape.lineTo(0.015, 0.075);
  footShape.lineTo(0, 0.095); footShape.lineTo(-0.015, 0.075); footShape.lineTo(-0.05, 0.085); footShape.lineTo(0, -0.01);
  const footGeo = painted(new THREE.ExtrudeGeometry(footShape, { depth: 0.012, bevelEnabled: false })
    .rotateX(Math.PI / 2).translate(0, 0.012, 0), () => "legs");
  const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const feet: [THREE.Mesh, THREE.Mesh] = [new THREE.Mesh(footGeo, material), new THREE.Mesh(footGeo, material)];
  [-1, 1].forEach((sgn, k) => {
    legs[k].position.set(sgn * 0.075, 0.27, 0.02);
    legs[k].add(new THREE.Mesh(legGeo, material));
    root.add(legs[k]);
    root.add(feet[k]);
  });

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // honk strokes: three short pale dashes fanning out in front of the bill, shown briefly on a honk
  const honkLines = new THREE.Group();
  const dash = painted(new THREE.CapsuleGeometry(0.012, 0.09, 2, 6).rotateX(Math.PI / 2), () => "chinstrap");
  for (const a of [-0.5, 0, 0.5]) {
    const m = new THREE.Mesh(dash, material);
    m.position.set(Math.sin(a) * 0.12, Math.cos(a) * 0.05, 0.28);
    m.rotation.y = a;
    honkLines.add(m);
  }
  honkLines.visible = false;
  head.add(honkLines);
  // ripple ring on the water surface while swimming
  const ripple = new THREE.Mesh(painted(new THREE.RingGeometry(0.46, 0.51, 28).rotateX(-Math.PI / 2), () => "ripple"), material);
  ripple.visible = false;
  root.add(ripple);
  return { root, body, neck, head, lowerBill, wings, legs, feet, material, honkLines, ripple };
}
