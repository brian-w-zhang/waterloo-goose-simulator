import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { swatch } from "@/config";
import type { Npc } from "@/sim/sim";

type Group = "people" | "items";

/** A primitive painted with one palette colour (vertex colours), translated and rotated. */
function paint(g: THREE.BufferGeometry, color: string, group: Group, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  if (rx) ng.rotateX(rx);
  if (rz) ng.rotateZ(rz);
  ng.translate(x, y, z);
  const c = swatch(color, group);
  const n = ng.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) col.set([c.r, c.g, c.b], k * 3);
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return ng;
}

let detail = 1;
const capsule = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, detail > 0.5 ? 4 : 2, detail > 0.5 ? 10 : 6);
const sphere = (r: number, w: number, h: number, ...rest: number[]) =>
  new THREE.SphereGeometry(r, Math.max(5, Math.round(w * detail)), Math.max(4, Math.round(h * detail)), ...rest);

export interface PersonLook { skin: string; hair: string; top: string; bottom: string; hat?: string }

export interface PersonRig {
  root: THREE.Group;
  body: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
  head: THREE.Group;
  hand: THREE.Object3D;
  mark: THREE.Group;
  marks: Record<"?" | "!" | "swirl", THREE.Mesh>;
  bubble: THREE.Group;
  bubbleItem: string | null;
  phase: number;
}

/** A chunky, friendly student or staff member, about 1.7 m, built from capsules and spheres. */
export function makePerson(look: PersonLook, material: THREE.Material, markMaterial: THREE.Material): PersonRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(mergeGeometries([
    paint(capsule(0.2, 0.42), look.top, "people", 0, 1.18, 0),
    paint(sphere(0.06, 8, 6), look.skin, "people", 0, 1.5, 0),
  ]), material);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  head.add(new THREE.Mesh(mergeGeometries([
    paint(sphere(0.15, 14, 10), look.skin, "people", 0, 0.05, 0),
    paint(sphere(0.158, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), look.hair, "people", 0, 0.07, -0.015),
    ...(look.hat ? [paint(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 12), look.hat, "people", 0, 0.2, 0),
      paint(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 14), look.hat, "people", 0, 0.15, 0.04)] : []),
  ]), material));
  body.add(head);
  const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const legGeo = mergeGeometries([paint(capsule(0.085, 0.62), look.bottom, "people", 0, -0.4, 0),
    paint(new THREE.BoxGeometry(0.15, 0.08, 0.26), "shoes", "people", 0, -0.82, 0.05)]);
  const armGeo = mergeGeometries([paint(capsule(0.065, 0.42), look.top, "people", 0, -0.27, 0),
    paint(sphere(0.07, 8, 6), look.skin, "people", 0, -0.56, 0)]);
  [-1, 1].forEach((s, k) => {
    legs[k].position.set(s * 0.1, 0.86, 0);
    legs[k].add(new THREE.Mesh(legGeo, material));
    body.add(legs[k]);
    arms[k].position.set(s * 0.27, 1.42, 0);
    arms[k].add(new THREE.Mesh(armGeo, material));
    body.add(arms[k]);
  });
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.6, 0.06);
  arms[1].add(hand);
  // reaction marks above the head, drawn in flat ink-free shapes
  const mark = new THREE.Group();
  mark.position.set(0, 2.25, 0);
  const bang = new THREE.Mesh(mergeGeometries([
    paint(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), "mark", "items", 0, 0.12, 0),
    paint(new THREE.SphereGeometry(0.055, 8, 6), "mark", "items", 0, -0.12, 0)]), markMaterial);
  const qGeo = new THREE.TorusGeometry(0.1, 0.035, 6, 12, Math.PI * 1.4).rotateZ(-0.2 * Math.PI);
  const query = new THREE.Mesh(mergeGeometries([
    paint(qGeo, "mark", "items", 0, 0.14, 0),
    paint(new THREE.CapsuleGeometry(0.035, 0.06, 4, 8), "mark", "items", 0, 0.0, 0),
    paint(new THREE.SphereGeometry(0.045, 8, 6), "mark", "items", 0, -0.12, 0)]), markMaterial);
  const swirl = new THREE.Mesh(mergeGeometries([
    paint(new THREE.TorusGeometry(0.12, 0.025, 6, 16, Math.PI * 1.6), "mark", "items", 0, 0, 0),
    paint(new THREE.TorusGeometry(0.06, 0.025, 6, 12, Math.PI * 1.5), "mark", "items", 0.02, 0, 0, 0, 1.2)]), markMaterial);
  const marks = { "?": query, "!": bang, swirl };
  for (const m of Object.values(marks)) { m.visible = false; mark.add(m); }
  root.add(mark);
  // thought bubble showing the wanted item (doc 03 R-N2): a pale disc with two trailing dots
  const bubble = new THREE.Group();
  bubble.position.set(0.6, 2.8, 0);
  bubble.add(new THREE.Mesh(mergeGeometries([
    paint(new THREE.CircleGeometry(0.32, 20), "mark_bg", "items"),
    paint(new THREE.CircleGeometry(0.07, 10), "mark_bg", "items", -0.32, -0.36, 0),
    paint(new THREE.CircleGeometry(0.045, 8), "mark_bg", "items", -0.45, -0.52, 0)]), markMaterial));
  bubble.children[0].renderOrder = 1;
  bubble.visible = false;
  root.add(bubble);
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.parent !== mark && o.parent !== bubble) o.castShadow = true; });
  return { root, body, legs, arms, head, hand, mark, marks, bubble, bubbleItem: null, phase: 0 };
}

/** Pose the person from the simulation state; speed in m/s drives the walk or run cycle. */
export function animatePerson(r: PersonRig, n: Npc, speed: number, dt: number, t: number, camera: THREE.Camera) {
  const run = Math.min(Math.max((speed - 1.5) / 2.5, 0), 1);
  r.phase += dt * (speed > 0.05 ? 3.2 + 4 * run + speed * 1.2 : 0);
  const s = Math.sin(r.phase), moving = Math.min(speed / 1.2, 1);
  r.legs[0].rotation.x = s * 0.6 * moving;
  r.legs[1].rotation.x = -s * 0.6 * moving;
  r.body.position.y = Math.abs(Math.cos(r.phase)) * 0.04 * moving;
  r.body.rotation.x = 0.18 * run;
  let armL = -s * 0.5 * moving, armR = s * 0.5 * moving, armZ = 0;
  if (n.state === "react" && n.mark === "!") { armL = -2.6; armR = -2.6; armZ = 0.3; }
  else if (n.state === "chase" || n.state === "shoo") { armL = -1.2 + Math.sin(t * 14) * 0.4; armR = -1.3 - Math.sin(t * 14) * 0.4; }
  else if (n.state === "giveup") { armR = -2.7; armL = 0.1; }
  if (n.holding && n.state === "return") armR = -0.9;
  r.arms[0].rotation.x = armL;
  r.arms[1].rotation.x = armR;
  r.arms[0].rotation.z = -armZ;
  r.arms[1].rotation.z = armZ;
  r.head.rotation.y = n.state === "giveup" ? Math.sin(t * 5) * 0.3 : 0;
  for (const [k, m] of Object.entries(r.marks)) m.visible = n.mark === k;
  const wants = n.wantItem && ["search", "chase", "retrieve"].includes(n.state) ? n.wantItem : null;
  if (wants !== r.bubbleItem) {
    while (r.bubble.children.length > 1) r.bubble.remove(r.bubble.children[1]);
    if (wants) {
      const icon = new THREE.Mesh(itemGeometry(wants.split("_")[0]), (r.bubble.children[0] as THREE.Mesh).material as THREE.Material);
      const box = new THREE.Box3().setFromObject(icon);
      const size = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 0.01);
      icon.scale.setScalar(0.38 / size);
      icon.position.set(0, -0.1, 0.05);
      icon.rotation.set(0.5, 0.6, 0);
      icon.renderOrder = 2;  // marks draw without depth test, so order decides what is on top
      r.bubble.add(icon);
    }
    r.bubbleItem = wants;
  }
  r.bubble.visible = !!wants;
  r.bubble.quaternion.copy(r.root.quaternion).invert().multiply(camera.quaternion);
  r.mark.position.y = 2.25 + Math.sin(t * 6) * 0.03;
  // face the camera: world rotation = camera rotation, so remove the parent's yaw
  r.mark.quaternion.copy(r.root.quaternion).invert().multiply(camera.quaternion);
  r.mark.scale.setScalar(1.6);
}

/** Item meshes for the campus hotspot (all from primitives, palette-locked). */
export function itemGeometry(kind: string): THREE.BufferGeometry {
  const P = (g: THREE.BufferGeometry, c: string, x = 0, y = 0, z = 0, rx = 0, rz = 0) => paint(g, c, "items", x, y, z, rx, rz);
  switch (kind) {
    case "coffee": return mergeGeometries([P(new THREE.CylinderGeometry(0.045, 0.035, 0.13, 12), "cup", 0, 0.065),
      P(new THREE.CylinderGeometry(0.047, 0.043, 0.05, 12), "cup_sleeve", 0, 0.07), P(new THREE.CylinderGeometry(0.048, 0.048, 0.015, 12), "cup", 0, 0.135)]);
    case "textbook": return mergeGeometries([P(new THREE.BoxGeometry(0.22, 0.05, 0.28), "book_red", 0, 0.025), P(new THREE.BoxGeometry(0.2, 0.04, 0.27), "paper", 0.012, 0.025)]);
    case "laptop": return mergeGeometries([P(new THREE.BoxGeometry(0.33, 0.025, 0.23), "laptop", 0, 0.012), P(new THREE.BoxGeometry(0.33, 0.012, 0.23), "laptop_dark", 0, 0.03)]);
    case "cone": return mergeGeometries([P(new THREE.BoxGeometry(0.36, 0.04, 0.36), "cone", 0, 0.02), P(new THREE.ConeGeometry(0.14, 0.5, 14), "cone", 0, 0.29),
      P(new THREE.CylinderGeometry(0.075, 0.098, 0.08, 14), "cone_band", 0, 0.27)]);
    case "frisbee": return P(new THREE.CylinderGeometry(0.13, 0.12, 0.03, 18), "frisbee", 0, 0.015);
    case "hardhat": return mergeGeometries([P(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), "hardhat", 0, 0.03), P(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), "hardhat", 0, 0.03)]);
    case "watcard": return P(new THREE.BoxGeometry(0.09, 0.006, 0.055), "watcard", 0, 0.003);
    case "flag": return mergeGeometries([P(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), "pole", 0, 0.65), P(new THREE.BoxGeometry(0.01, 0.22, 0.32), "flag", 0, 1.15, 0.16)]);
    case "umbrella": return mergeGeometries([P(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6), "pole", 0, 0.03, 0, Math.PI / 2), P(new THREE.ConeGeometry(0.06, 0.5, 8), "umbrella", 0, 0.05, 0.1, Math.PI / 2)]);
    case "apple": return mergeGeometries([P(new THREE.SphereGeometry(0.045, 10, 8), "apple", 0, 0.045), P(new THREE.BoxGeometry(0.03, 0.005, 0.015), "leaf", 0.01, 0.095)]);
    case "ringbox": return P(new THREE.BoxGeometry(0.08, 0.06, 0.08), "ringbox", 0, 0.03);
    case "backpack": return mergeGeometries([P(new THREE.BoxGeometry(0.32, 0.42, 0.18), "backpack", 0, 0.21), P(new THREE.BoxGeometry(0.26, 0.18, 0.06), "backpack", 0, 0.14, 0.11)]);
    case "pizza": return mergeGeometries([P(new THREE.BoxGeometry(0.36, 0.05, 0.36), "pizza", 0, 0.025), P(new THREE.BoxGeometry(0.2, 0.006, 0.14), "pizza_lid", 0, 0.053)]);
    case "ball": return mergeGeometries([P(new THREE.SphereGeometry(0.12, 14, 10), "ball", 0, 0.12), P(new THREE.TorusGeometry(0.121, 0.006, 4, 20), "ball_line", 0, 0.12)]);
    case "bottle": return mergeGeometries([P(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), "bottle", 0, 0.1), P(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), "bottle_cap", 0, 0.215)]);
    case "hat": return mergeGeometries([P(new THREE.CylinderGeometry(0.11, 0.12, 0.1, 14), "hat", 0, 0.06), P(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16), "hat", 0, 0.01)]);
    default: return P(new THREE.BoxGeometry(0.1, 0.1, 0.1), "paper", 0, 0.05);
  }
}

/** One merged, static-pose, low-tessellation geometry of a person (for the instanced ambient crowd). */
export function personGeometry(look: PersonLook): THREE.BufferGeometry {
  const dummy = new THREE.MeshBasicNodeMaterial();
  detail = 0.5;
  const rig = makePerson(look, dummy, dummy);
  detail = 1;
  rig.root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || rig.mark.children.includes(m) || rig.bubble.children.includes(m)) return;
    parts.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
  });
  return mergeGeometries(parts);
}
