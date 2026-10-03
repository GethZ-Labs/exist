/* Shared GLSL snippets for every intro shader. */

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
`;

export const FULLSCREEN_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const COMMON = /* glsl */ `
const vec3 INK = vec3(0.0196, 0.0235, 0.0157);
const vec3 INK2 = vec3(0.0431, 0.0471, 0.0314);
const vec3 LIME = vec3(0.8588, 0.9961, 0.0039);
const vec3 LIME_SOFT = vec3(0.9137, 1.0, 0.4196);
const vec3 LIME_DEEP = vec3(0.6078, 0.7373, 0.0);
const vec3 PAPER = vec3(0.9451, 0.9569, 0.902);
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amplitude * vnoise(p);
    p = rot * p * 2.03 + 17.17;
    amplitude *= 0.5;
  }
  return value;
}

float fbm3(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    value += amplitude * vnoise(p);
    p = rot * p * 2.03 + 17.17;
    amplitude *= 0.5;
  }
  return value;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/* Anti-aliased repeating line, ~1px wide regardless of distance. */
float gridLine(float x, float width) {
  float w = fwidth(x) * width;
  float d = abs(fract(x + 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, max(w, 1e-5), d);
}

float gridLine2(vec2 p, float width) {
  vec2 w = fwidth(p) * width;
  vec2 d = abs(fract(p + 0.5) - 0.5);
  vec2 l = 1.0 - smoothstep(vec2(0.0), max(w, vec2(1e-5)), d);
  return max(l.x, l.y);
}

vec3 ditherColor(vec3 color, vec2 fragCoord, float time) {
  float n = hash12(fragCoord + fract(time * 7.13) * 113.7) + hash12(fragCoord * 1.37 - 41.0) - 1.0;
  return color + n / 255.0;
}
`;
