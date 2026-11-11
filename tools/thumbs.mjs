// Gallery thumbnails from real runs of the CPU reference solver (not mock images).
// node tools/thumbs.mjs [sceneId ...]   -> assets/thumbs/<id>-light.png, <id>-dark.png
import { mkdirSync } from 'node:fs';
import { byId, defaults, advance, SCENES } from '../src/lbm/scenes.js';
import { PALETTES, vortScale } from '../src/lbm/render.js';
import { writePNG } from './png.mjs';

const Q = 0.75; // quality used for thumbnails (CPU is slow; output is upsampled 2x)
// steps to run so the wake is developed (several shedding / flapping cycles)
const STEPS = { cylinder: 14000, spinning: 16000, foil: 10000, fish: 9000, draw: 3600 };

function render(s, palette, up = 2) {
  const { lat } = s;
  const { nx, ny, ux, uy, solid, uwx, uwy } = lat;
  const vx = (i) => (solid[i] ? uwx[i] : ux[i]);
  const vy = (i) => (solid[i] ? uwy[i] : uy[i]);
  const w = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(nx - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(ny - 1, y + 1);
      w[y * nx + x] = 0.5 * (vy(y * nx + xp) - vy(y * nx + xm)) - 0.5 * (vx(yp * nx + x) - vx(ym * nx + x));
    }
  const scale = vortScale(s.U, s.D * s.vortLen, 'medium');
  const W = nx * up, H = ny * up;
  const out = new Uint8ClampedArray(W * H * 4);
  const { bg, neg, pos, ink } = palette;
  const sample = (arr, fx, fy) => {
    const x0 = Math.max(0, Math.min(nx - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    const a = arr[y0 * nx + x0], b = arr[y0 * nx + x0 + 1], c = arr[(y0 + 1) * nx + x0], d = arr[(y0 + 1) * nx + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const fx = (i + 0.5) / up - 0.5, fy = (H - 1 - j + 0.5) / up - 0.5;
      const t = Math.tanh(sample(w, fx, fy) * scale);
      const a = Math.pow(Math.max(Math.abs(t) - 0.06, 0) / 0.94, 0.85), tc = t < 0 ? neg : pos;
      let c = bg.map((v, k) => v + (tc[k] - v) * a);
      const sf = sample(solid, fx, fy);
      const m = Math.min(1, Math.max(0, (sf - 0.35) / 0.3));
      c = c.map((v, k) => v + (ink[k] - v) * m * m * (3 - 2 * m));
      const o = 4 * (j * W + i);
      out[o] = c[0] * 255; out[o + 1] = c[1] * 255; out[o + 2] = c[2] * 255; out[o + 3] = 255;
    }
  return { W, H, out };
}

mkdirSync('assets/thumbs', { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : SCENES.map((s) => s.id);
for (const id of ids) {
  const sc = byId(id);
  const s = sc.build(defaults(sc), Q);
  s.vortLen = sc.vortLen;
  if (s.body.steer) s.body.target = [s.lat.nx * 0.78, s.lat.ny * 0.5];
  const t0 = Date.now();
  for (let k = 0; k < STEPS[id]; k++) advance(s);
  for (const [name, pal] of Object.entries(PALETTES)) {
    const { W, H, out } = render(s, pal);
    writePNG(`assets/thumbs/${id}-${name}.png`, W, H, out);
  }
  console.log(`${id}: ${STEPS[id]} steps in ${((Date.now() - t0) / 1000).toFixed(0)} s, NaN=${s.lat.hasNaN()}, ${JSON.stringify(s.meter.summary(), (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v))}`);
}
