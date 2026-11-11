// The five scenes: physics setup only (text lives in src/content.js).
// All quantities are in lattice units unless a label says otherwise.
//
// Stability rule, measured (see docs/VALIDATION.md): the relaxation time tau = 3 nu + 1/2 must stay
// above about 0.512 for fixed bodies and 0.527 for moving ones. Because nu = U D / Re, the highest
// Reynolds number a scene can run grows with resolution: Re_max = 3 U D / (tau_min - 1/2).
import { Lattice, spongeWidth } from './solver.js';
import { cylinder, flappingFoil, fish, dragShape, ellipseShape } from './bodies.js';
import { Meter } from './measure.js';

const cpu = (o) => new Lattice(o);

export const QUALITY = { fast: 0.75, balanced: 1, sharp: 1.25 };

// Small sideways nudge behind a cylinder so shedding starts within a few cycles instead of
// waiting for round-off to break the symmetry.
const nudge = (U, cx, cy, D) => (x, y) => 0.1 * U * Math.exp(-((x - cx - D) ** 2 + (y - cy) ** 2) / (D * D));

export const SCENES = [
  {
    id: 'cylinder',
    vortLen: 1, // colour scale: vorticity in units of U / (vortLen * D); the wake's own size
    aspect: 2.5, // width / height of the domain
    pace: 16, // steps per frame at Normal speed: about one shedding cycle per 1.5 s
    tauMin: 0.512,
    geom: (q) => ({ D: Math.round(24 * q), U: 0.1 }),
    params: [{ key: 'Re', label: 'Reynolds number', min: 20, max: 300, step: 5, value: 100 }],
    build(p, q, make = cpu) {
      const { D, U } = this.geom(q);
      const nx = 25 * D, ny = 10 * D, cx = 5 * D, cy = ny / 2;
      const lat = make({ nx, ny, nu: (U * D) / p.Re, U });
      lat.initEquilibrium(() => U, nudge(U, cx, cy, D));
      const body = cylinder({ cx, cy, D, U });
      return { lat, body, U, D, meter: new Meter({ U, refLength: D, window: Math.round((6 * D) / (0.165 * U)) }) };
    },
    set(s, key, v) { if (key === 'Re') s.lat.setViscosity((s.U * s.D) / v); },
  },
  {
    id: 'spinning',
    vortLen: 1, // colour scale: vorticity in units of U / (vortLen * D); the wake's own size
    aspect: 2.25, // width / height of the domain
    pace: 32,
    tauMin: 0.53, // measured at alpha = 2: tau 0.525 fails within 3000 steps, 0.530 holds
    // U is half the plain cylinder's so the spinning surface (alpha * U) stays well below the lattice sound speed.
    geom: (q) => ({ D: Math.round(32 * q), U: 0.05 }),
    params: [
      { key: 'alpha', label: 'Spin ratio α', min: 0, max: 2, step: 0.1, value: 1 },
      { key: 'Re', label: 'Reynolds number', min: 60, max: 200, step: 5, value: 100 },
    ],
    build(p, q, make = cpu) {
      const { D, U } = this.geom(q);
      // finer cylinder (a spinning staircase wall needs it), shorter 18 x 8 D domain to keep the cost
      const nx = 18 * D, ny = 8 * D, cx = 4 * D, cy = ny / 2;
      const lat = make({ nx, ny, nu: (U * D) / p.Re, U });
      lat.initEquilibrium(() => U, nudge(U, cx, cy, D));
      const body = cylinder({ cx, cy, D, U, alpha: p.alpha });
      return { lat, body, U, D, meter: new Meter({ U, refLength: D, window: Math.round((6 * D) / (0.15 * U)) }) };
    },
    set(s, key, v) {
      if (key === 'Re') s.lat.setViscosity((s.U * s.D) / v);
      if (key === 'alpha') s.body.setAlpha(v);
    },
  },
  {
    id: 'foil',
    vortLen: 0.3, // colour scale: vorticity in units of U / (vortLen * D); the wake's own size
    aspect: 2.25, // width / height of the domain
    pace: 19,
    tauMin: 0.527,
    // The flapping edges move up to ~3x faster than the stream, so U stays low and the foil gets
    // 64 cells of chord in a short 9 x 4 chord domain.
    geom: (q) => ({ D: Math.round(64 * q), U: 0.05 }),
    params: [
      { key: 'St', label: 'Flapping Strouhal number', min: 0, max: 0.45, step: 0.01, value: 0.3 },
      { key: 'pitch', label: 'Pitch amplitude (°)', min: 0, max: 15, step: 1, value: 0 },
      { key: 'Re', label: 'Reynolds number (chord)', min: 100, max: 400, step: 10, value: 250 },
    ],
    build(p, q, make = cpu) {
      const { D: c, U } = this.geom(q);
      const nx = 9 * c, ny = 4 * c, h0 = 0.2 * c;
      const lat = make({ nx, ny, nu: (U * c) / p.Re, U });
      const body = flappingFoil({ px: 2.5 * c, py: ny / 2, c, h0, f: (p.St * U) / (2 * h0), theta0: (p.pitch * Math.PI) / 180 });
      return { lat, body, U, D: c, h0, meter: new Meter({ U, refLength: c, window: Math.round(8000 * q) }) };
    },
    set(s, key, v) {
      if (key === 'Re') s.lat.setViscosity((s.U * s.D) / v);
      if (key === 'St') s.body.f = (v * s.U) / (2 * s.h0);
      if (key === 'pitch') s.body.theta0 = (v * Math.PI) / 180;
    },
  },
  {
    id: 'fish',
    vortLen: 0.15, // colour scale: vorticity in units of U / (vortLen * D); the wake's own size
    aspect: 2.5, // width / height of the domain
    pace: 12,
    tauMin: 0.527,
    geom: (q) => ({ D: Math.round(100 * q), U: 0.06 }),
    params: [
      { key: 'St', label: 'Tail-beat Strouhal number', min: 0.1, max: 0.6, step: 0.01, value: 0.33 },
      { key: 'Re', label: 'Reynolds number (length)', min: 200, max: 1000, step: 50, value: 400 },
    ],
    build(p, q, make = cpu) {
      const { D: L, U } = this.geom(q);
      const nx = 6 * L, ny = Math.round(2.4 * L);
      const lat = make({ nx, ny, nu: (U * L) / p.Re, U });
      // St = 2 A_tail f / U with tail amplitude A_tail = 0.1 L
      const body = fish({ hx: 1.5 * L, hy: ny / 2, L, f: (p.St * U) / (0.2 * L) });
      return { lat, body, U, D: L, meter: new Meter({ U, refLength: L, window: Math.round(8000 * q) }) };
    },
    set(s, key, v) {
      if (key === 'Re') s.lat.setViscosity((s.U * s.D) / v);
      if (key === 'St') s.body.f = (v * s.U) / (0.2 * s.D);
    },
  },
  {
    id: 'draw',
    vortLen: 1, // colour scale: vorticity in units of U / (vortLen * D); the wake's own size
    aspect: 2.5, // width / height of the domain
    pace: 24,
    tauMin: 0.527,
    geom: (q) => ({ D: Math.round(30 * q), U: 0.06 }),
    params: [{ key: 'current', label: 'Background current', min: 0, max: 1, step: 1, value: 0, toggle: true }],
    build(p, q, make = cpu) {
      const { D: size, U: Uref } = this.geom(q);
      const nx = Math.round(600 * q), ny = Math.round(240 * q);
      const nu = (Uref * size) / 150; // Re = 150 at the reference speed
      const lat = make({ nx, ny, nu, U: p.current ? Uref : 0 });
      const body = dragShape({ shape: ellipseShape(size / 8, size / 2), cx: nx * 0.25, cy: ny / 2, size });
      return { lat, body, U: Uref, D: size, nu, vmax: 0.08, meter: new Meter({ U: Uref, refLength: size, window: 400 }) };
    },
    set(s, key, v) { if (key === 'current') s.lat.U = v ? s.U : 0; },
  },
];

export const byId = (id) => SCENES.find((s) => s.id === id);

export function defaults(scene) {
  return Object.fromEntries(scene.params.map((p) => [p.key, p.value]));
}

// Highest slider value allowed at this quality (only Re depends on it).
export function paramMax(scene, param, q) {
  if (param.key !== 'Re') return param.max;
  const { D, U } = scene.geom(q);
  const reMax = (3 * U * D) / (scene.tauMin - 0.5);
  return Math.min(param.max, Math.floor(reMax / param.step) * param.step);
}

// Clamp a parameter set to what this quality can run.
export function clampParams(scene, p, q) {
  const out = { ...p };
  for (const prm of scene.params) out[prm.key] = Math.min(paramMax(scene, prm, q), Math.max(prm.min, out[prm.key]));
  return out;
}

// Advance a built scene by one lattice step: move the body, rasterise it, collide+stream, measure.
export function advance(s) {
  const { lat, body } = s;
  if (body.steer) {
    const m = body.refLength, sw = spongeWidth(lat.nx); // keep the shape out of the sponge layers
    body.steer(s.vmax, [sw + 0.6 * m, 0.8 * m], [lat.nx - sw - 0.6 * m, lat.ny - 0.8 * m]);
    body.update(lat.time);
    lat.applyBody(body);
  } else if (body.moving) {
    body.update(lat.time);
    lat.applyBody(body);
  } else if ((body.update(lat.time), !s._placed || body.dirty)) {
    lat.applyBody(body);
    s._placed = true; body.dirty = false;
  }
  lat.step();
  if (!lat.async) s.meter.push(lat.fx, lat.fy); // GPU forces are read back once per frame
}
