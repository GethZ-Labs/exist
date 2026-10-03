/*
  The landscape around the rock, kept quiet so the story stays in front:
  the lion statue on the Lion Terrace, a few elephants, the lotus lake
  (drawn in the WORLD shader — its shape lives here so trees avoid it)
  and a soft forest of round-crowned trees.

  Meshes use the rock mesh layout — position(3) normal(3) param(3) — with
  param.z as the shading region: 5 = lion, 6 = elephants.
*/

import type { Vec3 } from "./math";
import { LION, planRadius, ROCK } from "./sigiriya";
import type { RockMesh } from "./sigiriya";

/* Lake south-west of the rock (world x = north, z = west). Mirrored in WORLD_FRAG. */
export const LAKE = { x: -3.05, z: 0.55, rx: 1.25, rz: 0.95 };

export function inLake(x: number, z: number, margin = 0) {
  const nx = (x - LAKE.x) / (LAKE.rx + margin);
  const nz = (z - LAKE.z) / (LAKE.rz + margin);
  return nx * nx + nz * nz < 1.1;
}

/* Drops scattered canopy points (xyz, seed) that would sit on the lake. */
export function clearLake(points: Float32Array) {
  const kept: number[] = [];
  for (let i = 0; i < points.length; i += 4) {
    if (!inLake(points[i], points[i + 2], 0.18)) kept.push(points[i], points[i + 1], points[i + 2], points[i + 3]);
  }
  return new Float32Array(kept);
}

/* Joins two meshes that share the rock vertex layout. */
export function mergeMeshes(a: RockMesh, b: RockMesh): RockMesh {
  const offset = a.vertices.length / 9;
  const vertices = new Float32Array(a.vertices.length + b.vertices.length);
  vertices.set(a.vertices);
  vertices.set(b.vertices, a.vertices.length);
  const indices = new Uint32Array(a.indices.length + b.indices.length);
  indices.set(a.indices);
  for (let i = 0; i < b.indices.length; i++) indices[a.indices.length + i] = b.indices[i] + offset;
  return { vertices, indices };
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

type Builder = { out: number[]; idx: number[] };

/* An ellipsoid placed by `place` (local → world for points and normals). */
function ellipsoid(
  b: Builder,
  center: Vec3,
  radii: Vec3,
  region: number,
  place: (p: Vec3, isNormal: boolean) => Vec3 = (p) => p,
  seg = 18,
  rings = 11,
) {
  const base = b.out.length / 9;
  for (let i = 0; i <= rings; i++) {
    const v = (i / rings) * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const u = (j / seg) * Math.PI * 2;
      const unit: Vec3 = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
      const local: Vec3 = [
        center[0] + unit[0] * radii[0],
        center[1] + unit[1] * radii[1],
        center[2] + unit[2] * radii[2],
      ];
      let n: Vec3 = [unit[0] / radii[0], unit[1] / radii[1], unit[2] / radii[2]];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / len, n[1] / len, n[2] / len];
      const p = place(local, false);
      const pn = place(n, true);
      b.out.push(p[0], p[1], p[2], pn[0], pn[1], pn[2], 0, 0, region);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j;
      const c = a + seg + 1;
      b.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
}

/* A tapered tube approximated by overlapping spheres along a path. */
function chain(
  b: Builder,
  path: (t: number) => Vec3,
  r0: number,
  r1: number,
  count: number,
  region: number,
  place?: (p: Vec3, isNormal: boolean) => Vec3,
) {
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const r = r0 + (r1 - r0) * t;
    ellipsoid(b, path(t), [r, r, r], region, place, 12, 7);
  }
}

/*
  The Lion Gate: a seated lion against the north face, facing north (+x),
  its paws on the terrace (the paws are part of the rock structures) and
  the stairway rising between them.
*/
export function buildLion(): RockMesh {
  const b: Builder = { out: [], idx: [] };
  const x0 = LION.x - 0.04;
  const y0 = LION.y;
  const R = 5;
  const at = (dx: number, dy: number, dz: number): Vec3 => [x0 + dx, y0 + dy, dz];
  for (const side of [-1, 1]) {
    ellipsoid(b, at(0.248, 0.12, side * 0.085), [0.032, 0.088, 0.032], R); // foreleg
    ellipsoid(b, at(0.226, 0.2, side * 0.082), [0.045, 0.06, 0.042], R); // shoulder
  }
  ellipsoid(b, at(0.07, 0.17, 0), [0.14, 0.12, 0.16], R); // body, set into the cliff
  ellipsoid(b, at(0.19, 0.245, 0), [0.085, 0.11, 0.13], R); // chest
  ellipsoid(b, at(0.2, 0.385, 0), [0.085, 0.12, 0.13], R); // mane
  for (let k = 0; k < 11; k++) {
    // ruff of the mane framing the face
    const a = -Math.PI * 0.8 + (k / 10) * Math.PI * 1.6;
    ellipsoid(b, at(0.215, 0.385 + Math.cos(a) * 0.115, Math.sin(a) * 0.125), [0.03, 0.032, 0.03], R, undefined, 10, 6);
  }
  ellipsoid(b, at(0.272, 0.388, 0), [0.066, 0.066, 0.07], R); // head
  ellipsoid(b, at(0.336, 0.362, 0), [0.05, 0.038, 0.045], R); // muzzle
  ellipsoid(b, at(0.376, 0.372, 0), [0.02, 0.02, 0.024], R); // nose
  ellipsoid(b, at(0.322, 0.324, 0), [0.045, 0.014, 0.038], R); // open jaw — the old gateway
  for (const side of [-1, 1]) {
    ellipsoid(b, at(0.246, 0.456, side * 0.046), [0.016, 0.026, 0.014], R); // ears
  }
  return { vertices: new Float32Array(b.out), indices: new Uint32Array(b.idx) };
}

/* Where the elephants stand: [x, z, heading (radians, 0 = facing north/+x), scale]. */
const HERD: [number, number, number, number][] = [
  [-2.92, -0.56, 0.05, 0.17], // along the lake's south shore, toward the rock
  [-3.28, -0.66, -0.04, 0.1], // calf
  [-2.5, -0.7, 0.08, 0.155],
  [2.45, 0.5, Math.PI, 0.165], // on the north side, facing the rock
];

export function buildElephants(): RockMesh {
  const b: Builder = { out: [], idx: [] };
  const E = 6;
  HERD.forEach(([x, z, heading, s]) => {
    const c = Math.cos(heading);
    const sn = Math.sin(heading);
    const place = (p: Vec3, isNormal: boolean): Vec3 => {
      const k = isNormal ? 1 : s;
      const lx = p[0] * k;
      const lz = p[2] * k;
      const rx = lx * c - lz * sn;
      const rz = lx * sn + lz * c;
      return isNormal ? [rx, p[1], rz] : [x + rx, p[1] * k, z + rz];
    };
    ellipsoid(b, [0, 0.64, 0], [0.56, 0.36, 0.31], E, place); // body
    ellipsoid(b, [-0.06, 0.78, 0], [0.4, 0.26, 0.27], E, place); // back
    ellipsoid(b, [0.56, 0.8, 0], [0.22, 0.25, 0.21], E, place); // head
    ellipsoid(b, [0.6, 0.95, 0], [0.13, 0.11, 0.15], E, place); // forehead dome
    for (const side of [-1, 1]) {
      ellipsoid(b, [0.42, 0.84, side * 0.23], [0.17, 0.25, 0.035], E, place); // ears
      ellipsoid(b, [0.33, 0.27, side * 0.15], [0.09, 0.3, 0.09], E, place); // front leg
      ellipsoid(b, [-0.34, 0.27, side * 0.15], [0.095, 0.3, 0.095], E, place); // hind leg
      chain(
        b,
        (t) => [0.68 + 0.17 * t, 0.6 - 0.07 * t + 0.08 * t * t, side * (0.08 + 0.02 * t)],
        0.024,
        0.012,
        6,
        E,
        place,
      ); // tusk
    }
    chain(
      b,
      (t) => [0.76 + 0.1 * t + 0.06 * Math.sin(t * Math.PI) + 0.07 * t * t * t, 0.74 - 0.64 * t + 0.05 * t * t * t, 0],
      0.08,
      0.03,
      12,
      E,
      place,
    ); // trunk
    chain(b, (t) => [-0.56 - 0.05 * t, 0.74 - 0.34 * t, 0], 0.022, 0.016, 6, E, place); // tail
  });
  return { vertices: new Float32Array(b.out), indices: new Uint32Array(b.idx) };
}

/* Round-crowned trees as soft point clusters (xyz, seed) — drawn with the forest points. */
export function buildTrees(count = 120): Float32Array {
  const points: number[] = [];
  let placed = 0;
  for (let attempt = 0; placed < count && attempt < count * 20; attempt++) {
    const theta = hash(attempt * 3.17 + 0.5) * Math.PI * 2;
    const r = planRadius(theta) * (ROCK.moundSpread + 0.15 + hash(attempt * 5.31) * 2.3);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    if (z > 1.0 && Math.abs(x) < 2.95) continue; // the water gardens
    if (inLake(x, z, 0.28)) continue;
    if (HERD.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 0.42)) continue;
    if (z > 3.4) continue; // keep the camera's foreground clear
    // grow in groves rather than evenly
    const grove = Math.sin(theta * 3 + 1.1) * Math.sin(r * 1.7 + theta) * 0.5 + 0.5;
    if (grove < 0.32) continue;
    const seed = hash(attempt * 9.7);
    const crown = 0.045 + hash(attempt * 2.9) * 0.045;
    const height = 0.02 + seed * 0.05;
    // a broadleaf crown: three overlapping lobes filled with soft points
    for (let l = 0; l < 3; l++) {
      const lx = x + (hash(attempt * 3.1 + l) - 0.5) * crown * 0.9;
      const lz = z + (hash(attempt * 4.7 + l) - 0.5) * crown * 0.9;
      const ly = height + crown * (0.55 + 0.45 * hash(attempt * 6.1 + l));
      const lr = crown * (0.55 + 0.3 * hash(attempt * 8.3 + l));
      for (let i = 0; i < 16; i++) {
        const q = attempt * 31 + l * 7 + i;
        const ang = hash(q * 1.3) * Math.PI * 2;
        const phi = Math.acos(2 * hash(q * 2.7) - 1);
        const rr = lr * (0.55 + 0.45 * Math.cbrt(hash(q * 4.1)));
        points.push(
          lx + rr * Math.sin(phi) * Math.cos(ang),
          ly + rr * Math.cos(phi) * 0.8,
          lz + rr * Math.sin(phi) * Math.sin(ang),
          hash(q * 5.9),
        );
      }
    }
    placed++;
  }
  return new Float32Array(points);
}
