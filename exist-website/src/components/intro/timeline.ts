/*
  Every time-based and scroll-based value of the intro lives here, so the
  WebGL renderer and the DOM overlays always agree on what happens when.
*/

import { clamp01, easeInOut, lerp, smoothstep, v3, type Vec3 } from "./gl/math";
import type { CameraState, PourState, WorldState } from "./gl/Renderer";

export const CHARGE_MIN_SECONDS = 1.35;
export const POUR_SECONDS = 6.6;
export const AWAIT_AUTO_SECONDS = 3.4;
export const GARDEN_SECONDS = 6.4;
export const FLOOD_SECONDS = 6.0;

/* Scroll length of the landmark story (in viewport heights) + hold at the end. */
export const STORY_VH = 1100;
export const TAIL_VH = 140;

const DEG = Math.PI / 180;
const BASE_FOV = 45 * DEG;

/* ------------------------------------------------------------------ */
/* Camera helpers                                                      */
/* ------------------------------------------------------------------ */

/* Keeps the composition readable on tall/narrow screens. */
export function frameCamera(
  eye: Vec3,
  target: Vec3,
  aspect: number,
): CameraState {
  // landscape: keep a 1.45:1 field of view; portrait phones: a little tighter
  const desiredHalfH = Math.tan(BASE_FOV / 2) * (aspect < 0.8 ? 1.2 : 1.45);
  const neededHalfV = desiredHalfH / Math.max(aspect, 0.2);
  const halfV = Math.max(Math.tan(BASE_FOV / 2), neededHalfV);
  const maxHalfV = Math.tan(34 * DEG);
  const fov = 2 * Math.atan(Math.min(halfV, maxHalfV));
  const dolly = Math.max(1, halfV / maxHalfV);
  if (dolly > 1.001) {
    const back = v3.scale(v3.sub(eye, target), dolly);
    eye = v3.add(target, back);
  }
  return { eye, target, fov };
}

/* ------------------------------------------------------------------ */
/* POUR                                                                */
/* ------------------------------------------------------------------ */

export const POUR = {
  eye: [0, 0.95, 9.6] as Vec3,
  dist: 6,
  startPitch: 24 * DEG,
};

export function pourEndPitch() {
  return -Math.atan(0.2 * Math.tan(BASE_FOV / 2));
}

export function pourPitch(t: number) {
  return lerp(
    POUR.startPitch,
    pourEndPitch(),
    easeInOut(smoothstep(1.55, 5.4, t)),
  );
}

export function pourCamera(t: number, aspect: number): CameraState {
  const pitch = pourPitch(t);
  const eye = POUR.eye;
  const target: Vec3 = [
    eye[0],
    eye[1] + Math.sin(pitch) * 10,
    eye[2] - Math.cos(pitch) * 10,
  ];
  const framed = frameCamera(eye, target, aspect);
  // never dolly the pour camera; only widen the lens
  return { eye, target, fov: framed.fov };
}

/* World-space bar height/half-length matching the DOM tube at pour start. */
export function pourGeometry(
  lineWidthCss: number,
  viewportH: number,
  fov: number,
) {
  const focal = viewportH / 2 / Math.tan(fov / 2);
  const barY = POUR.eye[1] + POUR.dist * Math.tan(POUR.startPitch);
  const half =
    ((lineWidthCss / 2) * POUR.dist) / (focal * Math.cos(POUR.startPitch));
  return { barY, half, focal };
}

export function pourState(
  t: number,
  lineWidthCss: number,
  viewportH: number,
  fov: number,
): PourState {
  const { barY, half } = pourGeometry(lineWidthCss, viewportH, fov);
  return {
    t,
    pitch: pourPitch(t),
    camH: POUR.eye[1],
    dist: POUR.dist,
    barY,
    half,
    fade: 1,
  };
}

/* When (seconds into the pour) and where (-1..1 across the bar) each of the six streams lands. */
export function pourImpacts() {
  const fallTime = 1.25;
  return [-0.8, -0.46, -0.16, 0.16, 0.46, 0.8].map((x, i) => ({
    x,
    at: 0.5 + Math.pow(Math.abs(x), 1.25) + fallTime + (i % 2) * 0.12,
  }));
}

/* Impact ripples (x, z, absolute start time) for six streams. */
export function pourRipples(pourStartTime: number, half: number) {
  const out = new Float32Array(18);
  pourImpacts().forEach(({ x, at }, i) => {
    out[i * 3] = x * half;
    out[i * 3 + 1] = POUR.eye[2] - POUR.dist;
    out[i * 3 + 2] = pourStartTime + at;
  });
  return out;
}

export function noRipples() {
  const out = new Float32Array(18);
  for (let i = 0; i < 6; i++) out[i * 3 + 2] = -1;
  return out;
}

/* ------------------------------------------------------------------ */
/* WORLD STORY (scroll progress p in 0..1)                             */
/* ------------------------------------------------------------------ */

type Key = { p: number; eye: Vec3; target: Vec3 };

export const STORY_KEYS: Key[] = [
  { p: 0.0, eye: [0, 2.2, 9.2], target: [0, 0.35, 1.2] },
  { p: 0.2, eye: [0, 1.8, 6.5], target: [0, 0.82, 0.05] },
  { p: 0.31, eye: [3.6, 2.0, 5.3], target: [0.2, 0.72, 0.85] },
  { p: 0.42, eye: [2.1, 1.7, 6.0], target: [0.0, 0.82, 0.9] },
  { p: 0.5, eye: [0, 1.45, 6.4], target: [0, 1.02, 0] },
  { p: 0.66, eye: [0, 1.55, 6.0], target: [0, 1.02, 0] },
  { p: 0.74, eye: [0, 2.2, 5.0], target: [0, 1.15, 0] },
  { p: 0.83, eye: [0.08, 4.9, 0.7], target: [0.05, 1.45, -0.08] },
  { p: 0.91, eye: [0.18, 2.15, -0.12], target: [0.18, 1.48, -0.22] },
  { p: 1.0, eye: [0.18, 1.8, -0.15], target: [0.18, 1.48, -0.22] },
];

export function storyCamera(
  p: number,
  aspect: number,
  parallax: [number, number],
): CameraState {
  const x = clamp01(p);
  let i = 0;
  while (i < STORY_KEYS.length - 2 && x > STORY_KEYS[i + 1].p) i++;
  const a = STORY_KEYS[i];
  const b = STORY_KEYS[i + 1];
  const local = easeInOut((x - a.p) / (b.p - a.p));
  let eye = v3.lerp(a.eye, b.eye, local);
  const target = v3.lerp(a.target, b.target, local);
  // gentle pointer parallax, faded out for the top view / dive
  const sway = 1 - smoothstep(0.74, 0.8, x);
  eye = v3.add(eye, [parallax[0] * 0.22 * sway, -parallax[1] * 0.12 * sway, 0]);
  return frameCamera(eye, target, aspect);
}

export const CHAPTERS = [
  { id: "origin", label: "Blueprint", start: 0.0, end: 0.24 },
  { id: "engineering", label: "Build", start: 0.24, end: 0.44 },
  { id: "excellence", label: "Excellence", start: 0.44, end: 0.7 },
  { id: "vision", label: "Vision", start: 0.7, end: 1.0 },
] as const;

/* Water-garden values shared by the garden reveal and the scroll story. */
function gardenValues(
  front: number,
  garden: number,
  lead: number,
  fill: number,
  lotus: number,
  fountains: number,
  pulse: number,
  grid: number,
  water: number,
) {
  return { front, garden, lead, fill, lotus, fountains, pulse, grid, water };
}

export function storyWorld(
  p: number,
  aspect: number,
  parallax: [number, number],
): WorldState {
  const build = smoothstep(0.035, 0.2, p);
  const dim = 0.72 * smoothstep(0.44, 0.5, p) * (1 - smoothstep(0.68, 0.75, p));
  const scanSweep = p > 0.24 && p < 0.44 ? ((p - 0.24) / 0.2) * 2 : -1;
  const scanY = scanSweep < 0 ? -1 : (scanSweep % 1) * 1.65;
  const g = gardenValues(1.15, 1, 0, 1, 1, 1, 1, 1, 0);
  return {
    camera: storyCamera(p, aspect, parallax),
    ...g,
    dim,
    ripples: noRipples(),
    build,
    rockVisible: 1,
    summit: smoothstep(0.78, 0.86, p),
    scanY,
    forest: 1,
    motes: 1,
    stair: smoothstep(0.25, 0.36, p),
    mirror: smoothstep(0.28, 0.38, p),
    scanRing: smoothstep(0.03, 0.045, p) * (1 - smoothstep(0.19, 0.215, p)),
    env: smoothstep(0.02, 0.12, p),
  };
}

/* Brightness of the whole frame: blackout into the final message. */
export function storyFade(p: number) {
  return 1 - smoothstep(0.885, 0.94, p);
}

/* ------------------------------------------------------------------ */
/* GARDEN REVEAL (time since the garden phase started)                 */
/* ------------------------------------------------------------------ */

export function gardenWorld(
  t: number,
  aspect: number,
  ripples: Float32Array,
): WorldState {
  const pourEye = POUR.eye;
  const pitch = pourEndPitch();
  const pourTarget: Vec3 = [
    0,
    pourEye[1] + Math.sin(pitch) * 10,
    pourEye[2] - Math.cos(pitch) * 10,
  ];
  const start = STORY_KEYS[0];
  const k = easeInOut(smoothstep(0.25, 6.1, t));
  const eye = v3.lerp(pourEye, start.eye, k);
  const target = v3.lerp(pourTarget, start.target, k);
  const sweep = easeInOut(smoothstep(0.6, 5.0, t));
  const g = gardenValues(
    lerp(7.4, 1.15, sweep),
    smoothstep(0.4, 0.9, t),
    smoothstep(0.5, 0.9, t) * (1 - smoothstep(4.8, 5.4, t)),
    smoothstep(0.6, 1.2, t),
    smoothstep(3.0, 6.2, t),
    smoothstep(3.0, 4.2, t),
    smoothstep(4.6, 6.3, t),
    smoothstep(0.8, 3.2, t),
    1 - smoothstep(1.2, 4.6, t),
  );
  return {
    camera: frameCamera(eye, target, aspect),
    ...g,
    dim: 0,
    ripples,
    build: 0,
    rockVisible: 0,
    summit: 0,
    scanY: -1,
    forest: 0,
    motes: smoothstep(1.0, 5.0, t),
    stair: 0,
    mirror: 0,
    scanRing: 0,
    env: 0,
  };
}

/* Liquid surface during the pour / waiting moment. */
export function pourWorld(
  t: number,
  aspect: number,
  ripples: Float32Array,
): WorldState {
  return {
    camera: pourCamera(t, aspect),
    front: 7.4,
    garden: 0,
    lead: 0,
    fill: 0,
    lotus: 0,
    fountains: 0,
    pulse: 0,
    grid: 0,
    water: 1,
    dim: 0,
    ripples,
    build: 0,
    rockVisible: 0,
    summit: 0,
    scanY: -1,
    forest: 0,
    motes: 0,
    stair: 0,
    mirror: 0,
    scanRing: 0,
    env: 0,
  };
}
