import * as THREE from "three/webgpu";
import type RAPIER from "@dimforge/rapier3d-compat";
import { GROUP_GOOSE, type Physics } from "@/physics/physics";
import { type GooseRig, makeGoose, updateNeck } from "./model";
import { SkinnedGoose } from "./skinned";

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

// flight: a tap of flap is a hop; holding it climbs while stamina lasts, then the goose glides down
export const FLIGHT = {
  hop: 1.9,            // m/s up on a flap press from the ground (about 0.18 m)
  hold: 0.16,          // s of holding before the hop turns into a climb
  climb: 2.3,          // m/s climb rate while flapping
  ceiling: 3.6,        // m above the take-off ground
  stamina: 2.6,        // s of climbing flight
  regen: 0.9,          // stamina per second on the ground
  glideSink: 0.75,     // m/s descent while gliding with flap held
  fallMax: 3.2,        // m/s descent with flap released
  landSink: 1.1,       // m/s cap close to the ground: a soft landing
  speed: 3.4,          // m/s airspeed at full stick (more when running)
};
export type FlightMode = "ground" | "flap" | "glide";

/** The player goose: Rapier kinematic character controller plus animation (skinned glb, or the procedural fallback). */
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
  private physics: Physics | null = null;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  grounded = true;
  onHonk?: () => void;
  onStep?: (water: boolean) => void;
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
  // flight state
  airborne = false;
  flight: FlightMode = "ground";
  stamina = FLIGHT.stamina;
  /** height above the ground (or water) under the goose; 0 when standing */
  altitude = 0;
  private launchY = 0;
  private flapHeld = 0;
  private prevFlap = false;
  private floorY = 0;              // ground height when no physics is attached (unit tests)
  private visY = NaN;              // smoothed visual height (water entry/exit, take-off from water)
  private airK = 0;                // 0 on the ground .. 1 flying (animation blend)
  private glideK = 0;
  private skinned: SkinnedGoose | null = null;
  /** resolves once the glb goose is in place (or the procedural fallback is kept) */
  readonly ready: Promise<"glb" | "procedural">;

  constructor(material: THREE.Material, opts: { loadModel?: boolean } = {}) {
    this.rig = makeGoose(material);
    this.ready = opts.loadModel === false ? Promise.resolve("procedural") : SkinnedGoose.load(material).then(
      (sk) => { this.useSkinned(sk); return "glb" as const; },
      (e: Error) => { console.warn(`[goose] ${e.message}; keeping the procedural goose`); return "procedural" as const; });
  }

  get attached() { return this.body !== null; }
  get model(): "glb" | "procedural" { return this.skinned ? "glb" : "procedural"; }

  private useSkinned(sk: SkinnedGoose) {
    const r = this.rig;
    this.skinned = sk;
    r.body.visible = false;
    for (const o of [...r.legs, ...r.feet]) o.visible = false;
    // the head group carries worn items and the honk strokes: move it onto the head bone, hide its old meshes
    for (const c of r.head.children) if (c.userData.procedural) c.visible = false;
    sk.bones.head.add(r.head);
    sk.headAnchor.decompose(r.head.position, r.head.quaternion, r.head.scale);
    r.head.rotation.setFromQuaternion(r.head.quaternion);
    r.lowerBill = sk.billAnchor;
    r.root.add(sk.model);
    sk.model.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  attach(physics: Physics, start: THREE.Vector3) {
    const R = physics.R;
    this.physics = physics;
    this.position.copy(start);
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(start.x, start.y + CAPSULE_R + CAPSULE_HALF, start.z));
    this.collider = physics.world.createCollider(R.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R)
      .setCollisionGroups(GROUP_GOOSE), this.body);
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
    this.floorY = p.y;
    this.visY = NaN;
    this.airborne = false;
    this.flight = "ground";
    this.stamina = FLIGHT.stamina;
    this.body?.setTranslation({ x: p.x, y: p.y + CAPSULE_R + CAPSULE_HALF, z: p.z }, true);
    this.body?.setNextKinematicTranslation({ x: p.x, y: p.y + CAPSULE_R + CAPSULE_HALF, z: p.z });
  }

  /** Height of the goose's feet above whatever is under it (ground, roof, item, water surface). */
  private measureAltitude(): number {
    let ground = this.floorY;
    if (this.physics && this.collider) {
      const R = this.physics.R;
      const from = { x: this.position.x, y: this.position.y + 0.1, z: this.position.z };
      const hit = this.physics.world.castRay(new R.Ray(from, { x: 0, y: -1, z: 0 }), 50, true,
        undefined, undefined, this.collider);
      ground = hit ? from.y - hit.timeOfImpact : -Infinity;
    }
    if (this.waterLevel !== null) ground = Math.max(ground, this.waterLevel - 0.12);
    return Math.max(0, this.position.y - ground);
  }

  update(dt: number, input: GooseInput, cameraYaw: number) {
    this.time += dt;
    const want = input.move.length() > 0.05;
    this.swimming = !this.airborne && this.waterLevel !== null && this.position.y < this.waterLevel - 0.12;
    const drag = this.holding === "drag";
    // ---- flight: hop on a press, climb while held (stamina), glide when tired, fall faster when released
    const pressed = input.flap && !this.prevFlap;
    this.prevFlap = input.flap;
    this.flapHeld = input.flap ? this.flapHeld + dt : 0;
    if (pressed && !this.airborne && !drag && !this.tugging) {
      if (this.swimming && this.waterLevel !== null && this.body) {
        // the physics body walks the lake bed: lift it to the surface so the take-off starts from the water
        const t = this.body.translation();
        const y = this.waterLevel - 0.1 + CAPSULE_R + CAPSULE_HALF;
        if (t.y < y) { this.body.setTranslation({ x: t.x, y, z: t.z }, true); this.position.y = this.waterLevel - 0.1; }
        this.swimming = false;
      }
      this.vy = FLIGHT.hop;
      this.airborne = true;
      this.launchY = this.position.y;
      this.grounded = false;
    }
    if (this.airborne) {
      this.altitude = this.measureAltitude();
      const ceilingY = this.launchY + FLIGHT.ceiling;
      if (input.flap && this.stamina > 0 && this.flapHeld > FLIGHT.hold) {
        // ease off near the ceiling so the goose hovers there instead of bouncing
        const room = THREE.MathUtils.clamp((ceilingY - this.position.y) / 0.8, -0.5, 1);
        this.vy = THREE.MathUtils.damp(this.vy, FLIGHT.climb * room, 5, dt);
        this.stamina = Math.max(0, this.stamina - dt);
        this.flight = "flap";
      } else if (input.flap) {
        this.vy = THREE.MathUtils.damp(this.vy, -FLIGHT.glideSink, 3, dt);
        this.flight = this.flapHeld > FLIGHT.hold ? "glide" : "flap";   // still in the hop: wings beating
      } else {
        this.vy = Math.max(this.vy - 9.81 * 0.55 * dt, -FLIGHT.fallMax);
        this.flight = "glide";
      }
      if (this.position.y > ceilingY + 0.05) this.vy = Math.min(this.vy, -0.2);
      // soft landing: the allowed sink rate falls to landSink over the last 1.5 m
      const maxSink = FLIGHT.landSink + (FLIGHT.fallMax - FLIGHT.landSink) * THREE.MathUtils.clamp((this.altitude - 0.2) / 1.5, 0, 1);
      this.vy = Math.max(this.vy, -maxSink);
    } else {
      this.altitude = 0;
      this.flight = "ground";
      this.stamina = Math.min(FLIGHT.stamina, this.stamina + FLIGHT.regen * dt);
    }

    let target = input.crouch ? CROUCH_SPEED : input.run ? RUN_SPEED * (input.flap ? FLAP_BOOST : 1) : WALK_SPEED;
    if (this.swimming) target = SWIM_SPEED * (input.flap ? 1.4 : 1);
    if (this.airborne) target = Math.max(FLIGHT.speed, input.run ? RUN_SPEED : 0);
    if (drag) target = Math.min(target, WALK_SPEED) * DRAG_FACTOR;
    // slight momentum: speeding up is gentler than stopping ("1 percent QWOP"); in the air, more glide
    const accel = this.airborne ? (want ? 2.5 : 1.2) : want ? (input.run ? 5 : 7) : 9;
    this.speed = THREE.MathUtils.damp(this.speed, want ? target * Math.min(input.move.length(), 1) : 0, accel, dt);
    let moveYaw = this.yaw + (drag ? Math.PI : 0);
    if (want) {
      // camera yaw is a compass heading; forward on screen is that heading
      const heading = cameraYaw * Math.PI / 180 + Math.atan2(input.move.x, input.move.y);
      const desiredMove = Math.PI - heading;   // goose faces +z locally; compass 0 (north) is -z
      let d = desiredMove - moveYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      // running turns wider (spec G-MOVE): a lower turn rate at speed; flapping restores control
      const rate = this.airborne ? 3.5 : input.run && !input.flap ? 5 : this.swimming ? 4 : 11;
      moveYaw += d * Math.min(1, dt * rate);
      this.yaw = moveYaw - (drag ? Math.PI : 0);
    }
    const fwd = new THREE.Vector3(Math.sin(moveYaw), 0, Math.cos(moveYaw));
    if (!this.airborne) this.vy = this.grounded ? -1 : this.vy - 9.81 * dt;
    const delta = fwd.multiplyScalar(this.speed * dt).setY(this.vy * dt);
    if (this.controller && this.collider && this.body) {
      this.controller.computeColliderMovement(this.collider, delta, undefined, GROUP_GOOSE);
      const m = this.controller.computedMovement();
      this.grounded = this.controller.computedGrounded();
      // bumped a ceiling (eave, branch, bridge) on the way up: stop climbing
      if (this.airborne && delta.y > 0 && m.y < delta.y * 0.5) this.vy = Math.min(this.vy, 0);
      const t = this.body.translation();
      const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
      this.body.setNextKinematicTranslation(next);
      this.position.set(next.x, next.y - CAPSULE_R - CAPSULE_HALF, next.z);
      this.speed = Math.min(this.speed, Math.hypot(m.x, m.z) / Math.max(dt, 1e-4) + 0.5);
    } else {
      this.position.add(delta);
      this.grounded = this.position.y <= this.floorY + 1e-4;
      if (this.grounded) this.position.y = this.floorY;
    }
    // touch-down: on the ground (or back in the water) while moving down
    if (this.airborne && this.vy <= 0) {
      const inWater = this.waterLevel !== null && this.position.y < this.waterLevel - 0.12;
      if (this.grounded || inWater) { this.airborne = false; this.flight = "ground"; this.vy = -1; this.altitude = 0; }
    }
    if (input.honk && this.honkT >= 1) { this.honkT = 0; this.onHonk?.(); this.skinned?.playHonk(); }
    // the wings snap open on a tap and fold more slowly
    if (input.flap) this.flapT = Math.min(this.flapT + dt * 10, 1); else this.flapT = Math.max(this.flapT - dt * 3, 0);
    this.crouchK = THREE.MathUtils.damp(this.crouchK, input.crouch && !this.airborne ? 1 : 0, 10, dt);
    this.honkT = Math.min(this.honkT + dt * 2.2, 1);
    this.startleT = Math.min(this.startleT + dt * 1.6, 1);
    // flying pose only once clear of the ground (a hop keeps the walking legs)
    const flyingPose = this.airborne && (this.altitude > 0.35 || this.flight === "flap" && this.flapHeld > FLIGHT.hold);
    this.airK = THREE.MathUtils.damp(this.airK, flyingPose ? 1 : 0, 6, dt);
    this.glideK = THREE.MathUtils.damp(this.glideK, this.flight === "glide" ? 1 : 0, 4, dt);
    this.animate(dt);
  }

  /** Caught by a character: wings rear up and the head shoots up for a moment (spec: getting caught). */
  startle() { this.startleT = 0; }

  private animate(dt: number) {
    const r = this.rig;
    r.root.position.copy(this.position);
    let y = this.position.y;
    if (this.swimming && this.waterLevel !== null) y = this.waterLevel - SWIM_DEPTH;
    // smooth the visual height through water entry / take-off; snap on land so steps stay crisp
    this.visY = Number.isNaN(this.visY) || (this.waterLevel === null && !this.airborne) ? y : THREE.MathUtils.damp(this.visY, y, 14, dt);
    r.root.position.y = this.visY;
    r.root.rotation.y = this.yaw;
    r.ripple.visible = this.swimming;
    if (this.swimming) {
      r.ripple.position.y = SWIM_DEPTH + 0.01;
      r.ripple.scale.setScalar(1 + 0.15 * Math.sin(this.time * 3) + 0.3 * Math.min(this.speed, 1));
    }
    const run = THREE.MathUtils.clamp((this.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    const moving = THREE.MathUtils.clamp(this.speed / WALK_SPEED, 0, 1);
    const stride = 0.22 + 0.16 * run;
    const before = Math.floor(this.phase / Math.PI);
    if (!this.airborne) this.phase += (this.speed * dt) / stride * Math.PI;
    if (Math.floor(this.phase / Math.PI) !== before && this.speed > 0.3) this.onStep?.(this.swimming);
    // idle grazing: every few seconds of standing still, a quick dip to peck at the grass
    this.idle = moving > 0.1 || this.airborne ? 0 : this.idle + dt;
    const pc = (this.idle % 5.5) - 3.5;
    const peck = pc > 0 && pc < 1.2 ? Math.sin((pc / 1.2) * Math.PI) * (0.7 + 0.3 * Math.sin(pc * 25)) : 0;
    // attention: the head turns toward a nearby person (eye contact) or a grabbable item, and the
    // neck reaches toward the item with the beak slightly open (spec G-ANIM reach cue)
    let lookYaw = Math.sin(this.time * 0.7) * 0.25 * (1 - moving), reach = 0, reachLow = 0;
    if (this.attention && !this.airborne) {
      const local = r.root.worldToLocal(this.attention.point.clone());
      lookYaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -LOOK_MAX, LOOK_MAX);
      if (this.attention.kind === "item") {
        const d = Math.hypot(local.x, local.z);
        reach = THREE.MathUtils.clamp(1 - (d - 0.4) / 0.9, 0, 1);
        reachLow = reach * THREE.MathUtils.clamp(0.8 - local.y, 0, 1);
      }
    }
    this.headYaw = THREE.MathUtils.damp(this.headYaw, lookYaw, 6, dt);
    const startle = this.startleT < 1 ? Math.sin(this.startleT * Math.PI) : 0;
    const k = { run, moving, peck, reach, reachLow, startle };
    if (this.skinned) this.animateSkinned(dt, this.skinned, k);
    else this.animateProcedural(k);
    r.honkLines.visible = this.honkT < 0.6;
    r.honkLines.scale.setScalar(1 + this.honkT * 1.5);
  }

  private animateSkinned(dt: number, sk: SkinnedGoose,
    k: { run: number; moving: number; peck: number; reach: number; reachLow: number; startle: number }) {
    const air = this.airK, swim = this.swimming ? 1 - air : 0, ground = (1 - air) * (1 - swim);
    const crouch = this.crouchK, step = THREE.MathUtils.smoothstep(this.speed, 0.05, 0.5);
    const glide = this.glideK;
    sk.pose(dt, {
      idle: ground * (1 - step) * (1 - crouch),
      walk: ground * step * (1 - k.run) * (1 - crouch),
      run: ground * step * k.run * (1 - crouch),
      crouch: ground * crouch,
      swim,
      flap: air * (1 - glide),
      glide: air * glide,
    }, {
      // on the ground a flap is the full-span display over whatever the legs are doing
      fold: (1 - air) * (1 - Math.max(this.flapT, k.startle)) * (1 - k.run * step),
      run: (1 - air) * (1 - Math.max(this.flapT, k.startle)) * k.run * step,
      flap: air * (1 - glide) + (1 - air) * Math.max(this.flapT, k.startle),
      glide: air * glide,
    }, ((this.phase / (2 * Math.PI)) % 1 + 1) % 1);
    // procedural layer on top of the clips: lean, reach, peck, look, jaw
    const X = AXIS_X, Y = AXIS_Y;
    const tug = this.tugging ? 0.3 + 0.08 * Math.sin(this.time * 22) : 0;
    sk.turn("body", X, -0.25 * k.startle - tug);
    const low = Math.max(k.peck * 1.1, k.reachLow * 0.95) * (1 - k.startle) * (1 - air);
    sk.turn("neck1", X, 0.7 * low + 0.22 * k.reach - 0.3 * k.startle + 0.35 * tug);
    sk.turn("neck2", X, 0.45 * low);
    sk.turn("neck3", X, -0.25 * low);
    sk.turn("head", X, 0.25 * low - 0.3 * k.startle);
    const hy = this.headYaw / 4;
    for (const n of ["neck2", "neck3", "neck4", "head"]) sk.turn(n, Y, hy);
    sk.turn("jaw", X, Math.max(0.18 * k.reach, 0.4 * k.startle));
  }

  /** The fallback goose built from primitives (no glb): the original procedural animation. */
  private animateProcedural(k: { run: number; moving: number; peck: number; reach: number; reachLow: number; startle: number }) {
    const r = this.rig;
    const swim = this.swimming ? 1 : 0;
    const { run, moving, peck, reach, reachLow, startle } = k;
    const stride = 0.22 + 0.16 * run;
    const s = Math.sin(this.phase);
    const crouch = this.crouchK;
    // body: waddle roll, bob twice per stride, lean forward when running, sink when crouching
    r.body.position.y = -0.1 * crouch + Math.abs(s) * 0.018 * moving * (1 - swim) + Math.sin(this.time * 2.1) * 0.004 * (1 - moving)
      + swim * Math.sin(this.time * 1.7) * 0.012;
    r.body.rotation.z = s * 0.09 * moving * (1 - 0.5 * run) * (1 - swim);
    r.body.rotation.x = 0.16 * run * (1 - swim) + 0.12 * crouch - 0.08 * swim - 0.25 * startle - (this.tugging ? 0.3 + 0.08 * Math.sin(this.time * 22) : 0);
    // legs: alternate swing with foot lift; feet stay flat
    for (let i = 0; i < 2; i++) {
      const ph = this.phase + i * Math.PI;
      const swing = Math.sin(ph) * stride * 0.5 * moving;
      const lift = Math.max(0, Math.cos(ph)) * 0.06 * moving + (this.airborne ? 0.12 : 0);
      const leg = r.legs[i];
      const hipY = 0.27 - 0.1 * crouch + r.body.position.y;
      const footZ = 0.02 + swing - (this.airborne ? 0.12 : 0), footY = lift;
      leg.position.y = hipY;
      leg.rotation.x = Math.atan2(footZ - 0.02, hipY - footY) * -1;
      leg.scale.y = Math.hypot(footZ - 0.02, hipY - footY) / 0.26;
      r.feet[i].position.set(leg.position.x, footY, footZ);
      // swimming: legs fold under the body and paddle slowly, hidden by the water line
      leg.visible = r.feet[i].visible = !this.swimming;
    }
    // wings: tucked, a little open when running, full flap on demand (gliding: held open)
    const flap = Math.max(this.flapT, this.airK);
    const beat = this.flight === "glide" ? 0.35 : Math.sin(this.time * 18) * 0.5 + 0.5;
    r.wings.forEach((w, i) => {
      const sgn = i === 0 ? -1 : 1;
      // a flap swings each folded wing out sideways (full span, as in UGG) and beats it in a wide V
      w.rotation.z = sgn * (0.08 * run + flap * (0.45 + 0.75 * beat) + startle * 1.3);
      w.rotation.y = sgn * (flap * 1.15 + startle * 0.3);
    });
    // neck and head: S-curve; forward and low when running or crouching; honk thrusts forward
    const honk = Math.sin(Math.min(this.honkT, 1) * Math.PI);
    const bob = Math.sin(this.phase * 2) * 0.02 * moving;
    const low = Math.max(run * 0.6, crouch, peck * 1.25, reachLow * 0.9, this.airK * 0.5) * (1 - startle);
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
  }
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
