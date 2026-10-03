/*
  Procedural model of Sigiriya (Lion Rock), Sri Lanka.

  World axes: +x = north, -x = south, +z = west (the side of the water
  gardens and where the camera starts), -z = east, +y = up.
  One world unit ≈ 120 m, so the rock rises ≈ 1.4 units (≈ 180–200 m)
  above its forested base mound.
*/

import type { Vec3 } from "./math";

export const ROCK = {
  halfLength: 1.08, // north–south
  halfWidth: 0.68, // east–west
  baseY: 0.34, // where the sheer cliff starts (top of the forested mound)
  topY: 1.4, // cliff edge (average)
  summitRise: 0.07, // extra height of the gently domed, terraced summit
  moundSpread: 1.62, // mound radius factor at ground level
};

const TAU = Math.PI * 2;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/* Footprint radius (in world units) for a direction around the vertical axis. */
export function planRadius(theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const n = 2.7;
  const base = Math.pow(
    Math.pow(Math.abs(c) / ROCK.halfLength, n) +
      Math.pow(Math.abs(s) / ROCK.halfWidth, n),
    -1 / n,
  );
  const wobble =
    1 +
    0.1 * Math.cos(theta) +
    0.05 * Math.sin(theta * 2 + 0.4) +
    0.045 * Math.sin(theta * 3 + 0.8) +
    0.026 * Math.sin(theta * 5 + 2.1) +
    0.012 * Math.sin(theta * 9 + 0.4);
  return base * wobble;
}

/* The cliff rim is highest in the north-east and drops toward the south-west. */
export function rimHeight(theta: number) {
  return (
    ROCK.topY +
    0.1 * Math.cos(theta + Math.PI / 4) +
    0.03 * Math.sin(theta * 2 + 1.1) +
    0.035 * (noise1(theta * 5 + 3) - 0.5) -
    0.05 * Math.exp(-Math.pow(((((theta % TAU) + TAU) % TAU) - 2.25) / 0.14, 2))
  );
}

/* Where the sheer wall meets the forested mound (higher on the west approach). */
export function baseHeight(theta: number) {
  return (
    ROCK.baseY +
    0.04 * Math.max(0, Math.sin(theta)) +
    0.03 * (noise1(theta * 4 + 11) - 0.5)
  );
}

/* Height fraction of the cliff at world height y for a given direction. */
export function cliffV(theta: number, y: number) {
  const base = baseHeight(theta);
  return (y - base) / (rimHeight(theta) - base);
}

/* How far the cliff bulges / tucks at height fraction v (0 = cliff foot, 1 = edge). */
export function cliffProfile(v: number, theta: number) {
  const west = Math.max(0, Math.sin(theta)); // the famous overhang is on the west face
  const bulge =
    (0.035 + 0.075 * west) * smooth(0.25, 0.75, v) * (1 - smooth(0.88, 1.0, v));
  const tuck =
    -0.03 * Math.sin(Math.PI * Math.min(1, v / 0.5)) * (1 - 0.5 * west);
  const shoulder = -0.07 * Math.pow(smooth(0.88, 1.0, v), 2);
  return 1 + bulge + tuck + shoulder;
}

/* Fine vertical flutes weathered into the granite. */
function striation(theta: number, v: number) {
  return (
    0.02 * Math.sin(theta * 61 + noise1(theta * 9) * 4) +
    0.009 * Math.sin(theta * 137 + v * 3) +
    0.014 * (noise1(theta * 24 + v * 2) - 0.5)
  );
}

export function cliffPoint(theta: number, v: number): Vec3 {
  const r =
    planRadius(theta) *
    (cliffProfile(v, theta) + striation(theta, v) * smooth(0.02, 0.2, v));
  const base = baseHeight(theta);
  const y = base + (rimHeight(theta) - base) * v;
  return [
    Math.cos(theta) * r + SHEAR[0] * v,
    y,
    Math.sin(theta) * r + SHEAR[1] * v,
  ];
}

/* Horizontal lean of the summit relative to the cliff foot. */
export const SHEAR: [number, number] = [0.06, -0.05];

function moundPoint(theta: number, m: number): Vec3 {
  const spread =
    ROCK.moundSpread +
    0.18 * (noise1(theta * 3 + 7) - 0.5) +
    0.12 * Math.max(0, Math.sin(theta));
  const rf = spread - (spread - 1.0) * Math.pow(m, 0.85);
  const bumps = 1 + 0.035 * (noise1(theta * 18 + m * 5) - 0.5);
  const r = planRadius(theta) * rf * bumps;
  const y = baseHeight(theta) * (1 - Math.pow(1 - m, 1.9));
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/* Summit: gently domed, sloping down to the west, cut into palace terraces. */
export function summitHeight(x: number, z: number) {
  const nx = (x - SHEAR[0]) / ROCK.halfLength;
  const nz = (z - SHEAR[1]) / ROCK.halfWidth;
  const d = Math.min(1, Math.hypot(nx * 0.95, nz));
  const tilt = 0.1 * (nx * Math.SQRT1_2 - nz * Math.SQRT1_2);
  const dome = ROCK.summitRise * (1 - d * d);
  const step = 0.024;
  const q = Math.max(0, dome) / step;
  const terraced =
    (Math.floor(q) + smooth(0.72, 1.0, q - Math.floor(q))) * step;
  return ROCK.topY + tilt + terraced;
}

function capPoint(theta: number, u: number): Vec3 {
  const edge = cliffPoint(theta, 1);
  const shrink = 1 - u;
  const x = SHEAR[0] + (edge[0] - SHEAR[0]) * shrink;
  const z = SHEAR[1] + (edge[2] - SHEAR[1]) * shrink;
  const rim = smooth(0.0, 0.12, u);
  const y = edge[1] + (summitHeight(x, z) - edge[1]) * rim;
  return [x, y, z];
}

export type RockMesh = { vertices: Float32Array; indices: Uint32Array };

/* Interleaved: position(3) normal(3) param(3: theta, height-fraction, region). */
export function buildRockMesh(segments = 220): RockMesh {
  const moundRows = 12;
  const cliffRows = 44;
  const capRows = 18;
  const rows: {
    region: number;
    param: number;
    point: (theta: number) => Vec3;
  }[] = [];

  for (let i = 0; i < moundRows; i++) {
    const m = i / moundRows;
    rows.push({ region: 0, param: m, point: (theta) => moundPoint(theta, m) });
  }
  for (let i = 0; i <= cliffRows; i++) {
    const v = i / cliffRows;
    rows.push({ region: 1, param: v, point: (theta) => cliffPoint(theta, v) });
  }
  for (let i = 1; i <= capRows; i++) {
    const u = Math.pow(i / capRows, 0.9);
    rows.push({ region: 2, param: u, point: (theta) => capPoint(theta, u) });
  }

  const cols = segments + 1;
  const positions: Vec3[] = [];
  for (const row of rows) {
    for (let j = 0; j < cols; j++) {
      positions.push(row.point((j / segments) * TAU));
    }
  }

  const at = (i: number, j: number) =>
    positions[i * cols + ((j + cols) % cols)];
  const vertices = new Float32Array(rows.length * cols * 9);
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < cols; j++) {
      const p = at(i, j);
      const jPrev = j === 0 ? segments - 1 : j - 1;
      const jNext = j === segments ? 1 : j + 1;
      const left = at(i, jPrev);
      const right = at(i, jNext);
      const down = at(Math.max(0, i - 1), j);
      const up = at(Math.min(rows.length - 1, i + 1), j);
      const tx: Vec3 = [
        right[0] - left[0],
        right[1] - left[1],
        right[2] - left[2],
      ];
      const ty: Vec3 = [up[0] - down[0], up[1] - down[1], up[2] - down[2]];
      // normal = ty × tx points outward for this winding
      let nx = ty[1] * tx[2] - ty[2] * tx[1];
      let ny = ty[2] * tx[0] - ty[0] * tx[2];
      let nz = ty[0] * tx[1] - ty[1] * tx[0];
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      if (rows[i].region === 2 && i === rows.length - 1) {
        nx = 0;
        ny = 1;
        nz = 0;
      }
      const o = (i * cols + j) * 9;
      vertices[o] = p[0];
      vertices[o + 1] = p[1];
      vertices[o + 2] = p[2];
      vertices[o + 3] = nx;
      vertices[o + 4] = ny;
      vertices[o + 5] = nz;
      vertices[o + 6] = (j / segments) * TAU;
      vertices[o + 7] = rows[i].param;
      vertices[o + 8] = rows[i].region;
    }
  }

  const indices = new Uint32Array((rows.length - 1) * segments * 6);
  let k = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  }
  return { vertices, indices };
}

/* The Lion Terrace: a platform on the north face with the two giant paws. */
export const LION = {
  y: 0.6,
  get x() {
    return cliffPoint(0, cliffV(0, 0.6))[0];
  },
};

function pushBox(
  out: number[],
  indices: number[],
  min: Vec3,
  max: Vec3,
  region = 3,
) {
  const base = out.length / 9;
  const faces: { n: Vec3; corners: Vec3[] }[] = [
    {
      n: [1, 0, 0],
      corners: [
        [max[0], min[1], min[2]],
        [max[0], max[1], min[2]],
        [max[0], max[1], max[2]],
        [max[0], min[1], max[2]],
      ],
    },
    {
      n: [-1, 0, 0],
      corners: [
        [min[0], min[1], max[2]],
        [min[0], max[1], max[2]],
        [min[0], max[1], min[2]],
        [min[0], min[1], min[2]],
      ],
    },
    {
      n: [0, 1, 0],
      corners: [
        [min[0], max[1], min[2]],
        [min[0], max[1], max[2]],
        [max[0], max[1], max[2]],
        [max[0], max[1], min[2]],
      ],
    },
    {
      n: [0, 0, 1],
      corners: [
        [max[0], min[1], max[2]],
        [max[0], max[1], max[2]],
        [min[0], max[1], max[2]],
        [min[0], min[1], max[2]],
      ],
    },
    {
      n: [0, 0, -1],
      corners: [
        [min[0], min[1], min[2]],
        [min[0], max[1], min[2]],
        [max[0], max[1], min[2]],
        [max[0], min[1], min[2]],
      ],
    },
  ];
  faces.forEach((face, f) => {
    face.corners.forEach((corner, c) => {
      out.push(
        corner[0],
        corner[1],
        corner[2],
        face.n[0],
        face.n[1],
        face.n[2],
        c,
        f,
        region,
      );
    });
    const o = base + f * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
}

export function buildStructures(): RockMesh {
  const out: number[] = [];
  const idx: number[] = [];
  const x0 = LION.x - 0.04;
  // terrace platform
  pushBox(out, idx, [x0, LION.y - 0.05, -0.2], [x0 + 0.34, LION.y, 0.2]);
  // the two paws flanking the stairway
  for (const side of [-1, 1]) {
    const zc = side * 0.1;
    pushBox(
      out,
      idx,
      [x0 + 0.18, LION.y, zc - 0.045],
      [x0 + 0.32, LION.y + 0.05, zc + 0.045],
    );
    // claws
    for (let c = -1; c <= 1; c++) {
      pushBox(
        out,
        idx,
        [x0 + 0.32, LION.y, zc + c * 0.028 - 0.009],
        [x0 + 0.345, LION.y + 0.022, zc + c * 0.028 + 0.009],
      );
    }
  }
  // summit palace blocks
  const blocks: [number, number, number, number][] = [
    [-0.42, 0.08, 0.16, 0.12],
    [-0.12, 0.2, 0.12, 0.1],
    [0.4, 0.05, 0.14, 0.16],
    [-0.3, -0.25, 0.18, 0.08],
    [0.62, -0.18, 0.1, 0.1],
  ];
  for (const [x, z, hx, hz] of blocks) {
    const y = summitHeight(x, z);
    pushBox(
      out,
      idx,
      [x - hx, y - 0.01, z - hz],
      [x + hx, y + 0.03, z + hz],
      4,
    );
  }
  return { vertices: new Float32Array(out), indices: new Uint32Array(idx) };
}

/* Zig-zag stairway climbing the north face from the Lion Terrace to the summit. */
export function stairPolyline(): Vec3[] {
  const points: Vec3[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const zOffset = (i % 2 === 0 ? -1 : 1) * 0.07;
    const theta = Math.atan2(zOffset, ROCK.halfLength);
    const y = LION.y + ((rimHeight(theta) - 0.02 - LION.y) * i) / steps;
    const p = cliffPoint(theta, cliffV(theta, y));
    points.push([p[0] + 0.015, p[1], p[2]]);
  }
  return points;
}

/* The Mirror Wall gallery: a ledge hugging the west face. */
export function mirrorWallPolyline(): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= 48; i++) {
    const k = i / 48;
    const theta = (Math.PI / 180) * (134 - k * 82);
    const p = cliffPoint(theta, cliffV(theta, 0.54 + k * 0.14));
    const outward = 1.025;
    points.push([p[0] * outward, p[1], p[2] * outward]);
  }
  return points;
}

/* Horizontal slice of the rock at height y, used for the laser scan ring. */
export function sliceRing(y: number, count = 160): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= count; i++) {
    const theta = (i / count) * TAU;
    const base = baseHeight(theta);
    let p: Vec3;
    if (y <= base) {
      // invert the mound profile y = base * (1 - (1 - m)^1.9)
      const m = 1 - Math.pow(Math.max(0, 1 - Math.max(0, y) / base), 1 / 1.9);
      p = moundPoint(theta, Math.min(1, Math.max(0, m)));
      p = [p[0] * 1.01, y, p[2] * 1.01];
    } else {
      const v = Math.min(1, cliffV(theta, y));
      p = cliffPoint(theta, v);
      p = [p[0] * 1.012, y, p[2] * 1.012];
    }
    points.push(p);
  }
  return points;
}

/* Point cloud of the jungle canopy around the base. Interleaved: xyz, seed. */
export function buildForest(count = 2600): Float32Array {
  const out = new Float32Array(count * 4);
  let n = 0;
  let attempt = 0;
  while (n < count && attempt < count * 6) {
    attempt++;
    const theta = hash(attempt * 1.37) * TAU;
    const pick = hash(attempt * 2.71);
    const onMound = pick < 0.6;
    const onSummit = pick > 0.9;
    let p: Vec3;
    if (onSummit) {
      // the summit gardens still carry trees today
      const u = Math.sqrt(hash(attempt * 6.3)) * 0.82;
      const edge = cliffPoint(theta, 1);
      const x = SHEAR[0] + (edge[0] - SHEAR[0]) * u;
      const z = SHEAR[1] + (edge[2] - SHEAR[1]) * u;
      if (Math.abs(x - 0.18) < 0.2 && Math.abs(z + 0.22) < 0.15) continue;
      p = [x, summitHeight(x, z), z];
    } else if (onMound) {
      p = moundPoint(theta, Math.pow(hash(attempt * 3.13), 0.8) * 0.96);
    } else {
      const r =
        planRadius(theta) * (ROCK.moundSpread + hash(attempt * 5.9) * 1.1);
      p = [Math.cos(theta) * r, 0, Math.sin(theta) * r];
      // keep the water gardens clear
      if (p[2] > 1.18 && Math.abs(p[0]) < 2.85) continue;
    }
    const canopy = 0.012 + hash(attempt * 9.1) * 0.05;
    out[n * 4] = p[0];
    out[n * 4 + 1] = p[1] + canopy;
    out[n * 4 + 2] = p[2];
    out[n * 4 + 3] = hash(attempt * 4.4);
    n++;
  }
  return out.subarray(0, n * 4);
}

/* Fountains of the Sigiriya fountain garden: pairs along the central axis. */
export function fountainEmitters(): Vec3[] {
  const emitters: Vec3[] = [];
  for (let k = 0; k < 6; k++) {
    const z = 3.98 + k * 0.165;
    emitters.push([-0.32, 0.0, z], [0.32, 0.0, z]);
  }
  return emitters;
}

/* Fountain particles: xyz emitter, seed. Motion is computed on the GPU. */
export function buildFountainParticles(perEmitter = 46): Float32Array {
  const emitters = fountainEmitters();
  const out = new Float32Array(emitters.length * perEmitter * 4);
  let o = 0;
  emitters.forEach((emitter, e) => {
    for (let i = 0; i < perEmitter; i++) {
      out[o++] = emitter[0];
      out[o++] = emitter[1];
      out[o++] = emitter[2];
      out[o++] = hash(e * 97.1 + i * 13.7);
    }
  });
  return out;
}

/* Floating motes of light that give the void depth. */
export function buildMotes(count = 260): Float32Array {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    out[i * 4] = (hash(i * 1.1) - 0.5) * 9;
    out[i * 4 + 1] = 0.15 + hash(i * 2.3) * 3.2;
    out[i * 4 + 2] = (hash(i * 3.7) - 0.5) * 12 + 1.5;
    out[i * 4 + 3] = hash(i * 7.9);
  }
  return out;
}

/* World-space anchors for the HUD call-outs. */
export const ANCHORS: Record<string, Vec3> = {
  gardens: [0.6, 0.02, 1.5],
  lion: [0, 0, 0],
  summit: [0.18, ROCK.topY + 0.1, -0.22],
  mirror: [0, 0, 0],
};

ANCHORS.lion = [LION.x + 0.2, LION.y + 0.03, 0];
{
  const v = (0.58 - ROCK.baseY) / (ROCK.topY - ROCK.baseY);
  const p = cliffPoint(Math.PI / 2, v);
  ANCHORS.mirror = [p[0], p[1], p[2] * 1.03];
}
