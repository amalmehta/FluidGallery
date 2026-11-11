// Fast unit tests: npm test  (the slow physics checks are npm run validate)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lattice, spongeNu, spongeWidth } from '../src/lbm/solver.js';
import { rasterize } from '../src/lbm/raster.js';
import { cylinder, strokeToShape, ramp, dragShape, ellipseShape, flappingFoil, fish } from '../src/lbm/bodies.js';
import { strouhal } from '../src/lbm/measure.js';
import { SCENES, defaults, advance, paramMax, clampParams, QUALITY } from '../src/lbm/scenes.js';

test('fluid at rest stays at rest', () => {
  const lat = new Lattice({ nx: 32, ny: 32, nu: 0.05, periodic: true });
  for (let k = 0; k < 200; k++) lat.step();
  let m = 0;
  for (let i = 0; i < lat.N; i++) m = Math.max(m, Math.abs(lat.ux[i]), Math.abs(lat.uy[i]), Math.abs(lat.rho[i] - 1));
  assert.ok(m < 1e-12, `max deviation ${m}`);
});

test('shear wave decays at the set viscosity (within 2%)', () => {
  // u_x(y) = u0 sin(2 pi y / L) decays as exp(-nu k^2 t): a direct test of the collision step.
  for (const nu of [0.01, 0.05, 0.1]) {
    const L = 64, u0 = 0.01, k = (2 * Math.PI) / L;
    const lat = new Lattice({ nx: 8, ny: L, nu, periodic: true });
    lat.initEquilibrium((x, y) => u0 * Math.sin(k * y), () => 0);
    const amp = () => { let s = 0; for (let y = 0; y < L; y++) s += lat.ux[y * 8] * Math.sin(k * y); return (2 * s) / L; };
    lat.step();
    const a0 = amp(), t0 = lat.time;
    for (let n = 0; n < 600; n++) lat.step();
    const nuMeasured = -Math.log(amp() / a0) / (k * k * (lat.time - t0));
    assert.ok(Math.abs(nuMeasured - nu) / nu < 0.02, `nu ${nu}: measured ${nuMeasured}`);
  }
});

test('mass is conserved around a fixed body (periodic box)', () => {
  const lat = new Lattice({ nx: 64, ny: 64, nu: 0.03, U: 0.05, periodic: true });
  lat.applyBody(cylinder({ cx: 32, cy: 32, D: 12 }));
  const mass = () => { let s = 0; for (let i = 0; i < lat.N; i++) if (!lat.solid[i]) for (let d = 0; d < 9; d++) s += lat.f[d * lat.N + i]; return s; };
  const m0 = mass();
  for (let k = 0; k < 500; k++) lat.step();
  assert.ok(Math.abs(mass() - m0) / m0 < 1e-10, `drift ${(mass() - m0) / m0}`);
});

test('rasteriser: a circle covers about pi r^2 cells', () => {
  const grid = { nx: 100, ny: 100, solid: new Uint8Array(10000), uwx: new Float32Array(10000), uwy: new Float32Array(10000), box: null };
  rasterize(cylinder({ cx: 50.3, cy: 49.7, D: 30 }), grid, () => {});
  const n = grid.solid.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(n - Math.PI * 225) / (Math.PI * 225) < 0.03, `cells ${n}`);
});

test('rasteriser: moving a body uncovers exactly the cells it left', () => {
  const grid = { nx: 80, ny: 40, solid: new Uint8Array(3200), uwx: new Float32Array(3200), uwy: new Float32Array(3200), box: null };
  const b = dragShape({ shape: ellipseShape(5, 5), cx: 20, cy: 20, size: 10 });
  rasterize(b, grid, () => {});
  const count = () => grid.solid.reduce((a, c) => a + c, 0);
  const before = count();
  b.center = [32, 20]; b.update(); // moved 12 cells: no overlap with the old position
  let freed = 0;
  rasterize(b, grid, () => freed++);
  assert.equal(freed, before);
  assert.equal(count(), before);
});

test('Strouhal detector finds a known period (within 1%)', () => {
  const sig = Float64Array.from({ length: 5000 }, (_, i) => 0.4 * Math.sin((2 * Math.PI * i) / 237) + 0.01 * Math.sin(i * 1.7));
  const r = strouhal(sig);
  assert.ok(Math.abs(r.period - 237) / 237 < 0.01, `period ${r.period}`);
  assert.ok(Number.isNaN(strouhal(new Float64Array(1000).fill(0.3)).period), 'flat signal has no period');
});

test('wall velocities match the motion (finite difference)', () => {
  const b = flappingFoil({ px: 100, py: 100, c: 50, h0: 10, f: 0.002, theta0: 0.2 });
  b.update(700); const p1 = [...b.polygon]; const v = b.velocity(p1[30], p1[31]); b.update(701);
  assert.ok(Math.hypot(b.polygon[30] - p1[30] - v[0], b.polygon[31] - p1[31] - v[1]) < 2e-3);
  const fsh = fish({ hx: 50, hy: 50, L: 100, f: 0.002 });
  fsh.update(900); const y1 = fsh.midline(0.8); const vy = fsh.velocity(130)[1]; fsh.update(901);
  assert.ok(Math.abs(fsh.midline(0.8) - y1 - vy) < 2e-3);
});

test('smooth start ramp goes 0 to 1', () => {
  assert.equal(ramp(0, 100)[0], 0);
  assert.equal(ramp(100, 100)[0], 1);
  assert.ok(Math.abs(ramp(50, 100)[0] - 0.5) < 1e-12);
});

test('sponge: viscosity is untouched in the middle and rises at the edges', () => {
  const nx = 600, w = spongeWidth(nx);
  assert.equal(spongeNu(0.01, 300, nx), 0.01);
  assert.equal(spongeNu(0.01, w, nx), 0.01);
  assert.ok(spongeNu(0.01, 0, nx) > 0.09 && spongeNu(0.01, nx - 1, nx) > 0.09);
});

test('stroke to shape: a drawn loop becomes a centred polygon, a scribble does not', () => {
  const loop = Array.from({ length: 60 }, (_, i) => [50 + 15 * Math.cos(i / 9.5), 40 + 10 * Math.sin(i / 9.5)]);
  const s = strokeToShape(loop);
  assert.ok(s && Math.abs(s.cx - 50) < 1 && Math.abs(s.cy - 40) < 1);
  assert.equal(strokeToShape([[1, 1], [2, 2], [3, 3]]), null);
  assert.equal(strokeToShape(Array.from({ length: 30 }, (_, i) => [10 + i * 0.1, 10])), null);
});

test('slider limits follow Re_max = 3 U D / (tau_min - 1/2) and keep tau above the floor', () => {
  for (const sc of SCENES.filter((x) => x.params.some((p) => p.key === 'Re'))) for (const q of Object.values(QUALITY)) {
    const p = clampParams(sc, { ...defaults(sc), Re: 1e9 }, q);
    const { D, U } = sc.geom(q);
    const tau = 3 * ((U * D) / p.Re) + 0.5;
    assert.ok(tau >= sc.tauMin - 1e-9, `${sc.id} q=${q}: tau ${tau}`);
    assert.equal(p.Re, paramMax(sc, sc.params.find((x) => x.key === 'Re'), q));
  }
});

test('every scene runs its defaults without blowing up (CPU, 300 steps)', () => {
  for (const sc of SCENES) {
    const s = sc.build(defaults(sc), 0.75);
    if (s.body.steer) s.body.target = [s.lat.nx * 0.6, s.lat.ny * 0.5];
    for (let k = 0; k < 300; k++) advance(s);
    assert.ok(!s.lat.hasNaN(), sc.id);
  }
});
