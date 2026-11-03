import * as THREE from "three/webgpu";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Physics } from "@/physics/physics";
import { type GooseRig, makeGoose, updateNeck } from "./model";

export interface GooseInput {
  move: THREE.Vector2;   // x right, y forward, in camera space, length <= 1
  run: boolean;
  crouch: boolean;
  honk: boolean;
  flap: boolean;
}

export const WALK_SPEED = 1.6;
export const RUN_SPEED = 4.2;
const CROUCH_SPEED = 0.9;
const SWIM_SPEED = 1.2;
const DRAG_FACTOR = 0.55;         // heavy items are dragged slowly, walking backward (spec G-ITEM)
const FLAP_BOOST = 1.25;
const SWIM_DEPTH = 0.36;          // body sits this far below the water surface
const LOOK_MAX = 1.1;             // radians the head can turn toward a point of attention
const CAPSULE_R = 0.24;
const CAPSULE_HALF = 0.2;

/** The player goose: Rapier kinematic character controller plus procedural animation. */
export class Goose {
  readonly rig: GooseRig;
  readonly position = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  private phase = 0;
  private vy = 0;
  private honkT = 1;
  private flapT = 0;
  private crouchK = 0;
  private idle = 0;
  private time = 0;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  grounded = true;
  onHonk?: () => void;
  /** Set each frame by the game: a nearby grabbable item (reach) or person (eye contact), in world space. */
  attention: { point: THREE.Vector3; kind: "item" | "person" } | null = null;
  /** Water surface height under the goose, or null on land. */
  waterLevel: number | null = null;
  /** Weight class of the held item; "drag" slows the goose and turns it to walk backward. */
  holding: "carry" | "drag" | null = null;
  swimming = false;
  /** in a tug-of-war: lean back with the neck stretched forward */
  tugging = false;
  private startleT = 1;
  private headYaw = 0;

  constructor(material: THREE.Material) {
    this.rig = makeGoose(material);
  }

  get attached() { return this.body !== null; }

  attach(physics: Physics, start: THREE.Vector3) {
    const R = physics.R;
    this.position.copy(start);
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(start.x, start.y + CAPSULE_R + CAPSULE_HALF, start.z));
    this.collider = physics.world.createCollider(R.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R), this.body);
    this.controller = physics.world.createCharacterController(0.03);
    this.controller.enableSnapToGround(0.4);
    this.controller.enableAutostep(0.35, 0.2, false);
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    this.controller.setSlideEnabled(true);
  }

  /** Teleport (tests, respawn). */
  place(p: THREE.Vector3) {
    this.position.copy(p);
    this.vy = 0;
    this.body?.setTranslation({ x: p.x, y: p.y + CAPSULE_R + CAPSULE_HALF, z: p.z }, true);
    this.body?.setNextKinematicTranslation({ x: p.x, y: p.y + CAPSULE_R + CAPSULE_HALF, z: p.z });
  }

  update(dt: number, input: GooseInput, cameraYaw: number) {
    this.time += dt;
    const want = input.move.length() > 0.05;
    // flapping while running gives the escape burst (doc 03 R-G1)
    this.swimming = this.waterLevel !== null && this.position.y < this.waterLevel - 0.12;
    const drag = this.holding === "drag";
    let target = input.crouch ? CROUCH_SPEED : input.run ? RUN_SPEED * (input.flap ? FLAP_BOOST : 1) : WALK_SPEED;
    if (this.swimming) target = SWIM_SPEED * (input.flap ? 1.4 : 1);
    if (drag) target = Math.min(target, WALK_SPEED) * DRAG_FACTOR;
    // slight momentum: speeding up is gentler than stopping ("1 percent QWOP")
    const accel = want ? (input.run ? 5 : 7) : 9;
    this.speed = THREE.MathUtils.damp(this.speed, want ? target * Math.min(input.move.length(), 1) : 0, accel, dt);
    let moveYaw = this.yaw + (drag ? Math.PI : 0);
    if (want) {
      // camera yaw is a compass heading; forward on screen is that heading
      const heading = cameraYaw * Math.PI / 180 + Math.atan2(input.move.x, input.move.y);
      const desiredMove = Math.PI - heading;   // goose faces +z locally; compass 0 (north) is -z
      let d = desiredMove - moveYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      // running turns wider (spec G-MOVE): a lower turn rate at speed; flapping restores control
      const rate = input.run && !input.flap ? 5 : this.swimming ? 4 : 11;
      moveYaw += d * Math.min(1, dt * rate);
      this.yaw = moveYaw - (drag ? Math.PI : 0);
    }
    const fwd = new THREE.Vector3(Math.sin(moveYaw), 0, Math.cos(moveYaw));
    this.vy = this.grounded ? -1 : this.vy - 9.81 * dt;
    const delta = fwd.multiplyScalar(this.speed * dt).setY(this.vy * dt);
    if (this.controller && this.collider && this.body) {
      this.controller.computeColliderMovement(this.collider, delta);
      const m = this.controller.computedMovement();
      this.grounded = this.controller.computedGrounded();
      const t = this.body.translation();
      const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
      this.body.setNextKinematicTranslation(next);
      this.position.set(next.x, next.y - CAPSULE_R - CAPSULE_HALF, next.z);
      this.speed = Math.min(this.speed, Math.hypot(m.x, m.z) / Math.max(dt, 1e-4) + 0.5);
    } else {
      this.position.add(delta.setY(0));
    }
    if (input.honk && this.honkT >= 1) { this.honkT = 0; this.onHonk?.(); }
    if (input.flap) this.flapT = Math.min(this.flapT + dt * 4, 1); else this.flapT = Math.max(this.flapT - dt * 3, 0);
    this.crouchK = THREE.MathUtils.damp(this.crouchK, input.crouch ? 1 : 0, 10, dt);
    this.honkT = Math.min(this.honkT + dt * 2.2, 1);
    this.startleT = Math.min(this.startleT + dt * 1.6, 1);
    this.animate(dt);
  }

  /** Caught by a character: wings rear up and the head shoots up for a moment (spec: getting caught). */
  startle() { this.startleT = 0; }

  private animate(dt: number) {
    const r = this.rig;
    r.root.position.copy(this.position);
    if (this.swimming && this.waterLevel !== null) r.root.position.y = this.waterLevel - SWIM_DEPTH;
    r.root.rotation.y = this.yaw;
    const swim = this.swimming ? 1 : 0;
    r.ripple.visible = this.swimming;
    if (this.swimming) {
      r.ripple.position.y = SWIM_DEPTH + 0.01;
      r.ripple.scale.setScalar(1 + 0.15 * Math.sin(this.time * 3) + 0.3 * Math.min(this.speed, 1));
    }
    const startle = this.startleT < 1 ? Math.sin(this.startleT * Math.PI) : 0;
    const run = THREE.MathUtils.clamp((this.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    const moving = THREE.MathUtils.clamp(this.speed / WALK_SPEED, 0, 1);
    const stride = 0.22 + 0.16 * run;
    this.phase += (this.speed * dt) / stride * Math.PI;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const crouch = this.crouchK;
    // body: waddle roll, bob twice per stride, lean forward when running, sink when crouching
    r.body.position.y = -0.1 * crouch + Math.abs(s) * 0.018 * moving * (1 - swim) + Math.sin(this.time * 2.1) * 0.004 * (1 - moving)
      + swim * Math.sin(this.time * 1.7) * 0.012;
    r.body.rotation.z = s * 0.09 * moving * (1 - 0.5 * run) * (1 - swim);
    r.body.rotation.x = 0.16 * run * (1 - swim) + 0.12 * crouch - 0.08 * swim - 0.25 * startle - (this.tugging ? 0.3 + 0.08 * Math.sin(this.time * 22) : 0);
    // legs: alternate swing with foot lift; feet stay flat
    for (let k = 0; k < 2; k++) {
      const ph = this.phase + k * Math.PI;
      const swing = Math.sin(ph) * stride * 0.5 * moving;
      const lift = Math.max(0, Math.cos(ph)) * 0.06 * moving;
      const leg = r.legs[k];
      const hipY = 0.27 - 0.1 * crouch + r.body.position.y;
      const footZ = 0.02 + swing, footY = lift;
      leg.position.y = hipY;
      leg.rotation.x = Math.atan2(footZ - 0.02, hipY - footY) * -1;
      leg.scale.y = Math.hypot(footZ - 0.02, hipY - footY) / 0.26;
      r.feet[k].position.set(leg.position.x, footY, footZ);
      // swimming: legs fold under the body and paddle slowly, hidden by the water line
      leg.visible = r.feet[k].visible = !this.swimming;
    }
    // wings: tucked, a little open when running, full flap on demand
    const flap = this.flapT;
    const beat = Math.sin(this.time * 18) * 0.5 + 0.5;
    r.wings.forEach((w, k) => {
      const sgn = k === 0 ? -1 : 1;
      w.rotation.z = sgn * (0.08 * run + flap * (0.6 + 0.9 * beat) + startle * 1.3);
      w.rotation.y = sgn * (flap * 0.4 + startle * 0.3);
    });
    // neck and head: S-curve; forward and low when running or crouching; honk thrusts forward
    const honk = Math.sin(Math.min(this.honkT, 1) * Math.PI);
    const look = Math.sin(this.time * 0.7) * 0.25 * (1 - moving);
    const bob = Math.sin(this.phase * 2) * 0.02 * moving;
    // idle grazing: every few seconds of standing still, a quick dip to peck at the grass
    this.idle = moving > 0.1 ? 0 : this.idle + dt;
    const pc = (this.idle % 5.5) - 3.5;
    const peck = pc > 0 && pc < 1.2 ? Math.sin((pc / 1.2) * Math.PI) * (0.7 + 0.3 * Math.sin(pc * 25)) : 0;
    // attention: the head turns toward a nearby person (eye contact) or a grabbable item, and the
    // neck reaches toward the item with the beak slightly open (spec G-ANIM reach cue)
    let lookYaw = look, reach = 0, reachLow = 0;
    if (this.attention) {
      const local = r.root.worldToLocal(this.attention.point.clone());
      lookYaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -LOOK_MAX, LOOK_MAX);
      if (this.attention.kind === "item") {
        const d = Math.hypot(local.x, local.z);
        reach = THREE.MathUtils.clamp(1 - (d - 0.4) / 0.9, 0, 1);
        reachLow = reach * THREE.MathUtils.clamp(0.8 - local.y, 0, 1);
      }
    }
    this.headYaw = THREE.MathUtils.damp(this.headYaw, lookYaw, 6, dt);
    const low = Math.max(run * 0.6, crouch, peck * 1.25, reachLow * 0.9) * (1 - startle);
    const base = new THREE.Vector3(0, 0.52, 0.24);
    const hy = this.headYaw;
    const head = new THREE.Vector3(Math.sin(hy) * (0.14 + 0.1 * reach),
      0.86 - 0.32 * low + 0.04 * honk + 0.12 * startle,
      0.33 + 0.22 * low + 0.12 * honk + 0.1 * reach + bob - 0.05 * startle);
    const ctrl = new THREE.Vector3(Math.sin(hy) * 0.05, 0.62 + 0.15 * (1 - low), 0.42 - 0.12 * (1 - low));
    updateNeck(r.neck.geometry, base, ctrl, head);
    r.head.position.copy(head);
    r.head.rotation.set(0.15 * low - 0.25 * honk - 0.3 * startle, hy, 0);
    r.lowerBill.rotation.x = Math.max(0.45 * honk, 0.18 * reach, 0.4 * startle);
    r.honkLines.visible = this.honkT < 0.6;
    r.honkLines.scale.setScalar(1 + this.honkT * 1.5);
  }
}
