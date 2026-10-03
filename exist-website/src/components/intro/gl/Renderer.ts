/* Owns the WebGL2 context and draws every intro scene from a FrameState. */

import {
  createMesh,
  fullscreenTriangle,
  MultisampleTarget,
  Program,
  Target,
  type GL,
} from "./core";
import { FULLSCREEN_VERT } from "./glsl";
import {
  invert,
  smoothstep,
  lookAt,
  multiply,
  perspective,
  projectToScreen,
  type Mat4,
  type Vec3,
} from "./math";
import {
  BLUR_FRAG,
  BRIGHT_FRAG,
  COMPOSITE_FRAG,
  FLOOD_FRAG,
  GATE_COMPOSITE_FRAG,
  GATE_LIGHT_FRAG,
  LINES_FRAG,
  LINES_VERT,
  POINTS_FRAG,
  POINTS_VERT,
  POUR_FRAG,
  ROCK_FRAG,
  ROCK_VERT,
  WORLD_FRAG,
} from "./shaders";
import {
  buildElephants,
  buildLion,
  buildTrees,
  clearLake,
  mergeMeshes,
} from "./environment";
import {
  buildForest,
  buildFountainParticles,
  buildMotes,
  buildRockMesh,
  buildStructures,
  mirrorWallPolyline,
  sliceRing,
  stairPolyline,
} from "./sigiriya";

export type GateState = {
  pointer: [number, number];
  energy: number;
  ring: [number, number, number];
  lens: number;
  success: number;
  charge: number;
  shatter: number;
  origin: [number, number];
  fade: number;
};

export type CameraState = { eye: Vec3; target: Vec3; fov: number };

export type WorldState = {
  camera: CameraState;
  water: number;
  front: number;
  garden: number;
  lead: number;
  fill: number;
  lotus: number;
  pulse: number;
  grid: number;
  dim: number;
  ripples: Float32Array;
  build: number;
  rockVisible: number;
  summit: number;
  scanY: number;
  forest: number;
  fountains: number;
  motes: number;
  stair: number;
  mirror: number;
  scanRing: number;
  /* lake, elephants and trees around the rock */
  env: number;
};

export type PourState = {
  t: number;
  pitch: number;
  camH: number;
  dist: number;
  barY: number;
  half: number;
  fade: number;
};

export type FloodState = { t: number };

export type FrameState = {
  time: number;
  gate: GateState | null;
  world: WorldState | null;
  pour: PourState | null;
  flood: FloodState | null;
  bloom: number;
  finalLime: number;
  fade: number;
};

type LineMesh = ReturnType<typeof createMesh> & { length: number };

function buildLineData(points: Vec3[]) {
  const data = new Float32Array(points.length * 2 * 11);
  const last = points.length - 1;
  points.forEach((point, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(last, i + 1)];
    for (let s = 0; s < 2; s++) {
      const o = (i * 2 + s) * 11;
      data.set(point, o);
      data.set(i === 0 ? point : prev, o + 3);
      data.set(i === last ? point : next, o + 6);
      data[o + 9] = s === 0 ? -1 : 1;
      data[o + 10] = last === 0 ? 1 : i / last;
    }
  });
  const indices = new Uint32Array(last * 6);
  for (let i = 0; i < last; i++) {
    const a = i * 2;
    indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
  }
  return { data, indices };
}

const LINE_ATTRIBUTES = [
  { location: 0, size: 3 },
  { location: 1, size: 3 },
  { location: 2, size: 3 },
  { location: 3, size: 2 },
];

export class Renderer {
  readonly gl: GL;
  private readonly quad: WebGLVertexArrayObject | null;
  private readonly programs: Record<string, Program>;
  private readonly light: Target;
  private readonly scene: Target;
  private readonly msaa: MultisampleTarget | null;
  private readonly bloomA: Target;
  private readonly bloomB: Target;
  private readonly rock: ReturnType<typeof createMesh>;
  private readonly structures: ReturnType<typeof createMesh>;
  private readonly elephants: ReturnType<typeof createMesh>;
  private readonly forest: ReturnType<typeof createMesh>;
  private readonly fountains: ReturnType<typeof createMesh>;
  private readonly motes: ReturnType<typeof createMesh>;
  private readonly stair: LineMesh;
  private readonly mirror: LineMesh;
  private scan: LineMesh;
  private lastScanY = -1;
  private textTexture: WebGLTexture | null = null;

  cssWidth = 1;
  cssHeight = 1;
  pixelRatio = 1;
  viewProj: Mat4 = new Float32Array(16);

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      return null;
    }
    try {
      return new Renderer(gl);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private constructor(gl: GL) {
    this.gl = gl;
    this.quad = fullscreenTriangle(gl);
    const fs = (frag: string, label: string) =>
      new Program(gl, FULLSCREEN_VERT, frag, label);
    this.programs = {
      gateLight: fs(GATE_LIGHT_FRAG, "gateLight"),
      gateComposite: fs(GATE_COMPOSITE_FRAG, "gateComposite"),
      world: fs(WORLD_FRAG, "world"),
      pour: fs(POUR_FRAG, "pour"),
      flood: fs(FLOOD_FRAG, "flood"),
      bright: fs(BRIGHT_FRAG, "bright"),
      blur: fs(BLUR_FRAG, "blur"),
      composite: fs(COMPOSITE_FRAG, "composite"),
      rock: new Program(gl, ROCK_VERT, ROCK_FRAG, "rock"),
      points: new Program(gl, POINTS_VERT, POINTS_FRAG, "points"),
      lines: new Program(gl, LINES_VERT, LINES_FRAG, "lines"),
    };

    this.light = new Target(gl);
    this.scene = new Target(gl, true);
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) as number;
    this.msaa = maxSamples >= 4 ? new MultisampleTarget(gl, 4) : null;
    this.bloomA = new Target(gl);
    this.bloomB = new Target(gl);

    const rockMesh = buildRockMesh();
    const meshAttributes = [
      { location: 0, size: 3 },
      { location: 1, size: 3 },
      { location: 2, size: 3 },
    ];
    this.rock = createMesh(
      gl,
      rockMesh.vertices,
      meshAttributes,
      rockMesh.indices,
    );
    const structures = mergeMeshes(buildStructures(), buildLion());
    this.structures = createMesh(
      gl,
      structures.vertices,
      meshAttributes,
      structures.indices,
    );
    const herd = buildElephants();
    this.elephants = createMesh(gl, herd.vertices, meshAttributes, herd.indices);
    const pointAttributes = [{ location: 0, size: 4 }];
    const canopy = clearLake(buildForest());
    const trees = buildTrees();
    const woods = new Float32Array(canopy.length + trees.length);
    woods.set(canopy);
    woods.set(trees, canopy.length);
    this.forest = createMesh(gl, woods, pointAttributes);
    this.fountains = createMesh(gl, buildFountainParticles(), pointAttributes);
    this.motes = createMesh(gl, buildMotes(), pointAttributes);
    this.stair = this.lineMesh(stairPolyline());
    this.mirror = this.lineMesh(mirrorWallPolyline());
    this.scan = this.lineMesh(sliceRing(0.01), gl.DYNAMIC_DRAW);
  }

  private lineMesh(points: Vec3[], usage?: number): LineMesh {
    const { data, indices } = buildLineData(points);
    const mesh = createMesh(this.gl, data, LINE_ATTRIBUTES, indices, usage);
    return Object.assign(mesh, { length: points.length });
  }

  private updateScan(y: number) {
    if (Math.abs(y - this.lastScanY) < 0.002) {
      return;
    }
    this.lastScanY = y;
    const { data } = buildLineData(sliceRing(y));
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.scan.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio: number) {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.pixelRatio = pixelRatio;
    const w = Math.max(1, Math.round(cssWidth * pixelRatio));
    const h = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.scene.resize(w, h);
    this.msaa?.resize(w, h);
    const lightScale = 0.25;
    this.light.resize(
      Math.max(320, cssWidth * lightScale),
      Math.max(180, cssHeight * lightScale),
    );
    this.bloomA.resize(w / 4, h / 4);
    this.bloomB.resize(w / 4, h / 4);
  }

  setTextCanvas(canvas: HTMLCanvasElement | null) {
    const gl = this.gl;
    if (this.textTexture) {
      gl.deleteTexture(this.textTexture);
      this.textTexture = null;
    }
    if (!canvas) {
      return;
    }
    this.textTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.textTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  project(point: Vec3) {
    return projectToScreen(this.viewProj, point, this.cssWidth, this.cssHeight);
  }

  /* Camera matrices for a world camera (also used by the DOM overlays). */
  computeCamera(camera: CameraState) {
    const aspect = this.cssWidth / this.cssHeight;
    const proj = perspective(camera.fov, aspect, 0.05, 80);
    const view = lookAt(camera.eye, camera.target);
    this.viewProj = multiply(proj, view);
    return this.viewProj;
  }

  private drawQuad() {
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render(state: FrameState) {
    const gl = this.gl;
    const P = this.programs;
    const W = this.cssWidth;
    const H = this.cssHeight;
    const pxW = this.scene.width;
    const pxH = this.scene.height;

    // 1. gate light field (small)
    if (state.gate) {
      const g = state.gate;
      this.light.bind();
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      P.gateLight
        .use()
        .v2("uViewport", W, H)
        .f("uTime", state.time)
        .v2("uPointer", g.pointer[0], g.pointer[1])
        .f("uEnergy", g.energy)
        .v3("uRing", g.ring[0], g.ring[1], g.ring[2])
        .f("uLens", g.lens)
        .f("uCharge", g.charge);
      this.drawQuad();
    }

    // 2. scene
    if (this.msaa) {
      this.msaa.bind();
    } else {
      this.scene.bind();
    }
    gl.clearColor(0.0196, 0.0235, 0.0157, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    if (state.world) {
      this.drawWorld(state.world, state.time);
    }

    if (state.gate) {
      const g = state.gate;
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      P.gateComposite
        .use()
        .tex("uLight", this.light.texture)
        .v2("uViewport", W, H)
        .v2("uRes", pxW, pxH)
        .f("uTime", state.time)
        .v3("uRing", g.ring[0], g.ring[1], g.ring[2])
        .f("uLens", g.lens)
        .f("uSuccess", g.success)
        .f("uShatter", g.shatter)
        .v2("uOrigin", g.origin[0], g.origin[1])
        .f("uFade", g.fade);
      this.drawQuad();
      gl.disable(gl.BLEND);
    }

    if (state.pour) {
      const p = state.pour;
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      P.pour
        .use()
        .v2("uViewport", W, H)
        .v2("uRes", pxW, pxH)
        .f("uT", p.t)
        .f("uPitch", p.pitch)
        .f("uFocal", H / 2 / Math.tan((state.world?.camera.fov ?? 0.8) / 2))
        .f("uCamH", p.camH)
        .f("uDist", p.dist)
        .f("uBarY", p.barY)
        .f("uHalf", p.half)
        .f("uFade", p.fade);
      this.drawQuad();
      gl.disable(gl.BLEND);
    }

    if (state.flood) {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      P.flood
        .use()
        .tex("uText", this.textTexture)
        .v2("uViewport", W, H)
        .v2("uRes", pxW, pxH)
        .f("uT", state.flood.t);
      this.drawQuad();
    }

    if (this.msaa) {
      this.msaa.resolveInto(this.scene);
    }

    // 3. bloom
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    const bloomOn = state.bloom > 0.001;
    if (bloomOn) {
      this.bloomA.bind();
      P.bright
        .use()
        .tex("uTex", this.scene.texture)
        .v2("uTexel", 1 / pxW, 1 / pxH)
        .f("uThreshold", 0.42);
      this.drawQuad();
      for (let i = 0; i < 2; i++) {
        this.bloomB.bind();
        P.blur
          .use()
          .tex("uTex", this.bloomA.texture)
          .v2("uDir", (1.6 + i) / this.bloomA.width, 0);
        this.drawQuad();
        this.bloomA.bind();
        P.blur
          .use()
          .tex("uTex", this.bloomB.texture)
          .v2("uDir", 0, (1.6 + i) / this.bloomA.height);
        this.drawQuad();
      }
    }

    // 4. composite to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pxW, pxH);
    P.composite
      .use()
      .tex("uScene", this.scene.texture)
      .tex("uBloom", this.bloomA.texture)
      .f("uBloomAmount", bloomOn ? state.bloom : 0)
      .f("uFinalLime", state.finalLime)
      .f("uTime", state.time)
      .f("uFade", state.fade);
    this.drawQuad();
  }

  private drawWorld(w: WorldState, time: number) {
    const gl = this.gl;
    const P = this.programs;
    const viewProj = this.computeCamera(w.camera);
    const inv = invert(viewProj);
    const pxScale = this.scene.height / 2 / Math.tan(w.camera.fov / 2);

    P.world
      .use()
      .mat4("uInvViewProj", inv)
      .f("uTime", time)
      .f("uWater", w.water)
      .f("uFront", w.front)
      .f("uGarden", w.garden)
      .f("uLead", w.lead)
      .f("uFill", w.fill)
      .f("uLotus", w.lotus)
      .f("uPulse", w.pulse)
      .f("uGrid", w.grid)
      .f("uDim", w.dim)
      .f("uEnv", w.env)
      .v3array("uRipples", w.ripples);
    this.drawQuad();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);

    if (w.rockVisible > 0.001 && w.build > 0.0005) {
      P.rock
        .use()
        .mat4("uViewProj", viewProj)
        .v3("uCamPos", w.camera.eye[0], w.camera.eye[1], w.camera.eye[2])
        .f("uTime", time)
        .f("uBuild", w.build)
        .f("uDim", w.dim)
        .f("uSummit", w.summit)
        .f("uScanY", w.scanY)
        .f("uVisible", w.rockVisible);
      gl.bindVertexArray(this.rock.vao);
      gl.drawElements(gl.TRIANGLES, this.rock.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(this.structures.vao);
      gl.drawElements(gl.TRIANGLES, this.structures.count, gl.UNSIGNED_INT, 0);
      if (w.env > 0.001) {
        P.rock.f("uVisible", w.rockVisible * w.env);
        gl.bindVertexArray(this.elephants.vao);
        gl.drawElements(gl.TRIANGLES, this.elephants.count, gl.UNSIGNED_INT, 0);
      }
    }

    // additive layers
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);

    const lines = P.lines;
    const drawLine = (
      mesh: LineMesh,
      width: number,
      intensity: number,
      progress = 1,
    ) => {
      if (intensity <= 0.001) return;
      lines
        .use()
        .mat4("uViewProj", viewProj)
        .v2("uRes", this.scene.width, this.scene.height)
        .f("uWidth", width * this.pixelRatio)
        .f("uIntensity", intensity)
        .f("uProgress", progress);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    };

    if (w.rockVisible > 0.001) {
      drawLine(
        this.stair,
        3.2,
        w.stair * w.rockVisible * (1 - w.dim * 0.7),
        Math.min(1, w.stair * 1.2),
      );
      drawLine(
        this.mirror,
        2.6,
        w.mirror * w.rockVisible * (1 - w.dim * 0.7),
        Math.min(1, w.mirror * 1.2),
      );
    }
    const buildY = w.build * 1.78 - 0.06;
    const ringFade = w.scanRing * (1 - smoothstep(1.42, 1.54, buildY));
    if (ringFade > 0.001) {
      this.updateScan(Math.min(1.5, Math.max(0.005, buildY)));
      drawLine(this.scan, 4, ringFade);
    }

    const points = P.points;
    const drawPoints = (
      mesh: ReturnType<typeof createMesh>,
      mode: number,
      amount: number,
      size: number,
    ) => {
      if (amount <= 0.001) return;
      points
        .use()
        .mat4("uViewProj", viewProj)
        .f("uTime", time)
        .f("uMode", mode)
        .f("uBuildY", w.build * 1.78 - 0.06)
        .f("uAmount", amount)
        .f("uPxScale", pxScale)
        .f("uSize", size);
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(gl.POINTS, 0, mesh.count);
    };

    gl.depthMask(false);
    drawPoints(this.forest, 0, w.forest * (1 - w.dim * 0.6), 0.024);
    drawPoints(this.fountains, 1, w.fountains * (1 - w.dim * 0.5), 0.022);
    drawPoints(this.motes, 2, w.motes, 0.03);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    this.light.dispose();
    this.scene.dispose();
    this.msaa?.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    if (this.textTexture) gl.deleteTexture(this.textTexture);
    // Deliberately not calling WEBGL_lose_context: React may mount the
    // intro again on the same canvas (Strict Mode), which would then fail.
    for (const program of Object.values(this.programs)) {
      gl.deleteProgram(program.program);
    }
  }
}
