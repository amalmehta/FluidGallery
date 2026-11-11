// One validation case on the CPU reference solver. Prints a JSON line with the measurements.
// node tools/validate-case.mjs <case>
import { byId, advance } from '../src/lbm/scenes.js';
import { strouhal } from '../src/lbm/measure.js';

export const CASES = {
  'cylinder-re100-q1': { scene: 'cylinder', p: { Re: 100 }, q: 1, steps: 30000 },
  'cylinder-re100-q125': { scene: 'cylinder', p: { Re: 100 }, q: 1.25, steps: 37000 },
  'cylinder-re40-q1': { scene: 'cylinder', p: { Re: 40 }, q: 1, steps: 25000 },
  'spinning-a05': { scene: 'spinning', p: { alpha: 0.5, Re: 100 }, q: 1, steps: 40000 },
  'spinning-a10': { scene: 'spinning', p: { alpha: 1.0, Re: 100 }, q: 1, steps: 40000 },
  'spinning-a15': { scene: 'spinning', p: { alpha: 1.5, Re: 100 }, q: 1, steps: 40000 },
  'spinning-a20': { scene: 'spinning', p: { alpha: 2.0, Re: 100 }, q: 1, steps: 40000 },
  'foil-st010': { scene: 'foil', p: { St: 0.1, pitch: 0, Re: 250 }, q: 1, steps: 22000 },
  'foil-st040': { scene: 'foil', p: { St: 0.4, pitch: 0, Re: 250 }, q: 1, steps: 22000 },
  'fish-st020': { scene: 'fish', p: { St: 0.2, Re: 400 }, q: 1, steps: 16000 },
  'fish-st035': { scene: 'fish', p: { St: 0.35, Re: 400 }, q: 1, steps: 16000 },
  'fish-st050': { scene: 'fish', p: { St: 0.5, Re: 400 }, q: 1, steps: 16000 },
};

const name = process.argv[2];
if (name) {
  const c = CASES[name];
  const sc = byId(c.scene);
  const s = sc.build(c.p, c.q);
  const t0 = Date.now();
  const cd = new Float64Array(c.steps), cl = new Float64Array(c.steps);
  for (let k = 0; k < c.steps; k++) {
    advance(s);
    cd[k] = s.lat.fx / s.meter.q; cl[k] = s.lat.fy / s.meter.q;
  }
  // Average over the last 40% of the run (well after start-up), trimmed to whole cycles if periodic.
  const from = Math.floor(c.steps * 0.6);
  const tailCl = cl.subarray(from);
  const r = strouhal(tailCl);
  let a = from, b = c.steps;
  if (r.period) { const n = Math.floor((b - a) / r.period); a = Math.round(b - n * r.period); }
  const mean = (arr) => { let t = 0; for (let k = a; k < b; k++) t += arr[k]; return t / (b - a); };
  const out = {
    name, scene: c.scene, params: c.p, q: c.q, steps: c.steps, D: s.D, U: s.U,
    grid: [s.lat.nx, s.lat.ny], tau: 3 * s.lat.nu + 0.5,
    cd: mean(cd), cl: mean(cl), clAmp: r.amp,
    st: r.period ? s.D / (r.period * s.U) : null,
    flapSt: c.p.St ?? null,
    nan: s.lat.hasNaN(), seconds: (Date.now() - t0) / 1000,
  };
  console.log(JSON.stringify(out));
}
