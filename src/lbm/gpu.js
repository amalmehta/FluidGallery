// The same D2Q9 TRT lattice Boltzmann method as solver.js, run on the GPU with WebGL2.
// solver.js is the reference: tests check that this file gives the same flow.
//
// State lives in three RGBA32F textures holding *post-collision* populations:
//   A = (f0, f1, f2, f3)   B = (f4, f5, f6, f7)   C = (f8, rho, ux, uy)
// Each step pulls neighbours' populations (streaming), applies walls, then collides.
// The CPU keeps the body mask (rasterised with raster.js) and uploads only the region that changed.
import { rasterize, polyBox } from './raster.js';
import { feq, W, NU_SPONGE, spongeWidth } from './solver.js';

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

// Populations are stored as offsets from their rest values (f_i - w_i). Float32 then keeps
// ~3 more significant digits of the small changes that carry the flow.
const COMMON = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
const ivec2 C[9] = ivec2[9](ivec2(0,0),ivec2(1,0),ivec2(0,1),ivec2(-1,0),ivec2(0,-1),ivec2(1,1),ivec2(-1,1),ivec2(-1,-1),ivec2(1,-1));
const float WT[9] = float[9](4./9.,1./9.,1./9.,1./9.,1./9.,1./36.,1./36.,1./36.,1./36.);
const int OPPI[9] = int[9](0,3,4,1,2,7,8,5,6);
const int FLIP[9] = int[9](0,1,4,3,2,8,7,6,5);
// equilibrium minus rest weight, for density 1 + dr and velocity u
float feqd(int i, float dr, vec2 u){ float cu = 3.*dot(vec2(C[i]), u); return WT[i]*(dr + (1.+dr)*(cu+.5*cu*cu-1.5*dot(u,u))); }
`;

const STEP_FS = COMMON + `
uniform sampler2D uA, uB, uC, uBody;
uniform ivec2 uN; uniform float uNu, uNuS, uU; uniform int uSp;
layout(location=0) out vec4 oA; layout(location=1) out vec4 oB; layout(location=2) out vec4 oC; layout(location=3) out vec4 oF;
float fget(ivec2 p, int i){
  if (i < 4) return texelFetch(uA, p, 0)[i];
  if (i < 8) return texelFetch(uB, p, 0)[i-4];
  return texelFetch(uC, p, 0).x;
}
void writeEq(float dr, vec2 u){
  oA = vec4(feqd(0,dr,u), feqd(1,dr,u), feqd(2,dr,u), feqd(3,dr,u));
  oB = vec4(feqd(4,dr,u), feqd(5,dr,u), feqd(6,dr,u), feqd(7,dr,u));
  oC = vec4(feqd(8,dr,u), 1. + dr, u);
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 body = texelFetch(uBody, p, 0);
  oF = vec4(0.);
  if (body.r > .5) { writeEq(0., body.gb); return; }                // inside the body: rest state at wall speed
  if (p.x == 0) { writeEq(0., vec2(uU, 0.)); return; }               // inflow: rho = 1, u = (U, 0)
  // A cell the body just left is refilled at equilibrium (mean neighbour density, wall speed),
  // then streams like any other cell, exactly as the CPU reference does.
  bool fresh = body.a > .5;
  float rhoFresh = 1.;
  if (fresh) {
    float rs = 0., rc = 0.;
    for (int i = 1; i < 9; i++) { ivec2 q = p + C[i];
      if (texelFetch(uBody, q, 0).r < .5 && texelFetch(uBody, q, 0).a < .5) { rs += texelFetch(uC, q, 0).y; rc += 1.; } }
    rhoFresh = rc > 0. ? rs / rc : 1.;
  }
  ivec2 q = p; if (p.x == uN.x - 1) q.x = uN.x - 2;                  // outflow: zero gradient
  float rhoOld = fresh ? rhoFresh : texelFetch(uC, q, 0).y;
  float f[9]; vec2 force = vec2(0.);
  f[0] = fresh ? feqd(0, rhoOld - 1., body.gb) : fget(q, 0);
  for (int i = 1; i < 9; i++) {
    ivec2 s = q - C[i];
    if (s.y < 0 || s.y >= uN.y) { f[i] = fget(ivec2(s.x, q.y), FLIP[i]); continue; }  // free-slip wall
    vec4 sb = texelFetch(uBody, s, 0);
    if (sb.r > .5) {                                                  // bounce back from a moving wall
      int o = OPPI[i]; float v = fresh ? feqd(o, rhoOld - 1., body.gb) : fget(q, o);
      float vb = v - 6. * WT[o] * rhoOld * dot(vec2(C[o]), sb.gb);
      f[i] = vb;
      force += vec2(C[o]) * (v + vb + 2. * WT[o]) - sb.gb * (v - vb);  // full populations = offset + w
    } else if (sb.a > .5) f[i] = feqd(i, rhoOld - 1., sb.gb);         // neighbour was solid until now
    else f[i] = fget(s, i);
  }
  float dr = 0.; vec2 m = vec2(0.);
  for (int i = 0; i < 9; i++) { dr += f[i]; m += f[i] * vec2(C[i]); }
  vec2 u = m / (1. + dr);
  // sponge layers near inlet and outlet (same formula as solver.js spongeNu)
  int d = min(p.x, uN.x - 1 - p.x);
  float nu = uNu;
  if (d < uSp) { float sp = float(uSp - d) / float(uSp); nu += (max(uNu, uNuS) - uNu) * sp * sp; }
  float tau = 3. * nu + .5;
  float uOmP = 1. / tau, uOmM = 1. / (.5 + .25 / (tau - .5));
  float g[9];
  g[0] = f[0] - uOmP * (f[0] - feqd(0, dr, u));
  for (int i = 1; i < 9; i++) {                                        // TRT collision
    int o = OPPI[i];
    float ei = feqd(i, dr, u), eo = feqd(o, dr, u);
    g[i] = f[i] - uOmP * (.5*(f[i]+f[o]) - .5*(ei+eo)) - uOmM * (.5*(f[i]-f[o]) - .5*(ei-eo));
  }
  oA = vec4(g[0], g[1], g[2], g[3]); oB = vec4(g[4], g[5], g[6], g[7]); oC = vec4(g[8], 1. + dr, u);
  if (p == q) oF = vec4(force, 0., 0.);
}`;

// Sums 4x4 blocks of a source region; the last pass writes into one pixel of the history row.
const REDUCE_FS = COMMON + `
uniform sampler2D uSrc; uniform ivec2 uO, uS, uOut;
out vec4 o;
void main(){
  ivec2 op = ivec2(gl_FragCoord.xy) - uOut;
  vec4 s = vec4(0.);
  for (int dy = 0; dy < 4; dy++) for (int dx = 0; dx < 4; dx++) {
    ivec2 sp = op * 4 + ivec2(dx, dy);
    if (sp.x < uS.x && sp.y < uS.y) s += texelFetch(uSrc, uO + sp, 0);
  }
  o = s;
}`;

// Vorticity (curl of velocity) and solid flag into a filterable half-float texture.
const VORT_FS = COMMON + `
uniform sampler2D uC, uBody; uniform ivec2 uN;
out vec4 o;
vec2 vel(ivec2 p){ p = clamp(p, ivec2(0), uN - 1); return texelFetch(uC, p, 0).zw; }
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  float w = .5 * (vel(p + ivec2(1,0)).y - vel(p - ivec2(1,0)).y) - .5 * (vel(p + ivec2(0,1)).x - vel(p - ivec2(0,1)).x);
  o = vec4(w, texelFetch(uBody, p, 0).r, length(vel(p)), 1.);
}`;

const SHOW_FS = `#version 300 es
precision highp float;
uniform sampler2D uV; uniform vec2 uView; uniform float uScale;
uniform vec3 uBg, uNeg, uPos, uInk;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / uView;
  vec4 v = texture(uV, uv);
  float t = tanh(v.r * uScale);
  // small dead zone hides weak-compressibility noise (sound waves); real vortices are far stronger
  vec3 c = mix(uBg, t < 0. ? uNeg : uPos, pow(max(abs(t) - .06, 0.) / .94, .85));
  float solid = smoothstep(.35, .65, v.g);
  o = vec4(mix(c, uInk, solid), 1.);
}`;

export class GpuLattice {
  static supported(gl) { return !!gl && !!gl.getExtension('EXT_color_buffer_float'); }

  constructor(gl, { nx, ny, nu, U = 0 }) {
    this.gl = gl;
    this.async = true;
    this.nx = nx; this.ny = ny; this.N = nx * ny;
    this.U = U;
    this.time = 0;
    this.solid = new Uint8Array(this.N);
    this.uwx = new Float32Array(this.N);
    this.uwy = new Float32Array(this.N);
    this.box = null;
    this._forceBox = [0, 0, 0, 0];
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const prog = (fs) => program(gl, VS, fs);
    this.pStep = prog(STEP_FS);
    this.pReduce = prog(REDUCE_FS);
    this.pVort = prog(VORT_FS);
    this.pShow = prog(SHOW_FS);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const p of [this.pStep, this.pReduce, this.pVort, this.pShow]) gl.bindAttribLocation(p.prog, 0, 'p');

    const tex = (w, h, fmt = gl.RGBA32F, filter = gl.NEAREST) => texture(gl, w, h, fmt, filter);
    this.state = [0, 1].map(() => [tex(nx, ny), tex(nx, ny), tex(nx, ny)]);
    this.forceTex = tex(nx, ny);
    this.fbo = [0, 1].map((k) => fbo(gl, [...this.state[k], this.forceTex]));
    this.cur = 0;
    this.bodyTex = tex(nx, ny);
    const rw = Math.ceil(nx / 4) + 1, rh = Math.ceil(ny / 4) + 1;
    this.red = [tex(rw, rh), tex(rw, rh)];
    this.redFbo = this.red.map((t) => fbo(gl, [t]));
    this.HIST = 256;
    this.hist = tex(this.HIST, 1);
    this.histFbo = fbo(gl, [this.hist]);
    this.histN = 0;
    this.vortTex = tex(nx, ny, gl.RGBA16F, gl.LINEAR);
    this.vortFbo = fbo(gl, [this.vortTex]);
    this.setViscosity(nu);
    this.initEquilibrium(() => U, () => 0);
  }

  setViscosity(nu) { this.nu = nu; }

  initEquilibrium(uxFn, uyFn) {
    const { gl, nx, ny } = this;
    const A = new Float32Array(4 * this.N), B = new Float32Array(4 * this.N), Cc = new Float32Array(4 * this.N);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = 4 * (y * nx + x), ux = uxFn(x, y), uy = uyFn(x, y);
        for (let i = 0; i < 4; i++) { A[k + i] = feq(i, 1, ux, uy) - W[i]; B[k + i] = feq(i + 4, 1, ux, uy) - W[i + 4]; }
        Cc[k] = feq(8, 1, ux, uy) - W[8]; Cc[k + 1] = 1; Cc[k + 2] = ux; Cc[k + 3] = uy;
      }
    const s = this.state[this.cur];
    [A, B, Cc].forEach((data, i) => {
      gl.bindTexture(gl.TEXTURE_2D, s[i]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RGBA, gl.FLOAT, data);
    });
    // empty body texture
    gl.bindTexture(gl.TEXTURE_2D, this.bodyTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RGBA, gl.FLOAT, new Float32Array(4 * this.N));
    this.solid.fill(0); this.box = null;
  }

  applyBody(body) {
    const uncovered = [];
    const [x0, x1, y0, y1] = rasterize(body, this, (idx) => uncovered.push(idx));
    const { gl, nx } = this;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const data = new Float32Array(4 * w * h);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const idx = y * nx + x, k = 4 * ((y - y0) * w + (x - x0));
        data[k] = this.solid[idx]; data[k + 1] = this.uwx[idx]; data[k + 2] = this.uwy[idx];
      }
    for (const idx of uncovered) {
      const x = idx % nx, y = (idx - x) / nx;
      data[4 * ((y - y0) * w + (x - x0)) + 3] = 1;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.bodyTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, w, h, gl.RGBA, gl.FLOAT, data);
    this._forceBox = polyBox(body.polygon, this.nx, this.ny, 3);
  }

  step() {
    const { gl, nx, ny } = this;
    const src = this.state[this.cur];
    const dst = 1 - this.cur;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);
    gl.viewport(0, 0, nx, ny);
    const p = this.pStep;
    gl.useProgram(p.prog);
    bindTex(gl, p, 'uA', 0, src[0]); bindTex(gl, p, 'uB', 1, src[1]); bindTex(gl, p, 'uC', 2, src[2]);
    bindTex(gl, p, 'uBody', 3, this.bodyTex);
    gl.uniform2i(p.u('uN'), nx, ny);
    gl.uniform1f(p.u('uNu'), this.nu); gl.uniform1f(p.u('uNuS'), NU_SPONGE); gl.uniform1i(p.u('uSp'), spongeWidth(nx));
    gl.uniform1f(p.u('uU'), this.U);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.cur = dst;
    // The "just uncovered" flags only apply once.
    this._reduceForce();
    this.time++;
  }

  _reduceForce() {
    const { gl } = this;
    if (this.histN >= this.HIST) this._pending = this.readForces();
    let [x0, x1, y0, y1] = this._forceBox;
    let src = this.forceTex, O = [x0, y0], S = [x1 - x0 + 1, y1 - y0 + 1], k = 0;
    const p = this.pReduce;
    gl.useProgram(p.prog);
    for (;;) {
      const out = [Math.ceil(S[0] / 4), Math.ceil(S[1] / 4)];
      const last = out[0] === 1 && out[1] === 1;
      if (last) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.histFbo);
        gl.viewport(this.histN, 0, 1, 1);
        gl.uniform2i(p.u('uOut'), this.histN, 0);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.redFbo[k]);
        gl.viewport(0, 0, out[0], out[1]);
        gl.uniform2i(p.u('uOut'), 0, 0);
      }
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      bindTex(gl, p, 'uSrc', 0, src);
      gl.uniform2i(p.u('uO'), O[0], O[1]);
      gl.uniform2i(p.u('uS'), S[0], S[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (last) break;
      src = this.red[k]; k = 1 - k; O = [0, 0]; S = out;
    }
    this.histN++;
  }

  // Forces for every step since the last call, oldest first: [[fx, fy], ...].
  readForces() {
    const { gl } = this;
    const out = this._pending || [];
    this._pending = null;
    if (!this.histN) return out;
    const buf = new Float32Array(4 * this.histN);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.histFbo);
    gl.readPixels(0, 0, this.histN, 1, gl.RGBA, gl.FLOAT, buf);
    for (let i = 0; i < this.histN; i++) out.push([buf[4 * i], buf[4 * i + 1]]);
    this.histN = 0;
    return out;
  }

  // Macroscopic fields (rho, ux, uy) read back from the GPU, for tests.
  readMacro() {
    const { gl, nx, ny } = this;
    const buf = new Float32Array(4 * nx * ny);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.cur]);
    gl.readBuffer(gl.COLOR_ATTACHMENT2);
    gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.FLOAT, buf);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    const rho = new Float32Array(nx * ny), ux = new Float32Array(nx * ny), uy = new Float32Array(nx * ny);
    for (let i = 0; i < nx * ny; i++) { rho[i] = buf[4 * i + 1]; ux[i] = buf[4 * i + 2]; uy[i] = buf[4 * i + 3]; }
    return { rho, ux, uy };
  }

  hasNaN() {
    const { rho } = this.readMacro();
    for (let i = 0; i < rho.length; i += 97) if (!(rho[i] > 0 && rho[i] < 10)) return true;
    return false;
  }

  // Draw the vorticity field to the canvas. colors: {bg, neg, pos, ink} as [r,g,b] 0..1.
  render(width, height, scale, colors) {
    const { gl, nx, ny } = this;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vortFbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, nx, ny);
    let p = this.pVort;
    gl.useProgram(p.prog);
    bindTex(gl, p, 'uC', 0, this.state[this.cur][2]);
    bindTex(gl, p, 'uBody', 1, this.bodyTex);
    gl.uniform2i(p.u('uN'), nx, ny);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    p = this.pShow;
    gl.useProgram(p.prog);
    bindTex(gl, p, 'uV', 0, this.vortTex);
    gl.uniform2f(p.u('uView'), width, height);
    gl.uniform1f(p.u('uScale'), scale);
    gl.uniform3fv(p.u('uBg'), colors.bg); gl.uniform3fv(p.u('uNeg'), colors.neg);
    gl.uniform3fv(p.u('uPos'), colors.pos); gl.uniform3fv(p.u('uInk'), colors.ink);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Free every texture, framebuffer and program made on this context (one lattice per context).
  dispose() {
    const { gl } = this;
    for (const [kind, o] of made.get(gl) || []) {
      if (kind === 'texture') gl.deleteTexture(o);
      else if (kind === 'framebuffer') gl.deleteFramebuffer(o);
      else gl.deleteProgram(o);
    }
    made.set(gl, []);
  }
}

const made = new WeakMap(); // gl -> list of GPU objects, so a lattice can free what it made

function track(gl, kind, obj) {
  if (!made.has(gl)) made.set(gl, []);
  made.get(gl).push([kind, obj]);
  return obj;
}

function program(gl, vsSrc, fsSrc) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = track(gl, 'program', gl.createProgram());
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.bindAttribLocation(prog, 0, 'p');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const cache = {};
  return { prog, u: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(prog, n))) };
}

function texture(gl, w, h, fmt, filter) {
  const t = track(gl, 'texture', gl.createTexture());
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function fbo(gl, texs) {
  const f = track(gl, 'framebuffer', gl.createFramebuffer());
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete: ' + st);
  return f;
}

function bindTex(gl, p, name, unit, tex) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(p.u(name), unit);
}
