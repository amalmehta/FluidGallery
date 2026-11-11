// Runs one simulation off the main thread and draws it to a transferred OffscreenCanvas.
// Uses the GPU (WebGL2) when it can, otherwise the CPU reference solver.
import { byId, defaults, advance, QUALITY } from './lbm/scenes.js';
import { GpuLattice } from './lbm/gpu.js';
import { Lattice } from './lbm/solver.js';
import { PALETTES, vortScale, renderField } from './lbm/render.js';
import { strokeToShape, dragShape } from './lbm/bodies.js';

const raf = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);

let canvas, gl = null, ctx2d = null, scene, sc, params, q = 1;
let running = true, speed = 'normal', theme = 'light', contrast = 'medium';
let view = [600, 240];
let stepsPerFrame = 8, lastStats = 0, stepCount = 0, stepClock = performance.now(), sps = 0;
let small = null, smallCtx = null, img = null;
let backend = 'gpu';

function make(opts) {
  if (backend === 'gpu') return new GpuLattice(gl, opts);
  return new Lattice(opts);
}

function build() {
  if (sc && sc.lat.dispose) sc.lat.dispose();
  sc = scene.build(params, q, make);
  sc.meter.reset();
  if (backend === 'cpu') {
    small = new OffscreenCanvas(sc.lat.nx, sc.lat.ny);
    smallCtx = small.getContext('2d');
    img = smallCtx.createImageData(sc.lat.nx, sc.lat.ny);
  }
  post({ type: 'built', nx: sc.lat.nx, ny: sc.lat.ny, D: sc.D, backend });
}

function setup(m) {
  canvas = m.canvas;
  scene = byId(m.scene);
  params = { ...defaults(scene), ...(m.params || {}) };
  q = QUALITY[m.quality] || 1;
  theme = m.theme; contrast = m.contrast; view = [m.w, m.h];
  canvas.width = m.w; canvas.height = m.h;
  try {
    gl = m.forceCpu ? null : canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    if (!GpuLattice.supported(gl)) throw new Error('no float render targets');
    backend = 'gpu';
    build();
  } catch (err) {
    backend = 'cpu';
    gl = null;
    ctx2d = canvas.getContext('2d');
    q = Math.min(q, 0.75);
    post({ type: 'notice', text: 'Your browser can’t run this on the GPU, so it is running on the CPU at a lower resolution. It will be slower.' });
    build();
  }
  raf(frame);
}

function frame() {
  if (running) {
    const t0 = performance.now();
    const target = speed === 'max' ? stepsPerFrame : Math.max(1, Math.round(scene.pace * q * (speed === 'slow' ? 0.4 : 1)));
    // never exceed what fits in a frame, so the canvas keeps the display's frame rate
    const n = Math.min(target, stepsPerFrame);
    for (let i = 0; i < n; i++) advance(sc);
    if (sc.lat.async) for (const [fx, fy] of sc.lat.readForces()) sc.meter.push(fx, fy);
    stepCount += n;
    // Adapt the batch so a frame's work stays under ~12 ms (keeps the display at full rate).
    const dt = performance.now() - t0;
    if (dt < 8) stepsPerFrame = Math.min(400, Math.ceil(stepsPerFrame * 1.15 + 1));
    else if (dt > 14) stepsPerFrame = Math.max(1, Math.floor(stepsPerFrame * 0.8));
    if (sc.lat.time % 500 < n && sc.lat.hasNaN()) {
      post({ type: 'notice', text: 'The flow became unstable at these settings, so it was restarted. Try a lower Reynolds number or a slower motion.' });
      build();
    }
  }
  draw();
  const now = performance.now();
  if (now - stepClock > 1000) { sps = (stepCount * 1000) / (now - stepClock); stepCount = 0; stepClock = now; }
  postLive();
  if (now - lastStats > 160) { lastStats = now; postStats(); }
  raf(frame);
}

function draw() {
  const colors = PALETTES[theme] || PALETTES.light;
  const scale = vortScale(sc.U, sc.D * scene.vortLen, contrast);
  if (backend === 'gpu') sc.lat.render(view[0], view[1], scale, colors);
  else {
    renderField(sc.lat, scale, colors, img.data);
    smallCtx.putImageData(img, 0, 0);
    ctx2d.imageSmoothingEnabled = true;
    ctx2d.drawImage(small, 0, 0, view[0], view[1]);
  }
}

// Per-frame: where the body is and the force on it (for the arrow overlay).
function postLive() {
  const s = sc.meter.recent(50);
  post({ type: 'live', center: sc.body.center, cd: s.cd, cl: s.cl, time: sc.lat.time, nx: sc.lat.nx, ny: sc.lat.ny, D: sc.D });
}

function postStats() {
  const s = sc.meter.summary();
  const out = { type: 'stats', ...s, sps, time: sc.lat.time, chartCd: sc.meter.chartCd, chartCl: sc.meter.chartCl, backend, window: sc.meter.window, U: sc.U, D: sc.D };
  if (scene.id === 'draw') {
    const b = sc.body, cur = sc.lat.U;
    const rvx = b.vx - cur, rvy = b.vy;
    const v = Math.hypot(rvx, rvy);
    out.speed = v / sc.U; // relative to the reference speed
    out.ReNow = (v * sc.D) / sc.nu;
  }
  post(out);
}

function post(m) { self.postMessage(m); }

let dragging = false;
self.onmessage = (e) => {
  const m = e.data;
  switch (m.type) {
    case 'init': setup(m); break;
    case 'set':
      params[m.key] = m.value;
      scene.set(sc, m.key, m.value);
      break;
    case 'reset': build(); break;
    case 'run': running = m.value; break;
    case 'speed': speed = m.value; break;
    case 'theme': theme = m.theme; contrast = m.contrast; break;
    case 'quality': {
      if (m.params) params = { ...m.params };
      const nq = QUALITY[m.value] || 1;
      q = backend === 'cpu' ? Math.min(nq, 0.75) : nq;
      build();
      break;
    }
    case 'resize':
      view = [m.w, m.h];
      canvas.width = m.w; canvas.height = m.h;
      break;
    case 'pointer': {
      if (!sc.body.steer) break;
      const x = m.x * sc.lat.nx, y = m.y * sc.lat.ny;
      if (m.kind === 'down') {
        dragging = sc.body.contains(x, y) || Math.hypot(x - sc.body.center[0], y - sc.body.center[1]) < sc.D;
        if (dragging) sc.body.target = [x, y];
        post({ type: 'grab', value: dragging });
      } else if (m.kind === 'move' && dragging) sc.body.target = [x, y];
      else if (m.kind === 'up') { dragging = false; post({ type: 'grab', value: false }); }
      break;
    }
    case 'shape': {
      if (!sc.body.steer) break;
      const pts = m.points.map(([x, y]) => [x * sc.lat.nx, y * sc.lat.ny]);
      const shape = strokeToShape(pts, 6 * q);
      if (!shape) { post({ type: 'notice', text: 'That shape is too small or not closed. Draw a bigger loop.' }); break; }
      // Clear the old body: collapse it to a point so its cells are uncovered and refilled.
      const old = sc.body;
      old.polygon.fill(0);
      for (let k = 0; k < old.polygon.length; k += 2) { old.polygon[k] = old.center[0]; old.polygon[k + 1] = old.center[1]; }
      sc.lat.applyBody(old);
      sc.lat.box = null;
      sc.body = dragShape({ shape: shape.shape, cx: shape.cx, cy: shape.cy, size: Math.max(4, shape.size) });
      sc.D = sc.body.refLength;
      post({ type: 'notice', text: 'New shape ready. Drag it through the water.' });
      break;
    }
  }
};
