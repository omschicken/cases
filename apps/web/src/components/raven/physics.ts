import { Euler, Vector3 } from 'three';

/**
 * Small deterministic rigid-body simulation for the opening sequence (fixed 240 Hz steps, evaluated from t = 0 on every call,
 * so a given time always gives the same pose, also when the clock is stepped offline).
 * Units are scene units (the case is 4.45 wide); gravity is scaled to the size of a case that is about half a metre long.
 */
const STEP = 1 / 240;
const G = 46;

/** Half extents of the case (width, height with lid, depth). */
const HX = 2.225, HY = 1.125, HZ = 1.09;
const IX = ((2 * HY) ** 2 + (2 * HZ) ** 2) / 12;   // moments of inertia per unit mass
const IZ = ((2 * HX) ** 2 + (2 * HY) ** 2) / 12;

export type Hit = { t: number; speed: number };
export type DropPose = { y: number; rx: number; rz: number; hits: Hit[] };

/** The point where the case settles: the length of the drop phase, in seconds (the pose is forced flat shortly before it). */
export const DROP_SETTLE = 1.6;

const e = new Euler(0, 0, 0, 'ZXY');
const corner = new Vector3();

/**
 * The case falls from above the frame with a little tumble, lands on a corner, rebounds, rocks and comes to rest.
 * Impacts are resolved with impulses at the lowest corner (restitution, inertia of a box); `hits` lists the strong ones.
 */
export function simulateDrop(t: number): DropPose {
  let cy = HY + 7.6, vy = 0, rx = 0.17, rz = -0.11, wx = -0.55, wz = 0.4; // centre height, angles, angular velocities
  const hits: Hit[] = [];
  const end = Math.min(t, DROP_SETTLE + 0.4);
  for (let time = 0; time < end; time += STEP) {
    vy -= G * STEP; cy += vy * STEP; rx += wx * STEP; rz += wz * STEP;
    // lowest corner of the rotated box
    e.set(rx, 0, rz, 'ZXY'); let low = Infinity, lx = 0, lz = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? HX : -HX, i & 2 ? HY : -HY, i & 4 ? HZ : -HZ).applyEuler(e);
      if (corner.y < low) { low = corner.y; lx = corner.x; lz = corner.z; }
    }
    const pen = cy + low;
    if (pen < 0) {
      cy -= pen;
      const vc = vy + wz * lx - wx * lz; // vertical velocity of the contact corner
      if (vc < 0) {
        const bounce = -vc > 2.2 ? 0.34 : 0; // slow contacts are inelastic, so the case does not buzz on the stone
        const j = (-(1 + bounce) * vc) / (1 + (lz * lz) / IX + (lx * lx) / IZ);
        vy += j; wx += (-lz * j) / IX; wz += (lx * j) / IZ;
        if (-vc > 3) hits.push({ t: time, speed: -vc });
      }
      wx *= 0.992; wz *= 0.992; // friction on the stone
    }
    wx *= 1 - 0.35 * STEP; wz *= 1 - 0.35 * STEP;
  }
  // forced to rest: the last stretch eases the remaining wobble out so the final pose is exactly flat
  if (t >= DROP_SETTLE) { const k = Math.min(1, (t - DROP_SETTLE) / 0.25); rx *= 1 - k; rz *= 1 - k; cy += (HY - cy) * k; }
  return { y: cy - HY, rx, rz, hits }; // y is the height of the centre above where it rests
}

/** Origin (base) position of the case group for a pose: rotate about the centre of the box. */
export function dropOrigin(p: DropPose, out: Vector3): Vector3 {
  e.set(p.rx, 0, p.rz, 'ZXY');
  out.set(0, -HY, 0).applyEuler(e); out.y += HY + p.y; // the base point relative to the centre, lifted to the centre height
  return out;
}

export const REST_POSE: DropPose = { y: 0, rx: 0, rz: 0, hits: [] };

/**
 * Spring-loaded lid: pops up, overshoots the hinge limit, bounces off the stop and settles at `target`.
 * `t` is seconds since the lid was released; returns the opening angle in radians.
 */
export function lidAngle(t: number, start = 0.05, target = 1.9, limit = 2.02): number {
  let th = start, w = 0.5; const k = 36, c = 7.4; // softer spring and more damping: a smooth swing with one gentle settle
  const end = Math.min(t, 2.4);
  for (let time = 0; time < end; time += STEP) {
    w += (k * (target - th) - c * w) * STEP; th += w * STEP;
    if (th > limit) { th = limit; w = -w * 0.2; }
  }
  return th;
}

/** Camera shake from the impacts: a short, decaying jolt along the vertical axis. */
export function shakeAt(hits: Hit[], age: number): number {
  let s = 0;
  for (const h of hits) { const a = age - h.t; if (a > 0) s += Math.min(1, h.speed / 28) * 0.05 * Math.exp(-a * 6) * Math.sin(a * 38); }
  return s;
}
