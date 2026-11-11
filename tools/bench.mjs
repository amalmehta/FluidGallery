// Quick speed + sanity run: node tools/bench.mjs [sceneId] [steps]
import { byId, defaults, advance } from '../src/lbm/scenes.js';

const id = process.argv[2] || 'cylinder';
const steps = +(process.argv[3] || 2000);
const sc = byId(id);
const s = sc.build(defaults(sc), 1);
const t0 = performance.now();
for (let i = 0; i < steps; i++) advance(s);
const ms = performance.now() - t0;
const cells = s.lat.nx * s.lat.ny;
console.log(`${id}: ${s.lat.nx}x${s.lat.ny}, ${steps} steps in ${ms.toFixed(0)} ms -> ${((cells * steps) / ms / 1000).toFixed(1)} MLUPS, ${(steps / ms * 1000).toFixed(0)} steps/s`);
console.log('summary', s.meter.summary(), 'NaN?', s.lat.hasNaN());
