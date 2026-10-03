/* All GLSL programs used by the intro. */

import { COMMON, HEADER } from "./glsl";

/* ------------------------------------------------------------------ */
/* GATE: liquid light field (rendered small, then refracted by glass)  */
/* ------------------------------------------------------------------ */

export const GATE_LIGHT_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform vec2 uViewport;
uniform float uTime;
uniform vec2 uPointer;
uniform float uEnergy;
uniform vec3 uRing;
uniform float uLens;
uniform float uCharge;

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uViewport;
  float m = min(uViewport.x, uViewport.y);
  float t = uTime;
  vec2 q = p / m;
  vec2 warp = vec2(fbm3(q * 1.25 + vec2(0.0, t * 0.045)), fbm3(q * 1.25 + vec2(5.2, -t * 0.04)));
  float liquid = fbm(q * 1.8 + warp * 1.9 + vec2(t * 0.025, -t * 0.018));

  vec2 c1 = uViewport * vec2(0.17 + 0.06 * sin(t * 0.11), 0.25 + 0.05 * cos(t * 0.13));
  vec2 c2 = uViewport * vec2(0.85 + 0.05 * cos(t * 0.09), 0.76 + 0.06 * sin(t * 0.1));
  float blobs = 0.0;
  blobs += 0.62 * exp(-pow(length(p - c1) / (0.5 * m), 2.0));
  blobs += 0.46 * exp(-pow(length(p - c2) / (0.46 * m), 2.0));
  blobs += (0.34 + 0.5 * uEnergy) * exp(-pow(length(p - uPointer) / (0.22 * m), 2.0));
  blobs += 0.1 * uLens * exp(-pow(length(p - uRing.xy) / max(uRing.z * 0.85, 1.0), 2.0));
  float across = 1.0 - pow(min(abs(p.x - uViewport.x * 0.5) / (uViewport.x * 0.48), 1.0), 3.0);
  float bar = exp(-pow((p.y - uViewport.y * 0.5) / (0.05 * m), 2.0)) * across;
  blobs += uCharge * 0.48 * bar;

  float field = blobs * (0.35 + 1.15 * liquid);
  float ridges = pow(1.0 - abs(liquid * 2.0 - 1.0), 8.0);
  field += ridges * 0.22 * blobs;

  vec3 col = INK;
  col += LIME_DEEP * 0.035 * field;
  col += LIME * 0.3 * pow(field, 2.4);
  col += LIME_SOFT * 0.14 * pow(field, 5.0);
  outColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* GATE: reeded glass + clear glass lens + shockwave + shatter         */
/* ------------------------------------------------------------------ */

export const GATE_COMPOSITE_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uLight;
uniform vec2 uViewport;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uRing;
uniform float uLens;
uniform float uSuccess;
uniform float uShatter;
uniform vec2 uOrigin;
uniform float uFade;

vec3 lightAt(vec2 p) {
  return texture(uLight, vec2(p.x / uViewport.x, 1.0 - p.y / uViewport.y)).rgb;
}

vec3 voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
      }
    }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      if (dot(mr - r, mr - r) > 0.00001) {
        md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
      }
    }
  }
  return vec3(md, n + mg);
}

vec3 glassAt(vec2 p, float lensMask, vec2 lensOffset) {
  float fw = uViewport.x > 900.0 ? 24.0 : 18.0;
  float f = fract(p.x / fw) - 0.5;
  float curve = sin(f * PI);
  vec2 off = mix(vec2(curve * fw * 0.95, 0.0), lensOffset, lensMask);
  float disp = mix(0.07, 0.16, lensMask);
  vec3 col;
  col.r = lightAt(p + off * (1.0 + disp)).r;
  col.g = lightAt(p + off).g;
  col.b = lightAt(p + off * (1.0 - disp)).b;
  float reed = 1.0 - lensMask;
  float seam = 1.0 - smoothstep(0.0, 0.07, 0.5 - abs(f));
  col *= 1.0 - 0.45 * seam * reed;
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  float spec = exp(-pow((f + 0.26) / 0.07, 2.0));
  col += mix(PAPER, LIME_SOFT, 0.4) * spec * (0.012 + lum * 0.35) * reed;
  col *= mix(1.0, 0.9 + 0.1 * (-curve), reed);
  return col;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (uViewport.x / uRes.x);
  vec2 sp = p;
  float alpha = 1.0;
  float crack = 0.0;
  float shardFade = 0.0;
  float glint = 0.0;

  if (uShatter > 0.0) {
    float cs = uViewport.x > 900.0 ? 120.0 : 80.0;
    vec3 v = voronoi(p / cs);
    vec2 id = v.yz;
    vec2 center = (id + hash22(id)) * cs;
    float dist = length(center - uOrigin) / length(uViewport);
    float h = hash12(id * 1.7 + 3.1);
    float crackT = smoothstep(dist * 1.1, dist * 1.1 + 0.12, uShatter * 1.5);
    float fallT = clamp((uShatter * 1.9 - 0.3 - dist * 1.2 - h * 0.3) / 0.5, 0.0, 1.0);
    float ang = (h - 0.5) * 0.9 * fallT;
    vec2 rel = p - center;
    rel = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * rel;
    sp = center + rel * (1.0 + 0.15 * fallT) - vec2((h - 0.5) * 60.0 * fallT, 260.0 * fallT * fallT);
    float edge = 1.0 - smoothstep(0.0, 1.3 / cs, v.x);
    crack = edge * crackT * (1.0 + 1.5 * exp(-pow((uShatter * 1.5 - dist * 1.1 - 0.06) / 0.05, 2.0)));
    shardFade = fallT;
    alpha = 1.0 - smoothstep(0.55, 1.0, fallT);
    glint = pow(max(0.0, sin(ang * 7.0 + h * 25.0 + rel.x * 0.02)), 10.0) * fallT * (1.0 - fallT) * 4.0;
  }

  vec2 d = sp - uRing.xy;
  float r = length(d);
  float R = max(uRing.z, 1.0);
  float lensMask = (1.0 - smoothstep(R - 1.5, R + 1.5, r)) * uLens;
  float dome = sqrt(max(0.0, 1.0 - (r * r) / (R * R)));
  vec2 lensOffset = -d * 0.32 * dome;

  float wave = 0.0;
  float rw = R + uSuccess * length(uViewport) * 0.95;
  if (uSuccess > 0.0 && uSuccess < 1.0) {
    wave = exp(-pow((r - rw) / 46.0, 2.0)) * (1.0 - uSuccess);
    sp += normalize(d + 1e-4) * 34.0 * wave;
  }

  vec3 col = glassAt(sp, lensMask, lensOffset);

  float rim = exp(-pow((r - R) / 1.1, 2.0)) * uLens;
  col += mix(PAPER, LIME, 0.35) * rim * 0.5;
  // thick glass: darker body, inner shadow, crescent highlight, lime caustic edge
  col *= 1.0 - 0.32 * lensMask;
  col *= 1.0 - 0.35 * exp(-pow((R - r) / 14.0, 2.0)) * lensMask;
  vec2 dn = d / max(r, 1e-3);
  float crescent = exp(-pow((r - R * 0.84) / (R * 0.05), 2.0)) * smoothstep(0.25, 0.95, dot(dn, normalize(vec2(-0.72, -0.69))));
  col += PAPER * crescent * 0.16 * lensMask;
  col += LIME * 0.1 * pow(clamp(r / R, 0.0, 1.0), 10.0) * lensMask;
  float caustic = exp(-pow((r - R * 0.6) / (R * 0.2), 2.0)) * smoothstep(-0.2, 0.9, dot(dn, normalize(vec2(0.6, 0.8))));
  col += LIME * caustic * 0.05 * lensMask;

  if (uSuccess > 0.0 && uSuccess < 1.0) {
    col += LIME * 0.6 * exp(-pow((r - rw) / 5.0, 2.0)) * (1.0 - uSuccess);
  }

  vec2 vq = (p - uViewport * 0.5) / uViewport.y;
  col *= 0.62 + 0.38 * smoothstep(1.25, 0.15, length(vq));

  col *= 1.0 - shardFade * 0.75;
  col += mix(PAPER, LIME, 0.78) * crack * 0.42 * (1.0 - shardFade);
  col += mix(PAPER, LIME_SOFT, 0.5) * glint * 0.35;
  col *= uFade;
  outColor = vec4(col * alpha, alpha);
}
`;

/* ------------------------------------------------------------------ */
/* WORLD: sky, liquid surface, blueprint ground and the water gardens  */
/* ------------------------------------------------------------------ */

export const WORLD_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform mat4 uInvViewProj;
uniform float uTime;
uniform float uWater;
uniform float uFront;
uniform float uGarden;
uniform float uLead;
uniform float uFill;
uniform float uLotus;
uniform float uPulse;
uniform float uGrid;
uniform float uDim;
uniform float uEnv;
uniform vec3 uRipples[6];

/* The lake south-west of the rock — mirrors LAKE in gl/environment.ts. */
const vec2 LAKE_C = vec2(-3.05, 0.55);
const vec2 LAKE_R = vec2(1.25, 0.95);

const vec3 LOTUS[13] = vec3[13](
  vec3(-0.7, 5.05, 0.085), vec3(-0.42, 5.25, 0.07), vec3(0.7, 5.08, 0.08), vec3(0.43, 5.24, 0.065),
  vec3(-0.68, 6.08, 0.08), vec3(-0.44, 5.9, 0.07), vec3(0.69, 5.92, 0.085), vec3(0.45, 6.1, 0.07),
  vec3(1.25, 3.18, 0.09), vec3(0.85, 3.24, 0.075), vec3(-1.25, 3.22, 0.09), vec3(-0.86, 3.16, 0.075),
  vec3(1.32, 2.02, 0.13)
);

vec3 skyColor(vec3 d) {
  float up = max(d.y, 0.0);
  vec3 c = INK;
  c += LIME * 0.085 * exp(-up * 16.0);
  c += LIME_DEEP * 0.025 * exp(-up * 3.5);
  return c;
}

float sdBox(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdOct(vec2 p, vec2 c, float r) {
  const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  p = abs(p - c);
  p -= 2.0 * min(dot(vec2(k.x, k.y), p), 0.0) * vec2(k.x, k.y);
  p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void gardenSdf(vec2 p, out float pool, out float lines, out float stones) {
  float outer = abs(sdBox(p, vec2(0.0, 3.95), vec2(2.6, 2.65))) - 0.075;
  float inner = abs(sdBox(p, vec2(0.0, 3.95), vec2(2.25, 2.35))) - 0.05;
  pool = min(outer, inner);
  pool = min(pool, sdBox(p, vec2(-0.56, 5.15), vec2(0.4, 0.36)));
  pool = min(pool, sdBox(p, vec2(0.56, 5.15), vec2(0.4, 0.36)));
  pool = min(pool, sdBox(p, vec2(-0.56, 6.0), vec2(0.4, 0.36)));
  pool = min(pool, sdBox(p, vec2(0.56, 6.0), vec2(0.4, 0.36)));
  pool = min(pool, sdBox(p, vec2(-0.32, 4.4), vec2(0.085, 0.5)));
  pool = min(pool, sdBox(p, vec2(0.32, 4.4), vec2(0.085, 0.5)));
  pool = min(pool, sdBox(p, vec2(1.06, 3.2), vec2(0.55, 0.28)));
  pool = min(pool, sdBox(p, vec2(-1.06, 3.2), vec2(0.55, 0.28)));
  pool = min(pool, sdOct(p, vec2(1.32, 2.02), 0.24));

  float axis = abs(abs(p.x) - 0.075);
  axis = max(axis, max(1.3 - p.y, p.y - 6.62));
  float cross1 = abs(p.y - 5.575) + max(abs(p.x) - 0.98, 0.0) * 10.0;
  float terrace = abs(sdBox(p, vec2(0.0, 3.2), vec2(1.72, 0.42)));
  lines = min(axis, min(cross1, terrace));

  stones = 1000.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    vec2 c = vec2(-1.75 + hash12(vec2(fi, 2.0)) * 2.6, 1.42 + hash12(vec2(fi, 9.0)) * 1.0);
    if (abs(c.x) < 0.16) c.x += 0.32;
    float r = 0.045 + hash12(vec2(fi, 5.0)) * 0.09;
    stones = min(stones, length(p - c) - r);
  }
}

float lakeSdf(vec2 p) {
  vec2 q = (p - LAKE_C) / LAKE_R;
  float a = atan(q.y, q.x);
  float edge = 1.0 + 0.05 * sin(a * 2.0 + 0.6) + 0.035 * sin(a * 3.0 + 1.3) + 0.015 * sin(a * 7.0 + 2.0);
  return (length(q) - edge) * 0.95;
}

float lotusSdf(vec2 p, vec2 c, float size, float rot, float bloom) {
  vec2 d = p - c;
  float r = length(d);
  float a = atan(d.y, d.x) + rot;
  float outerPetals = size * bloom * (0.48 + 0.52 * pow(abs(cos(a * 4.0)), 0.55));
  float innerPetals = size * 0.56 * bloom * (0.48 + 0.52 * pow(abs(sin(a * 4.0)), 0.55));
  return min(abs(r - outerPetals), abs(r - innerPetals));
}

vec3 waterNormal(vec2 p, float dist) {
  float t = uTime;
  vec2 g = vec2(0.0);
  float fade = exp(-dist * 0.04);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ang = 0.55 + fi * 2.39996;
    vec2 dir = vec2(cos(ang), sin(ang));
    float k = 2.0 + fi * 1.7;
    float w = sqrt(9.8 * k) * 0.5;
    float a = 0.05 / (1.0 + fi * 0.85);
    float ph = dot(dir, p) * k - w * t + fi * 1.7;
    g += a * k * cos(ph) * dir;
  }
  g *= fade;
  for (int i = 0; i < 6; i++) {
    vec3 R = uRipples[i];
    if (R.z < 0.0) continue;
    float age = t - R.z;
    if (age <= 0.0) continue;
    vec2 d = p - R.xy;
    float r = length(d) + 1e-4;
    float front = age * 1.1;
    float env = exp(-pow((r - front) / 0.4, 2.0)) * exp(-age * 0.45);
    g += (d / r) * cos(r * 15.0 - age * 10.0) * env * 0.9;
  }
  g += (vec2(vnoise(p * 7.0 + t * 0.6), vnoise(p * 7.0 - t * 0.5 + 9.1)) - 0.5) * 0.16 * fade;
  return normalize(vec3(-g.x, 1.0, -g.y));
}

vec3 shadeWater(vec2 p, vec3 dir, float dist, float glow) {
  vec3 n = waterNormal(p, dist);
  vec3 r = reflect(dir, n);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-dir, n), 0.0), 5.0);
  vec3 sky = skyColor(r);
  vec3 L1 = normalize(vec3(-0.25, 0.12, -1.0));
  vec3 L2 = normalize(vec3(0.5, 0.07, -1.0));
  float sparkle = pow(max(dot(r, L1), 0.0), 900.0) * 3.2 + pow(max(dot(r, L2), 0.0), 650.0) * 2.4;
  sparkle += pow(max(dot(r, L1), 0.0), 48.0) * 0.08;
  vec3 col = mix(INK * 0.75, sky, fres);
  col += LIME_SOFT * sparkle * (0.35 + fres);
  col += LIME * glow * (0.05 + 0.12 * fres);
  return col;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 a = uInvViewProj * vec4(ndc, -1.0, 1.0);
  vec4 b = uInvViewProj * vec4(ndc, 1.0, 1.0);
  vec3 ro = a.xyz / a.w;
  vec3 rd = normalize(b.xyz / b.w - ro);

  float down = max(-rd.y, 0.0008);
  float tHit = ro.y / down;
  vec3 hit = ro + rd * tHit;
  vec2 p = hit.xz;
  float dist = tHit;
  float pw = length(fwidth(p));

  vec3 ground = INK * 1.05;
  float fres = pow(1.0 - down, 5.0);
  ground += LIME * 0.03 * fres;
  float minor = gridLine2(p * 4.0, 1.0) * 0.04;
  float major = gridLine2(p, 1.0) * 0.085;
  ground += LIME * (minor + major) * exp(-dist * 0.09) * uGrid;

  float pool;
  float lines;
  float stones;
  gardenSdf(p, pool, lines, stones);
  float inBounds = step(abs(p.x), 3.2) * step(1.0, p.y) * step(p.y, 7.0);
  float reveal = smoothstep(uFront - 0.02, uFront + 0.3, p.y) * uGarden * inBounds;
  float lead = exp(-pow((p.y - uFront) / 0.07, 2.0)) * uLead * inBounds * step(abs(p.x), 2.7);

  float outline = 1.0 - smoothstep(0.0, pw * 1.4, abs(pool));
  float pathLine = 1.0 - smoothstep(0.0, pw * 1.2, lines);
  float stoneLine = 1.0 - smoothstep(0.0, pw * 1.2, abs(stones));
  float halo = exp(-abs(pool) / (pw * 7.0 + 0.012)) * 0.35;

  float fillMask = smoothstep(uFront + 0.25, uFront + 0.9, p.y) * uFill * inBounds;
  float poolWater = (1.0 - smoothstep(-pw, pw, pool)) * fillMask;

  float waterMask = max(uWater, poolWater);
  vec3 water = shadeWater(p, rd, dist, poolWater);
  vec3 floorCol = mix(ground, water, waterMask);

  float pulse = pow(0.5 + 0.5 * sin(p.y * 2.4 + uTime * 2.8 + p.x * 0.4), 28.0) * uPulse;
  float lineGlow = (outline * 0.75 + halo) * reveal + pathLine * 0.45 * reveal + stoneLine * 0.35 * reveal;
  floorCol += LIME * lineGlow * (0.55 + 1.6 * pulse);
  floorCol += LIME_SOFT * lead * 0.9;

  if (uLotus > 0.0) {
    for (int i = 0; i < 13; i++) {
      vec3 L = LOTUS[i];
      float local = clamp(uLotus * 1.5 - float(i) * 0.035, 0.0, 1.0);
      float bloom = 1.0 - pow(1.0 - local, 3.0) + sin(local * PI) * 0.12;
      if (local <= 0.0) continue;
      float ld = lotusSdf(p, L.xy, L.z, uTime * 0.12 + float(i), bloom);
      float lw = pw * 1.3;
      float petal = 1.0 - smoothstep(0.0, lw, ld);
      float core = 1.0 - smoothstep(L.z * 0.12 * bloom, L.z * 0.12 * bloom + lw, length(p - L.xy));
      floorCol += LIME * (petal * 0.9 + core * 1.4) * fillMask;
      floorCol += LIME * 0.08 * exp(-length(p - L.xy) / (L.z * 0.9)) * bloom * fillMask;
    }
  }

  // the lotus lake: dark mirror water, a soft shore line, lily pads and a few flowers
  if (uEnv > 0.001) {
    float ld = lakeSdf(p);
    float lakeIn = (1.0 - smoothstep(-pw, pw, ld)) * uEnv;
    floorCol = mix(floorCol, water, lakeIn);
    float shore = 1.0 - smoothstep(0.0, pw * 1.5, abs(ld));
    float shoreGlow = exp(-abs(ld) / (pw * 8.0 + 0.015));
    float depthLine = gridLine(-ld / 0.16, 1.0) * step(ld, -0.04);
    floorCol += LIME * (shore * 0.32 + shoreGlow * 0.08 + depthLine * 0.04) * uEnv;
    if (ld < 0.0) {
      for (int i = 0; i < 18; i++) {
        float fi = float(i);
        vec2 c = LAKE_C + (hash22(vec2(fi, 4.7)) * 2.0 - 1.0) * LAKE_R * 0.72;
        float r = 0.045 + hash12(vec2(fi, 1.9)) * 0.05;
        vec2 d = p - c;
        float dl = length(d);
        if (dl > r * 2.2) continue;
        float ang = atan(d.y, d.x) + fi * 1.7;
        float notch = smoothstep(0.18, 0.32, abs(mod(ang + PI, TAU) - PI));
        float pad = (1.0 - smoothstep(0.0, pw * 1.2, abs(dl - r))) * notch;
        float padFill = (1.0 - smoothstep(r - pw, r + pw, dl)) * 0.06;
        floorCol += LIME * (pad * 0.45 + padFill) * lakeIn;
        if (mod(fi, 3.0) < 0.5) {
          float bloom = 0.85 + 0.15 * sin(uTime * 0.6 + fi);
          float fl = lotusSdf(p, c + vec2(r * 0.15, -r * 0.1), r * 0.85, uTime * 0.08 + fi, bloom);
          floorCol += LIME_SOFT * (1.0 - smoothstep(0.0, pw * 1.3, fl)) * 0.7 * lakeIn;
          floorCol += LIME * 0.05 * exp(-dl / (r * 0.8)) * lakeIn;
        }
      }
    }
  }

  float fogF = exp(-dist * 0.05);
  floorCol = mix(skyColor(rd), floorCol, fogF * 0.85 + 0.15);

  float isFloor = smoothstep(0.0, 0.003, -rd.y);
  vec3 col = mix(skyColor(rd), floorCol, isFloor);
  col *= 1.0 - uDim * 0.65;
  outColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* ROCK: Sigiriya as a black-glass hologram with lime wireframe        */
/* ------------------------------------------------------------------ */

export const ROCK_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aParam;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vParam;
void main() {
  vWorld = aPos;
  vNormal = aNormal;
  vParam = aParam;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const ROCK_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vParam;
out vec4 outColor;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uBuild;
uniform float uDim;
uniform float uSummit;
uniform float uScanY;
uniform float uVisible;

void main() {
  float buildY = uBuild * 1.78 - 0.06;
  if (vWorld.y > buildY + 0.0005) discard;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uCamPos - vWorld);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float region = vParam.z;
  vec3 col = INK2 * (0.7 + 0.6 * diff);

  float wire = 0.0;
  if (region < 0.5) {
    float rings = gridLine(vWorld.y / 0.05, 1.0);
    float meridians = gridLine(vParam.x * 48.0 / TAU, 1.0);
    wire = max(rings, meridians) * 0.26;
    col *= 0.78;
  } else if (region < 1.5) {
    float flutes = gridLine(vParam.x * 96.0 / TAU + 0.6 * sin(vParam.x * 5.0), 1.0);
    float strata = gridLine((vWorld.y + 0.02 * sin(vParam.x * 7.0) + 0.012 * sin(vParam.x * 23.0)) / 0.075, 1.0);
    float fine = gridLine(vParam.x * 288.0 / TAU, 0.7) * 0.22;
    float streaks = smoothstep(0.55, 0.95, vnoise(vec2(vParam.x * 40.0, vWorld.y * 1.5))) * 0.35;
    wire = max(max(flutes * 0.85, strata * 0.32), max(fine, streaks));
    float west = max(0.0, n.z);
    float fresco = smoothstep(0.62, 0.7, vWorld.y) * (1.0 - smoothstep(0.86, 0.95, vWorld.y)) * pow(west, 3.0);
    col += LIME * fresco * 0.035;
  } else if (region < 2.5) {
    vec2 q = vWorld.xz;
    float contour = gridLine(vWorld.y / 0.026, 1.0);
    float palace = gridLine2(q / 0.09, 1.0) * 0.45;
    wire = max(contour * 0.9, palace);
    vec2 pd = abs(q - vec2(0.18, -0.22)) - vec2(0.16, 0.11);
    float poolD = length(max(pd, 0.0)) + min(max(pd.x, pd.y), 0.0);
    float pw = length(fwidth(q));
    float poolIn = 1.0 - smoothstep(-pw, pw, poolD);
    float poolEdge = 1.0 - smoothstep(0.0, pw * 1.5, abs(poolD));
    float shimmer = 0.5 + 0.5 * sin(q.x * 60.0 + uTime * 2.0) * sin(q.y * 70.0 - uTime * 1.6);
    col = mix(col, INK + LIME * (0.07 + 0.09 * shimmer) * (0.45 + uSummit), poolIn);
    wire = max(wire * (1.0 - poolIn), poolEdge * (1.1 + uSummit));
  } else if (region < 4.5) {
    wire = gridLine2(vec2(vWorld.x + vWorld.z, vWorld.y) / 0.03, 1.0) * 0.6;
    col += LIME * 0.05;
  } else if (region < 5.5) {
    // the lion statue: courses of brick
    wire = gridLine(vWorld.y / 0.016, 1.0) * 0.4;
    col *= 0.85;
  } else {
    // elephants: fine contour slices
    wire = gridLine(vWorld.y / 0.0105, 1.0) * 0.5;
    col *= 0.8;
  }

  float quiet = region > 5.5 ? 0.85 : region > 4.5 ? 0.72 : 1.0;
  float lit = 0.12 + 0.55 * diff + 0.55 * fres;
  col += LIME * wire * lit * quiet;
  col += LIME * fres * 0.3 * quiet;

  float cut = exp(-abs(buildY - vWorld.y) / 0.01) * (1.0 - step(0.999, uBuild));
  col += LIME_SOFT * cut * 2.2;
  float sweep = exp(-pow((vWorld.y - uScanY) / 0.025, 2.0)) * step(0.0, uScanY);
  col += LIME * sweep * 0.5;

  col *= 1.0 - uDim * 0.7;
  outColor = vec4(col * uVisible, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* POINTS: jungle canopy, fountain jets, floating motes                 */
/* ------------------------------------------------------------------ */

export const POINTS_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec4 aData;
uniform mat4 uViewProj;
uniform float uTime;
uniform float uMode;
uniform float uBuildY;
uniform float uAmount;
uniform float uPxScale;
uniform float uSize;
out float vAlpha;
out float vTint;
void main() {
  vec3 p = aData.xyz;
  float seed = aData.w;
  float alpha = uAmount;
  float size = uSize;
  if (uMode < 0.5) {
    float appear = smoothstep(p.y - 0.02, p.y + 0.06, uBuildY);
    alpha *= appear * (0.35 + 0.65 * fract(seed * 7.31)) * (0.75 + 0.25 * sin(uTime * 1.7 + seed * 40.0));
    size *= 0.7 + fract(seed * 3.7) * 0.9;
    vTint = fract(seed * 11.0);
  } else if (uMode < 1.5) {
    float life = 1.15;
    float age = mod(uTime + seed * life * 7.0, life);
    float k = age / life;
    vec2 spread = vec2(fract(seed * 13.1) - 0.5, fract(seed * 7.7) - 0.5) * 0.22;
    float vy = 0.78 + fract(seed * 3.3) * 0.32;
    p += vec3(spread.x * age, vy * age - 0.8 * age * age, spread.y * age);
    alpha *= (1.0 - k) * step(0.0, p.y) * (0.6 + 0.4 * fract(seed * 5.0));
    size *= 0.6 + (1.0 - k) * 0.8;
    vTint = 1.0;
  } else {
    p += vec3(sin(uTime * 0.21 + seed * 10.0) * 0.25, sin(uTime * 0.13 + seed * 7.0) * 0.12, cos(uTime * 0.17 + seed * 5.0) * 0.25);
    alpha *= 0.18 + 0.22 * (0.5 + 0.5 * sin(uTime * 0.9 + seed * 20.0));
    size *= 0.6 + fract(seed * 9.0);
    vTint = 0.5;
  }
  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_Position = clip;
  gl_PointSize = clamp(size * uPxScale / max(clip.w, 0.1), 1.0, 40.0);
  vAlpha = alpha;
}
`;

export const POINTS_FRAG = /* glsl */ `${HEADER}${COMMON}
in float vAlpha;
in float vTint;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  vec3 col = mix(LIME_DEEP, LIME_SOFT, vTint);
  outColor = vec4(col * a * vAlpha, a * vAlpha);
}
`;

/* ------------------------------------------------------------------ */
/* LINES: 3D polylines with a constant on-screen width                  */
/* ------------------------------------------------------------------ */

export const LINES_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aPrev;
layout(location = 2) in vec3 aNext;
layout(location = 3) in vec2 aMeta;
uniform mat4 uViewProj;
uniform vec2 uRes;
uniform float uWidth;
out float vSide;
out float vAlong;
void main() {
  vec4 c = uViewProj * vec4(aPos, 1.0);
  vec4 p = uViewProj * vec4(aPrev, 1.0);
  vec4 n = uViewProj * vec4(aNext, 1.0);
  vec2 sc = c.xy / max(c.w, 1e-4) * uRes * 0.5;
  vec2 sp = p.xy / max(p.w, 1e-4) * uRes * 0.5;
  vec2 sn = n.xy / max(n.w, 1e-4) * uRes * 0.5;
  vec2 dir = sn - sp;
  dir = length(dir) < 1e-5 ? vec2(1.0, 0.0) : normalize(dir);
  vec2 normal = vec2(-dir.y, dir.x);
  c.xy += normal * aMeta.x * uWidth * 0.5 / (uRes * 0.5) * c.w;
  gl_Position = c;
  vSide = aMeta.x;
  vAlong = aMeta.y;
}
`;

export const LINES_FRAG = /* glsl */ `${HEADER}${COMMON}
in float vSide;
in float vAlong;
out vec4 outColor;
uniform float uIntensity;
uniform float uProgress;
void main() {
  if (vAlong > uProgress) discard;
  float core = 1.0 - smoothstep(0.15, 0.55, abs(vSide));
  float glow = exp(-vSide * vSide * 4.0);
  float head = exp(-(uProgress - vAlong) * 40.0) * (1.0 - step(0.999, uProgress));
  vec3 col = LIME * (core * 0.85 + glow * 0.3) + LIME_SOFT * head * 1.6;
  outColor = vec4(col * uIntensity, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* POUR: the charged tube bursts and a liquid curtain falls             */
/* ------------------------------------------------------------------ */

export const POUR_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform vec2 uViewport;
uniform vec2 uRes;
uniform float uT;
uniform float uPitch;
uniform float uFocal;
uniform float uCamH;
uniform float uDist;
uniform float uBarY;
uniform float uHalf;
uniform float uFade;

const float G = 3.9;

float fallD(float tau) {
  return tau <= 0.0 ? 0.0 : 0.25 * tau + 0.5 * G * tau * tau;
}

vec2 planeAt(vec2 p) {
  float dx = p.x - uViewport.x * 0.5;
  float dy = uViewport.y * 0.5 - p.y;
  float c = cos(uPitch);
  float s = sin(uPitch);
  float dirY = dy * c + uFocal * s;
  float dirZ = -dy * s + uFocal * c;
  float k = uDist / max(dirZ, 1.0);
  return vec2(dx * k, uCamH + dirY * k);
}

float curtain(vec2 q, out float flowCoord) {
  float t = uT;
  float ax = abs(q.x);
  float nx = ax / uHalf;
  float start = 0.5 + 1.0 * pow(min(nx, 1.4), 1.25);
  float colW = uHalf * 2.0 / 19.0;
  float xw = q.x + (vnoise(vec2(q.x * 2.6, 4.0)) - 0.5) * colW * 1.1;
  float colId = floor((xw + uHalf) / colW);
  float hc = hash12(vec2(colId, 3.1));
  float stop = 2.25 + 0.8 * hc + 0.3 * nx;
  float front = uBarY - fallD(t - start);
  float tail = uBarY - fallD(t - stop);
  front -= (vnoise(vec2(q.x * 9.0, t * 1.1)) - 0.5) * 0.16 * smoothstep(0.0, 0.5, t - start);
  front -= pow(vnoise(vec2(q.x * 31.0, 7.0)), 3.0) * 0.35 * smoothstep(0.1, 0.8, t - start);
  float open = uHalf * smoothstep(0.3, 1.8, t);
  float yRel = max(uBarY - q.y, 0.0);
  float neck = mix(0.32, 1.0, smoothstep(0.4, 2.2, t));
  float halfW = min(open, uHalf) * mix(1.0, neck, smoothstep(0.0, 1.4, yRel));
  float d = max(ax - halfW, max(q.y - tail, front - q.y));
  d = max(d, uBarY - 0.004 - q.y < 0.0 ? 1.0 : -1.0);
  float breakT = smoothstep(2.1, 3.3, t);
  float local = abs(fract((xw + uHalf) / colW) - 0.5) * colW;
  float taper = mix(1.0, 0.55, smoothstep(uBarY, 0.0, q.y));
  float wiggle = 1.0 + 0.35 * sin(q.y * 9.0 + hc * 20.0 + t * 3.0);
  float streamHalf = mix(colW * 0.62, colW * (0.05 + 0.16 * hc) * taper * wiggle, breakT);
  d = max(d, local - streamHalf);
  flowCoord = yRel;
  return d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (uViewport.x / uRes.x);
  vec2 q = planeAt(p);
  float t = uT;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  float flow;
  float d = curtain(q, flow);
  float px = max(length(fwidth(q)), 1e-5);
  float dpx = d / px;
  float above = step(0.0, q.y);
  float cover = (1.0 - smoothstep(-1.0, 1.0, dpx)) * above;

  float streak = fbm3(vec2(q.x * 42.0, q.y * 2.2 + t * 4.6));
  float sheen = fbm3(vec2(q.x * 9.0 + 3.0, q.y * 0.9 + t * 2.2));
  vec3 liquid = mix(LIME_DEEP * 0.42, LIME, smoothstep(0.28, 0.78, streak));
  liquid = mix(liquid, LIME_SOFT, smoothstep(0.62, 0.95, sheen) * 0.55);
  float rim = exp(-abs(dpx + 1.5) / 2.2);
  liquid += LIME_SOFT * rim * 0.7;
  float body = smoothstep(-34.0, -3.0, dpx);
  liquid *= 0.7 + 0.3 * body;
  float thickness = 0.62 + 0.38 * smoothstep(0.2, 0.75, streak);
  col += liquid * cover * thickness;
  alpha = max(alpha, cover * thickness * 0.94);

  float halo = exp(-max(dpx, 0.0) / 22.0) * (1.0 - cover) * above;
  col += LIME * halo * 0.28;

  // splash where streams meet the water
  float flowAt;
  float dWater = curtain(vec2(q.x, 0.03), flowAt);
  float presence = 1.0 - smoothstep(-0.002, 0.004, dWater);
  float waterPx = q.y / px;
  col += LIME_SOFT * presence * exp(-abs(waterPx) / 3.5) * 0.9;
  col += LIME * presence * exp(-abs(waterPx) / 16.0) * 0.25;

  // reflection of the curtain in the water
  if (q.y < 0.0) {
    float wob = sin(q.y * 50.0 + t * 7.0) * 0.012 + sin(q.y * 23.0 - t * 4.0) * 0.01;
    float flowR;
    float dr = curtain(vec2(q.x + wob, -q.y * 1.4 + 0.01), flowR);
    float refl = (1.0 - smoothstep(-0.003, 0.01, dr)) * exp(q.y * 3.0);
    col += LIME * refl * 0.32;
  }

  // flash in the tube before it bursts
  float flash = exp(-pow((t - 0.45) / 0.22, 2.0));
  float barDist = abs(q.y - uBarY);
  col += LIME_SOFT * flash * exp(-barDist / 0.02) * exp(-abs(q.x) / (uHalf * 0.26)) * 0.85;
  col += LIME * flash * exp(-barDist / 0.005) * exp(-abs(q.x) / (uHalf * 1.1)) * 0.7;

  // droplets thrown up from the impact
  vec2 wpp = max(vec2(fwidth(q.x), fwidth(q.y)), vec2(1e-5));
  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    float x0 = (hash12(vec2(fi, 1.0)) * 2.0 - 1.0) * uHalf * 0.95;
    float nx = abs(x0) / uHalf;
    float hitT = 0.5 + pow(nx, 1.25) + 1.15 + hash12(vec2(fi, 2.0)) * 1.6;
    float tau = t - hitT;
    if (tau < 0.0 || tau > 0.9) continue;
    float vx = (hash12(vec2(fi, 3.0)) - 0.5) * 0.6;
    float vy = 0.5 + hash12(vec2(fi, 4.0)) * 0.7;
    vec2 dp = vec2(x0 + vx * tau, vy * tau - 0.5 * G * tau * tau);
    if (dp.y < 0.0) continue;
    float r = length((q - dp) / wpp);
    col += LIME_SOFT * exp(-r / 1.6) * (1.0 - tau / 0.9);
  }

  col *= uFade;
  alpha *= uFade;
  outColor = vec4(col, alpha);
}
`;

/* ------------------------------------------------------------------ */
/* FLOOD: lime liquid pours over the final statement                    */
/* ------------------------------------------------------------------ */

export const FLOOD_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uText;
uniform vec2 uViewport;
uniform vec2 uRes;
uniform float uT;

vec4 textAt(vec2 p) {
  return texture(uText, vec2(p.x / uViewport.x, 1.0 - p.y / uViewport.y));
}

/* Signed distance (px) to the lime liquid: three viscous pours, top drips, rising pool. */
float liquidSdf(vec2 p, float t) {
  float d = 1e5;
  float scale = clamp(uViewport.x / 1440.0, 0.45, 1.6);
  vec3 pourDefs[3] = vec3[3](vec3(0.5, 0.6, 1.0), vec3(0.17, 1.15, 0.85), vec3(0.83, 1.35, 0.92));
  for (int i = 0; i < 3; i++) {
    vec3 P = pourDefs[i];
    float tau = t - P.y;
    if (tau < 0.0) continue;
    float cx = P.x * uViewport.x;
    float front = -50.0 + 120.0 * tau + 0.5 * 1400.0 * tau * tau;
    float width = (26.0 + 110.0 * smoothstep(0.0, 1.6, tau) + 300.0 * smoothstep(1.3, 3.6, tau)) * P.z * scale;
    float taper = mix(1.0, 0.45, smoothstep(0.0, uViewport.y, p.y));
    taper = mix(taper, 1.0, smoothstep(1.6, 3.4, tau));
    float wob = (vnoise(vec2(p.y * 0.012 - tau * 1.3, float(i) * 7.0)) - 0.5) * 46.0 * scale;
    float halfW = width * taper;
    float stream = max(abs(p.x - cx - wob) - halfW, p.y - front);
    // rounded head of the falling stream
    stream = min(stream, length(vec2((p.x - cx - wob) * 0.9, p.y - front)) - halfW * 1.05);
    // short meniscus where the liquid enters from the top edge
    float lip = p.y - (8.0 + 46.0 * smoothstep(0.0, 1.8, tau)) * exp(-pow((p.x - cx) / (halfW * 1.8 + 1.0), 2.0));
    lip = max(lip, abs(p.x - cx) - halfW * 2.4);
    stream = smin(stream, lip, 26.0);
    d = smin(d, stream, 48.0);
  }
  // thin drips running down from the top edge between the pours
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float x = (0.07 + fi * 0.125 + (hash12(vec2(fi, 4.0)) - 0.5) * 0.05) * uViewport.x;
    float tau = t - (1.25 + hash12(vec2(fi, 8.0)) * 1.3);
    if (tau < 0.0) continue;
    float len = 30.0 + 520.0 * tau * tau;
    float w = (4.0 + 8.0 * hash12(vec2(fi, 2.0))) * scale;
    float drip = max(abs(p.x - x) - w * (1.0 - 0.6 * smoothstep(0.0, len, p.y)), p.y - len);
    drip = min(drip, length(p - vec2(x, len)) - w * 1.3);
    d = smin(d, drip, 14.0);
  }
  // pool rising from the bottom
  float level = uViewport.y + 60.0 - (uViewport.y + 220.0) * smoothstep(2.0, 5.2, t);
  float surf = level + (vnoise(vec2(p.x * 0.006 + t * 0.5, t * 0.3)) - 0.5) * 64.0 + sin(p.x * 0.016 - t * 2.6) * 10.0;
  d = smin(d, surf - p.y, 70.0);
  return d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (uViewport.x / uRes.x);
  float t = uT;

  // the statement melts: letters smear downward in drips
  float melt = smoothstep(1.0, 3.2, t);
  float column = floor(p.x / 3.0);
  float dripLen = (pow(hash12(vec2(column, 1.0)), 6.0) * 150.0 + vnoise(vec2(p.x * 0.05, 1.0)) * 18.0) * melt;
  vec2 tp = p + vec2(sin(p.y * 0.05 + t * 3.0) * melt * 1.6, 0.0);
  vec4 text = vec4(0.0);
  for (int k = 0; k < 6; k++) {
    float o = dripLen * float(k) / 5.0;
    vec4 s = textAt(tp - vec2(0.0, o));
    text = max(text, s * (1.0 - float(k) / 7.0));
  }
  vec3 outside = INK + text.rgb;

  float d = liquidSdf(p, t);
  float e = 1.5;
  vec2 grad = vec2(liquidSdf(p + vec2(e, 0.0), t) - d, liquidSdf(p + vec2(0.0, e), t) - d);
  vec2 nrm = normalize(grad + 1e-6);
  float inside = 1.0 - smoothstep(-1.0, 1.0, d);
  float depth = clamp(-d / 70.0, 0.0, 1.0);

  // liquid: exact brand lime in the body, deeper lime at the thin edge, glossy rim
  vec3 liquid = mix(LIME_DEEP, LIME, smoothstep(0.0, 0.45, depth));
  float streak = fbm3(vec2(p.x * 0.018, p.y * 0.004 - t * 1.6));
  liquid += (LIME_SOFT - LIME) * streak * 0.5 * (1.0 - depth);
  liquid = mix(liquid, vec3(1.0), exp(-abs(d + 3.5) / 2.4) * 0.28);
  float spec = pow(clamp(dot(nrm, normalize(vec2(-0.6, -0.8))), 0.0, 1.0), 10.0);
  spec *= smoothstep(0.0, 18.0, -d) * (1.0 - smoothstep(18.0, 48.0, -d));
  liquid = mix(liquid, vec3(1.0), spec * 0.22);
  // liquid glass: the statement is still visible, refracted, through the shallow edge
  vec2 refr = -nrm * 22.0 * (1.0 - depth);
  float seen = textAt(p + refr).a;
  liquid = mix(liquid, INK + LIME_DEEP * 0.2, seen * 0.5 * (1.0 - smoothstep(0.25, 1.0, depth)));

  float halo = exp(-max(d, 0.0) / 24.0) * 0.28;
  vec3 col = mix(outside + LIME * halo, liquid, inside);
  col = mix(col, LIME, smoothstep(5.2, 5.75, t));
  outColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* POST: bloom + final composite                                        */
/* ------------------------------------------------------------------ */

export const BRIGHT_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec3 c = texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.3, l);
  outColor = vec4(c * k, 1.0);
}
`;

export const BLUR_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.227027;
  c += texture(uTex, vUv + uDir * 1.3846154).rgb * 0.3162162;
  c += texture(uTex, vUv - uDir * 1.3846154).rgb * 0.3162162;
  c += texture(uTex, vUv + uDir * 3.2307692).rgb * 0.0702703;
  c += texture(uTex, vUv - uDir * 3.2307692).rgb * 0.0702703;
  outColor = vec4(c, 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `${HEADER}${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmount;
uniform float uFinalLime;
uniform float uTime;
uniform float uFade;
void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomAmount;
  c = min(c, vec3(1.0));
  c = ditherColor(c, gl_FragCoord.xy, uTime);
  c *= uFade;
  c = mix(c, LIME, uFinalLime);
  outColor = vec4(c, 1.0);
}
`;
