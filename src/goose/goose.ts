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
  private time = 0;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  grounded = true;
  onHonk?: () => void;

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
    const target = input.crouch ? CROUCH_SPEED : input.run ? RUN_SPEED : WALK_SPEED;
    this.speed = THREE.MathUtils.damp(this.speed, want ? target * Math.min(input.move.length(), 1) : 0, 10, dt);
    if (want) {
      // camera yaw is a compass heading; forward on screen is that heading
      const heading = cameraYaw * Math.PI / 180 + Math.atan2(input.move.x, input.move.y);
      const desiredYaw = Math.PI - heading;   // goose faces +z locally; compass 0 (north) is -z
      let d = desiredYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
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
    this.animate(dt);
  }

  private animate(dt: number) {
    const r = this.rig;
    r.root.position.copy(this.position);
    r.root.rotation.y = this.yaw;
    const run = THREE.MathUtils.clamp((this.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    const moving = THREE.MathUtils.clamp(this.speed / WALK_SPEED, 0, 1);
    const stride = 0.22 + 0.16 * run;
    this.phase += (this.speed * dt) / stride * Math.PI;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const crouch = this.crouchK;
    // body: waddle roll, bob twice per stride, lean forward when running, sink when crouching
    r.body.position.y = -0.1 * crouch + Math.abs(s) * 0.018 * moving + Math.sin(this.time * 2.1) * 0.004 * (1 - moving);
    r.body.rotation.z = s * 0.09 * moving * (1 - 0.5 * run);
    r.body.rotation.x = 0.16 * run + 0.12 * crouch;
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
    }
    // wings: tucked, a little open when running, full flap on demand
    const flap = this.flapT;
    const beat = Math.sin(this.time * 18) * 0.5 + 0.5;
    r.wings.forEach((w, k) => {
      const sgn = k === 0 ? -1 : 1;
      w.rotation.z = sgn * (0.08 * run + flap * (0.6 + 0.9 * beat));
      w.rotation.y = sgn * flap * 0.4;
    });
    // neck and head: S-curve; forward and low when running or crouching; honk thrusts forward
    const honk = Math.sin(Math.min(this.honkT, 1) * Math.PI);
    const look = Math.sin(this.time * 0.7) * 0.25 * (1 - moving);
    const bob = Math.sin(this.phase * 2) * 0.02 * moving;
    const low = Math.max(run * 0.6, crouch);
    const base = new THREE.Vector3(0, 0.52, 0.24);
    const head = new THREE.Vector3(look * 0.12, 0.86 - 0.32 * low + 0.04 * honk, 0.33 + 0.22 * low + 0.12 * honk + bob);
    const ctrl = new THREE.Vector3(look * 0.05, 0.62 + 0.15 * (1 - low), 0.42 - 0.12 * (1 - low));
    updateNeck(r.neck.geometry, base, ctrl, head);
    r.head.position.copy(head);
    r.head.rotation.set(0.15 * low - 0.25 * honk, look, 0);
    r.lowerBill.rotation.x = 0.45 * honk;
  }
}
