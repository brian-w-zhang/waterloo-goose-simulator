import * as THREE from "three/webgpu";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { applyMaterial, loadModel } from "@/render/models";

/**
 * The Blender goose (art/models/goose.py -> public/models/goose.glb): one skinned mesh, 22 bones and the
 * actions idle, walk, run, crouch, honk, flap, glide, swim. Two blend groups share the mixer:
 *   body: everything but the wings (idle / walk / run / crouch / swim / air pose of flap and glide)
 *   wings: the wing bones only (folded from idle or run, flap, glide), so a goose can flap while it walks.
 * Honk is an additive neck/head/jaw layer. Walk, run and crouch are scrubbed by the controller's stride
 * phase (feet stay planted at any speed); the rest play in time.
 */
export type BodyClip = "idle" | "walk" | "run" | "crouch" | "swim" | "flap" | "glide";
export type WingClip = "fold" | "run" | "flap" | "glide";
const BODY: BodyClip[] = ["idle", "walk", "run", "crouch", "swim", "flap", "glide"];
const WINGS: WingClip[] = ["fold", "run", "flap", "glide"];
const PHASED = new Set<BodyClip>(["walk", "run", "crouch"]);
const HONK_BONES = new Set(["neck1", "neck2", "neck3", "neck4", "head", "jaw"]);

const boneOf = (track: THREE.KeyframeTrack) => track.name.slice(0, track.name.lastIndexOf("."));
const isWing = (track: THREE.KeyframeTrack) => boneOf(track).startsWith("wing_");

function subClip(clip: THREE.AnimationClip, name: string, keep: (t: THREE.KeyframeTrack) => boolean) {
  return new THREE.AnimationClip(name, clip.duration, clip.tracks.filter(keep).map((t) => t.clone()));
}

export class SkinnedGoose {
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly bones: Record<string, THREE.Bone> = {};
  readonly body = {} as Record<BodyClip, THREE.AnimationAction>;
  readonly wings = {} as Record<WingClip, THREE.AnimationAction>;
  readonly honk: THREE.AnimationAction;
  /** local transform (relative to the head bone) that puts a child at the head centre with goose-space axes */
  readonly headAnchor: THREE.Matrix4;
  readonly billAnchor: THREE.Object3D;

  constructor(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, material: THREE.Material) {
    this.model = cloneSkinned(gltf.scene);
    this.model.name = "goose_skinned";
    applyMaterial(this.model, material);
    this.model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o as THREE.Bone;
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.frustumCulled = false;   // bind-pose bounds miss the open wings
    });
    for (const n of ["head", "jaw", "neck1", "body", "hips"]) if (!this.bones[n]) throw new Error(`goose.glb: no bone ${n}`);
    // anchors, measured in the rest pose with the model at the origin (goose space: +z forward, +y up, feet at 0)
    this.model.updateMatrixWorld(true);
    const local = (bone: THREE.Bone, p: THREE.Vector3) =>
      bone.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    this.headAnchor = local(this.bones.head, new THREE.Vector3(0, 0.897, 0.355));
    this.billAnchor = new THREE.Object3D();
    this.billAnchor.name = "goose_bill_socket";
    this.bones.jaw.add(this.billAnchor);
    local(this.bones.jaw, new THREE.Vector3(0, 0.868, 0.45)).decompose(this.billAnchor.position, this.billAnchor.quaternion, this.billAnchor.scale);

    this.mixer = new THREE.AnimationMixer(this.model);
    const clip = (n: string) => {
      const c = THREE.AnimationClip.findByName(gltf.animations, n);
      if (!c) throw new Error(`goose.glb: no action ${n}`);
      return c;
    };
    for (const n of BODY) {
      const a = this.mixer.clipAction(subClip(clip(n), `body_${n}`, (t) => !isWing(t)));
      if (PHASED.has(n)) a.timeScale = 0;
      a.play().setEffectiveWeight(n === "idle" ? 1 : 0);
      this.body[n] = a;
    }
    for (const n of WINGS) {
      const a = this.mixer.clipAction(subClip(clip(n === "fold" ? "idle" : n), `wings_${n}`, isWing));
      if (n === "fold" || n === "run") a.timeScale = 0;   // a still folded pose (run's wings sit a touch looser)
      a.play().setEffectiveWeight(n === "fold" ? 1 : 0);
      this.wings[n] = a;
    }
    const honk = subClip(clip("honk"), "honk_add", (t) => HONK_BONES.has(boneOf(t)));
    THREE.AnimationUtils.makeClipAdditive(honk);
    this.honk = this.mixer.clipAction(honk);
    this.honk.setLoop(THREE.LoopOnce, 1);
    this.honk.clampWhenFinished = false;
  }

  static async load(material: THREE.Material) {
    return new SkinnedGoose(await loadModel("goose"), material);
  }

  /** Normalised weights per group; walk/run/crouch scrubbed to `phase01` of their cycle. */
  pose(dt: number, body: Partial<Record<BodyClip, number>>, wings: Partial<Record<WingClip, number>>, phase01: number) {
    const norm = <K extends string>(w: Partial<Record<K, number>>, keys: K[], fallback: K) => {
      const sum = keys.reduce((s, k) => s + Math.max(0, w[k] ?? 0), 0);
      return (k: K) => (sum > 1e-4 ? Math.max(0, w[k] ?? 0) / sum : k === fallback ? 1 : 0);
    };
    const bw = norm(body, BODY, "idle");
    for (const n of BODY) {
      const a = this.body[n];
      a.setEffectiveWeight(bw(n));
      if (PHASED.has(n)) a.time = phase01 * a.getClip().duration;
    }
    const ww = norm(wings, WINGS, "fold");
    for (const n of WINGS) this.wings[n].setEffectiveWeight(ww(n));
    this.wings.run.time = 0;
    this.mixer.update(dt);
    this.model.updateMatrixWorld(true);
  }

  playHonk() {
    this.honk.reset().play();
  }

  private readonly qa = new THREE.Quaternion();
  private readonly qp = new THREE.Quaternion();
  private readonly qb = new THREE.Quaternion();
  private readonly qr = new THREE.Quaternion();
  private readonly ax = new THREE.Vector3();

  /** Rotate a bone about its own pivot by `angle` around `axis` given in goose space (procedural layer). */
  turn(name: string, axis: THREE.Vector3, angle: number) {
    const b = this.bones[name];
    if (!b || !b.parent || Math.abs(angle) < 1e-5) return;
    this.model.getWorldQuaternion(this.qr);
    this.ax.copy(axis).applyQuaternion(this.qr);
    this.qa.setFromAxisAngle(this.ax, angle);
    b.parent.getWorldQuaternion(this.qp);
    b.getWorldQuaternion(this.qb);
    b.quaternion.copy(this.qp.invert().multiply(this.qa).multiply(this.qb));
    b.updateMatrixWorld(true);
  }
}
