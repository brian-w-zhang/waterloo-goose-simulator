import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { swatch } from "@/config";
import { loadModel } from "@/render/models";
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


/**
 * People (spec V-ART-1/2): faceless miniature villagers modelled in Blender (art/models/people.py ->
 * public/models/person_<body>.glb). Every body shares one 17-bone skeleton and one set of clips;
 * faces carry a clothing slot in uv.x, so a body is recoloured per character (or per crowd
 * instance, see ambient.ts) from palette swatches.
 */
export const BODIES = ["hoodie", "backpack", "dress", "puffer", "tee", "coat", "worker", "apron"] as const;
export type Body = (typeof BODIES)[number];
export type HairStyle = "short" | "long" | "bun" | "ponytail" | "curly" | "buzz" | "bald";
export type HatKind = "hardhat" | "toque" | "cap" | "brim";

export interface PersonLook {
  skin: string; hair: string; top: string; bottom: string;
  /** a hat colour, or "hardhat" */
  hat?: string;
  style?: HairStyle;
  /** a jacket, coat, vest or apron colour over the top */
  over?: string;
  build?: "slim" | "stout";
  /** body model; chosen from the look when absent */
  body?: Body;
  hatKind?: HatKind;
  /** backpack, bag or scarf colour */
  acc?: string;
}

/** Clothing slots in the models (uv.x = (slot + 0.5) / 16); slot 8 keeps its baked colour. */
export const SLOT = { skin: 0, hair: 1, top: 2, bottom: 3, over: 4, shoes: 5, acc: 6, hat: 7, fixed: 8 } as const;

/** Stride (m per walk or run cycle at clip speed) of the generated cycles in people.py. */
export const WALK_STRIDE = 0.95;
export const RUN_STRIDE = 1.6;

export function bodyFor(look: PersonLook): Body {
  if (look.body) return look.body;
  if (look.over === "hivis") return "worker";
  if (look.over && look.build === "stout") return look.style === "bald" ? "coat" : "apron";
  if (look.style === "long" || look.style === "bun") return "dress";
  return "hoodie";
}

/** Palette swatch names for the nine slots of a body. */
export function slotSwatches(look: PersonLook, body: Body): string[] {
  const jacket = body === "backpack" || body === "coat";
  const over = look.over ?? (jacket ? look.top : body === "worker" ? "hivis" : body === "apron" ? "cloth_white" : look.top);
  const top = jacket && !look.over ? "cloth_cream" : look.top;
  const hat = look.hat && look.hat !== "hardhat" ? look.hat : "cloth_red";
  const acc = look.acc ?? (body === "coat" ? "cloth_maroon" : "bag_black");
  return [look.skin, look.hair, top, look.bottom, over, "shoes", acc, hat];
}

const LOWER = new Set(["hips", "thighL", "shinL", "footL", "thighR", "shinR", "footR"]);
/** clips whose time follows the simulation (one-shots), not a loop clock */
const ONE_SHOT = new Set(["startle", "shrug", "dress", "fall"]);

export interface PersonModel {
  gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  /** clips split into the legs-and-hips layer and the upper-body layer (scale tracks dropped) */
  lower: Map<string, THREE.AnimationClip>;
  upper: Map<string, THREE.AnimationClip>;
  full: Map<string, THREE.AnimationClip>;
}

const models = new Map<Body, PersonModel>();
let loading: Promise<void> | null = null;

/** Load every body model once (call before makePerson). */
export function preloadPeople(): Promise<void> {
  loading ??= Promise.all(BODIES.map(async (b) => {
    let gltf;
    try { gltf = await loadModel(`person_${b}`); } catch (e) {
      // a missing model must never stop the game: people of that body fall back to another one
      console.warn(`[wgs] person model ${b} failed to load (${(e as Error).message}); using another body`);
      return;
    }
    const lower = new Map<string, THREE.AnimationClip>(), upper = new Map<string, THREE.AnimationClip>();
    const full = new Map<string, THREE.AnimationClip>();
    for (const c of gltf.animations) {
      const tracks = c.tracks.filter((t) => !t.name.endsWith(".scale"));
      const bone = (t: THREE.KeyframeTrack) => t.name.slice(0, t.name.lastIndexOf("."));
      full.set(c.name, new THREE.AnimationClip(c.name, c.duration, tracks));
      lower.set(c.name, new THREE.AnimationClip(`${c.name}_lower`, c.duration, tracks.filter((t) => LOWER.has(bone(t)))));
      upper.set(c.name, new THREE.AnimationClip(`${c.name}_upper`, c.duration, tracks.filter((t) => !LOWER.has(bone(t)))));
    }
    models.set(b, { gltf, lower, upper, full });
  })).then(() => undefined);
  return loading;
}

/** The loaded model for a body (or any loaded body standing in for it), or null before loading. */
export function personModel(b: Body): PersonModel | null {
  return models.get(b) ?? models.values().next().value ?? null;
}

/** A copy of a model geometry with its slot faces painted in `swatches` (fixed faces keep theirs). */
const recoloured = new Map<string, THREE.BufferGeometry>();
export function recolour(src: THREE.BufferGeometry, swatches: string[], key: string): THREE.BufferGeometry {
  const hit = recoloured.get(key);
  if (hit) return hit;
  const g = src.clone();
  const uv = g.getAttribute("uv"), col = g.getAttribute("color");
  const cols = swatches.map((s) => swatch(s, "people"));
  const out = new Float32Array(uv.count * 4);
  for (let i = 0; i < uv.count; i++) {
    const slot = Math.floor(uv.getX(i) * 16);
    if (slot < SLOT.fixed) { const c = cols[slot]; out.set([c.r, c.g, c.b, 1], i * 4); }
    else out.set([col.getX(i), col.getY(i), col.getZ(i), 1], i * 4);
  }
  g.setAttribute("color", new THREE.BufferAttribute(out, 4));
  recoloured.set(key, g);
  return g;
}

/** The skinned model of a person and its animation state. */
export interface Figure {
  /** the skinned model (feet at the origin, facing +z) */
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  lower: Map<string, THREE.AnimationAction>;
  upper: Map<string, THREE.AnimationAction>;
  weights: { lower: Map<string, number>; upper: Map<string, number> };
  clock: Map<string, number>;
  head: THREE.Object3D;
  neck: THREE.Object3D;
  palmR: THREE.Object3D;
  palmL: THREE.Object3D;
}

export interface PersonRig {
  root: THREE.Group;
  /** null until the models have loaded (the person is then invisible but simulated as usual) */
  fig: Figure | null;
  /** where a carried item sits (the right palm, or between both palms for a two-handed carry) */
  hand: THREE.Object3D;
  mark: THREE.Group;
  marks: Record<"?" | "!" | "swirl", THREE.Mesh>;
  bubble: THREE.Group;
  bubbleItem: string | null;
  /** locomotion cycle phase (0..1) and smoothed ground speed */
  phase: number;
  speed: number;
  look: { yaw: number; pitch: number };
  seed: number;
}

/** Debug (window.__people): every person made, and their posed size in metres. */
const debugRigs: PersonRig[] = [];
(globalThis as { __people?: unknown }).__people = {
  rigs: debugRigs,
  size: (i: number) => {
    const f = debugRigs[i]?.fig;
    if (!f) return null;
    const b = new THREE.Box3().setFromObject(f.model, true);
    return { min: b.min.toArray(), max: b.max.toArray(), root: debugRigs[i].root.position.toArray() };
  },
};

/** A villager: the body model for `look`, recoloured, with an animation mixer. */
function makeFigure(look: PersonLook, material: THREE.Material): Figure | null {
  const body = bodyFor(look);
  const pm = personModel(body);
  if (!pm) return null;
  const model = cloneSkinned(pm.gltf.scene);
  const sw = slotSwatches(look, body);
  const hatKind: HatKind | null = look.hatKind ?? (look.hat === "hardhat" ? "hardhat" : look.hat ? "brim" : null);
  const keep = new Set(["body", `hair_${look.style ?? "short"}`, ...(hatKind ? [`hat_${hatKind}`] : [])]);
  const drop: THREE.Object3D[] = [];
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    if (!keep.has(m.name)) { drop.push(m); return; }
    m.geometry = recolour(m.geometry, sw, `${body}|${m.name}|${sw.join(",")}`);
    m.material = material;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;   // skinned bounds do not follow the pose
  });
  for (const m of drop) m.removeFromParent();
  const head = model.getObjectByName("head"), neck = model.getObjectByName("neck");
  const handR = model.getObjectByName("handR"), handL = model.getObjectByName("handL");
  if (!head || !neck || !handR || !handL) {
    console.warn(`[wgs] person model ${body} is missing bones; person not drawn`);
    return null;
  }
  const palm = (b: THREE.Object3D) => { const o = new THREE.Object3D(); o.position.set(0, 0.07, 0); b.add(o); return o; };
  const mixer = new THREE.AnimationMixer(model);
  const actions = (clips: Map<string, THREE.AnimationClip>) => {
    const out = new Map<string, THREE.AnimationAction>();
    for (const [name, clip] of clips) {
      const a = mixer.clipAction(clip);
      a.timeScale = 0;   // times are set by hand every frame
      out.set(name, a);
    }
    return out;
  };
  return { model, mixer, lower: actions(pm.lower), upper: actions(pm.upper), weights: { lower: new Map(), upper: new Map() },
    clock: new Map(), head, neck, palmR: palm(handR), palmL: palm(handL) };
}

/** A villager: the body model for `look`, recoloured, with an animation mixer. Never throws: before
 * the models load (or if they fail) the person is simulated but not drawn. */
export function makePerson(look: PersonLook, material: THREE.Material, markMaterial: THREE.Material, seed = 0): PersonRig {
  const root = new THREE.Group();
  const hand = new THREE.Object3D();
  hand.position.set(0, 1.0, 0.3);
  root.add(hand);
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
  const rig: PersonRig = { root, fig: null, hand, mark, marks, bubble, bubbleItem: null,
    phase: 0, speed: 0, look: { yaw: 0, pitch: 0 }, seed };
  const attach = () => {
    rig.fig = makeFigure(look, material);
    if (rig.fig) root.add(rig.fig.model);
  };
  if (models.size) attach();
  else void preloadPeople().then(attach);
  debugRigs.push(rig);
  return rig;
}

/** Two-handed carries; everything else is held in the right hand at the chest. */
const BIG = new Set(["basket", "pizza", "laptop", "textbook", "ball", "backpack", "cone"]);

/** What the upper body (and, for full-body moves, the legs) should play for this simulation state. */
function chooseClips(r: PersonRig, n: Npc, simT: number): { upper: string | null; lower: string | null; time?: number } {
  if (n.state === "fallen") return { upper: "fall", lower: "fall", time: n.stateTime };
  if (n.state === "tug") return { upper: "tug", lower: "tug" };
  if (n.gesture === "dress") return { upper: "dress", lower: "dress", time: simT - n.gestureTime };
  if (n.state === "react") return { upper: n.mark === "!" ? "startle" : "shrug", lower: null, time: n.stateTime };
  if (n.state === "giveup") return { upper: "scratch", lower: null };
  if (n.gesture === "shake") return { upper: "headshake", lower: null };
  if (n.gesture === "clap") return { upper: "clap", lower: null };
  if (n.state === "shoo") return { upper: r.speed > 0.4 ? "shoo" : "fist", lower: null };
  if (n.holding) return { upper: BIG.has(n.holding.split("_")[0]) ? "carry" : "hold", lower: null };
  if (r.speed < 0.25 && (n.state === "search" || n.state === "investigate" || n.state === "retrieve")) return { upper: "look", lower: null };
  if (r.speed < 0.25 && n.state === "routine") {
    // idle variety while waiting at a waypoint: now and then a chat or a glance about
    const beat = Math.floor((simT + r.seed * 3.7) / 7);
    const pick = (beat * 2654435761 + r.seed * 97) % 5;
    if (pick === 1) return { upper: "talk", lower: null };
    if (pick === 3) return { upper: "look", lower: null };
  }
  return { upper: null, lower: null };
}

const FADE = 6;   // weight per second: a 0.17 s cross-fade
const LOCO = new Set(["idle", "walk", "run"]);
function blendLayer(r: Figure, layer: "lower" | "upper", target: Map<string, number>, dt: number) {
  const acts = r[layer], w = r.weights[layer];
  // between idle, walk and run the weights follow the (smoothed) speed directly; anything else fades
  const direct = [...target.keys()].every((k) => LOCO.has(k)) && [...w].every(([k, x]) => LOCO.has(k) || x < 1e-3);
  for (const [name, action] of acts) {
    const goal = target.get(name) ?? 0;
    let cur = w.get(name) ?? 0;
    if (direct && LOCO.has(name)) cur = goal;
    else cur = goal > cur ? Math.min(goal, cur + dt * FADE) : Math.max(goal, cur - dt * FADE);
    w.set(name, cur);
    if (cur > 1e-3) {
      if (!action.isScheduled()) action.play();
      action.setEffectiveWeight(cur);
    } else if (action.isScheduled()) action.stop();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

/** Turn a bone by `angle` about a world axis (applied on top of the animated pose). */
function turnBone(b: THREE.Object3D, axisWorld: THREE.Vector3, angle: number) {
  if (Math.abs(angle) < 1e-4) return;
  b.parent!.getWorldQuaternion(_q).invert();
  _v.copy(axisWorld).applyQuaternion(_q).normalize();
  b.quaternion.premultiply(_q2.setFromAxisAngle(_v, angle));
}

/**
 * Pose the person from the simulation state: legs walk or run at a cycle rate matched to the
 * ground speed (the clips' feet are planted, so nothing slides), the upper body plays the state's
 * gesture, and the head turns to the goose.
 */
export function animatePerson(r: PersonRig, n: Npc, speed: number, dt: number, t: number, camera: THREE.Camera,
  goose?: THREE.Vector3, simT = t) {
  r.speed = THREE.MathUtils.damp(r.speed, speed, 10, dt);
  const v = r.speed;
  const run = THREE.MathUtils.smoothstep(v, 1.6, 2.8);
  const moving = THREE.MathUtils.smoothstep(v, 0.08, 0.35);
  const stride = THREE.MathUtils.lerp(WALK_STRIDE, RUN_STRIDE, run);
  r.phase = (r.phase + dt * v / stride) % 1;
  const f = r.fig;
  if (f) try {
    const pick = chooseClips(r, n, simT);
    const loco = new Map([["idle", 1 - moving], ["walk", moving * (1 - run)], ["run", moving * run]]);
    blendLayer(f, "lower", pick.lower ? new Map([[pick.lower, 1]]) : loco, dt);
    blendLayer(f, "upper", pick.upper ? new Map([[pick.upper, 1]]) : loco, dt);
    for (const layer of [f.lower, f.upper]) {
      for (const [name, a] of layer) {
        if (!a.isScheduled()) continue;
        const dur = a.getClip().duration;
        if (name === "walk" || name === "run") a.time = r.phase * dur;
        else if (ONE_SHOT.has(name) && pick.time !== undefined && (name === pick.upper || name === pick.lower)) a.time = Math.min(Math.max(pick.time, 0), dur);
        else a.time = (f.clock.get(name) ?? 0) % dur;
      }
    }
    for (const name of f.upper.keys()) if (!ONE_SHOT.has(name)) f.clock.set(name, (f.clock.get(name) ?? 0) + dt);
    // every bone is rewritten from the clips here, so the look-at below never accumulates
    f.mixer.update(0);
    r.root.updateMatrixWorld(true);
    // eye contact (spec V-ANIM-9): when the goose is close, or they have noticed it, the head turns
    // to it, limited to what a neck can do (70 degrees each way, 25 up or down) and never round
    // behind them
    let yaw = 0, pitch = 0;
    const busy = n.state === "giveup" || n.state === "fallen" || n.state === "tug" || n.gesture === "shake" || n.gesture === "dress";
    if (goose && !busy) {
      const local = r.root.worldToLocal(_v2.copy(goose));
      const d = Math.hypot(local.x, local.z);
      const bearing = Math.atan2(local.x, local.z);
      const noticed = n.state !== "routine" || !!n.mark || d < 3.5;
      if (d < 7 && noticed && Math.abs(bearing) < 2.0) {
        yaw = THREE.MathUtils.clamp(bearing, -1.2, 1.2);
        pitch = THREE.MathUtils.clamp(Math.atan2(local.y - 1.55, Math.max(d, 0.5)), -0.44, 0.2);
      }
    }
    r.look.yaw = THREE.MathUtils.damp(r.look.yaw, yaw, 5, dt);
    r.look.pitch = THREE.MathUtils.damp(r.look.pitch, pitch, 5, dt);
    r.root.getWorldQuaternion(_q2);
    const left = _v3.set(1, 0, 0).applyQuaternion(_q2);
    turnBone(f.neck, UP, r.look.yaw * 0.4);
    f.neck.updateMatrixWorld(true);
    turnBone(f.head, UP, r.look.yaw * 0.6);
    // +x is the person's left; a positive turn about it tips the face down
    turnBone(f.head, left, -r.look.pitch);
    f.head.updateMatrixWorld(true);
    // carried item anchor
    const two = n.holding && BIG.has(n.holding.split("_")[0]);
    f.palmR.getWorldPosition(_v);
    if (two) _v.add(f.palmL.getWorldPosition(_v2)).multiplyScalar(0.5);
    r.hand.position.copy(r.root.worldToLocal(_v));
    if (two) r.hand.position.y -= 0.12;   // the hands hold it from below
  } catch (e) {
    // never break the frame loop: drop the figure (the person stays simulated, just not drawn)
    console.warn(`[wgs] person ${n.id} animation failed: ${(e as Error).message}`);
    f.model.removeFromParent();
    r.fig = null;
  }
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
    case "basket": return mergeGeometries([P(new THREE.BoxGeometry(0.5, 0.28, 0.36), "basket", 0, 0.14), P(new THREE.BoxGeometry(0.44, 0.06, 0.3), "laundry", 0, 0.3)]);
    case "sock": return mergeGeometries([P(new THREE.BoxGeometry(0.06, 0.03, 0.2), "sock", 0, 0.015), P(new THREE.BoxGeometry(0.06, 0.03, 0.08), "sock", 0.04, 0.015, -0.08)]);
    default: return P(new THREE.BoxGeometry(0.1, 0.1, 0.1), "paper", 0, 0.05);
  }
}
