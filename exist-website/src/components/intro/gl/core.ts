/* Thin WebGL2 helpers: programs with cached uniforms, render targets, buffers. */

export type GL = WebGL2RenderingContext;

function compileShader(gl: GL, type: number, source: string, label: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(`Could not create shader (${label})`);
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "";
    const numbered = source
      .split("\n")
      .map((line, index) => `${String(index + 1).padStart(4)} ${line}`)
      .join("\n");
    console.error(
      `[intro-gl] ${label} failed to compile:\n${log}\n${numbered}`,
    );
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${label}`);
  }
  return shader;
}

export class Program {
  readonly program: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();
  private textureUnit = 0;

  constructor(
    readonly gl: GL,
    vertex: string,
    fragment: string,
    readonly label: string,
  ) {
    const program = gl.createProgram();
    if (!program) {
      throw new Error(`Could not create program (${label})`);
    }
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertex, `${label}.vert`);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment, `${label}.frag`);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        `[intro-gl] ${label} failed to link:`,
        gl.getProgramInfoLog(program),
      );
      throw new Error(`Program link failed: ${label}`);
    }
    this.program = program;
  }

  use() {
    this.gl.useProgram(this.program);
    this.textureUnit = 0;
    return this;
  }

  private location(name: string) {
    if (!this.locations.has(name)) {
      this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.locations.get(name) ?? null;
  }

  f(name: string, x: number) {
    this.gl.uniform1f(this.location(name), x);
    return this;
  }

  v2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.location(name), x, y);
    return this;
  }

  v3(name: string, x: number, y: number, z: number) {
    this.gl.uniform3f(this.location(name), x, y, z);
    return this;
  }

  v4(name: string, x: number, y: number, z: number, w: number) {
    this.gl.uniform4f(this.location(name), x, y, z, w);
    return this;
  }

  v3array(name: string, values: Float32Array) {
    this.gl.uniform3fv(this.location(name), values);
    return this;
  }

  mat4(name: string, value: Float32Array) {
    this.gl.uniformMatrix4fv(this.location(name), false, value);
    return this;
  }

  tex(name: string, texture: WebGLTexture | null) {
    const unit = this.textureUnit++;
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.location(name), unit);
    return this;
  }
}

export function createTexture(
  gl: GL,
  width: number,
  height: number,
  filter = gl.LINEAR,
) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/* A colour texture you can render into (optionally with a depth buffer). */
export class Target {
  framebuffer: WebGLFramebuffer | null = null;
  texture: WebGLTexture | null = null;
  depth: WebGLRenderbuffer | null = null;
  width = 0;
  height = 0;

  constructor(
    private readonly gl: GL,
    private readonly withDepth = false,
  ) {}

  resize(width: number, height: number) {
    const gl = this.gl;
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this.width && height === this.height && this.framebuffer) {
      return;
    }
    this.dispose();
    this.width = width;
    this.height = height;
    this.texture = createTexture(gl, width, height);
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0,
    );
    if (this.withDepth) {
      this.depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
      gl.renderbufferStorage(
        gl.RENDERBUFFER,
        gl.DEPTH_COMPONENT24,
        width,
        height,
      );
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER,
        this.depth,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  dispose() {
    const gl = this.gl;
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.depth) gl.deleteRenderbuffer(this.depth);
    this.framebuffer = null;
    this.texture = null;
    this.depth = null;
    this.width = 0;
    this.height = 0;
  }
}

/* Multisampled colour + depth buffer that resolves into a plain Target. */
export class MultisampleTarget {
  framebuffer: WebGLFramebuffer | null = null;
  color: WebGLRenderbuffer | null = null;
  depth: WebGLRenderbuffer | null = null;
  width = 0;
  height = 0;

  constructor(
    private readonly gl: GL,
    readonly samples: number,
  ) {}

  resize(width: number, height: number) {
    const gl = this.gl;
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this.width && height === this.height && this.framebuffer) {
      return;
    }
    this.dispose();
    this.width = width;
    this.height = height;
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    this.color = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.color);
    gl.renderbufferStorageMultisample(
      gl.RENDERBUFFER,
      this.samples,
      gl.RGBA8,
      width,
      height,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.RENDERBUFFER,
      this.color,
    );
    this.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
    gl.renderbufferStorageMultisample(
      gl.RENDERBUFFER,
      this.samples,
      gl.DEPTH_COMPONENT24,
      width,
      height,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      this.depth,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  resolveInto(target: Target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.framebuffer);
    gl.blitFramebuffer(
      0,
      0,
      this.width,
      this.height,
      0,
      0,
      target.width,
      target.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  dispose() {
    const gl = this.gl;
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.color) gl.deleteRenderbuffer(this.color);
    if (this.depth) gl.deleteRenderbuffer(this.depth);
    this.framebuffer = null;
    this.color = null;
    this.depth = null;
    this.width = 0;
    this.height = 0;
  }
}

export function fullscreenTriangle(gl: GL) {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

export type AttributeSpec = { location: number; size: number };

/* Interleaved float vertex buffer + optional index buffer bound into a VAO. */
export function createMesh(
  gl: GL,
  data: Float32Array,
  attributes: AttributeSpec[],
  indices?: Uint32Array,
  usage: number = gl.STATIC_DRAW,
) {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  const stride =
    attributes.reduce((sum, attribute) => sum + attribute.size, 0) * 4;
  let offset = 0;
  for (const attribute of attributes) {
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(
      attribute.location,
      attribute.size,
      gl.FLOAT,
      false,
      stride,
      offset,
    );
    offset += attribute.size * 4;
  }
  let ibo: WebGLBuffer | null = null;
  if (indices) {
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }
  gl.bindVertexArray(null);
  return {
    vao,
    vbo,
    ibo,
    count: indices ? indices.length : data.length / (stride / 4),
  };
}
