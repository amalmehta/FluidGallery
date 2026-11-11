// Renders assets/icon.svg's shapes to PNGs (apple-touch icon, social image) with antialiasing.
// The shapes are listed here once more because Node has no SVG renderer; keep both in sync.
import { writePNG } from './png.mjs';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const SHAPES = [
  { kind: 'rrect', x: 0, y: 0, w: 64, h: 64, r: 14, color: hex('#F7F3EC'), a: 1 },
  { kind: 'circle', cx: 17, cy: 32, r: 8, color: hex('#2B2824'), a: 1 },
  // vortices: three-quarter arcs (start angle, sweep in degrees, y down like SVG)
  { kind: 'arc', cx: 31, cy: 24.5, r: 5, w: 3.2, a0: 200, sw: 270, color: hex('#3E6A9E'), a: 1 },
  { kind: 'arc', cx: 42.5, cy: 39, r: 4.6, w: 3.0, a0: -20, sw: -270, color: hex('#C2643F'), a: 1 },
  { kind: 'arc', cx: 53, cy: 26.5, r: 3.6, w: 2.6, a0: 200, sw: 270, color: hex('#3E6A9E'), a: 0.7 },
];

// signed distance (negative inside) in icon units
function sd(s, x, y) {
  if (s.kind === 'circle') return Math.hypot(x - s.cx, y - s.cy) - s.r;
  if (s.kind === 'arc') {
    const rad = Math.PI / 180;
    let ang = Math.atan2(y - s.cy, x - s.cx) / rad;
    const lo = Math.min(s.a0, s.a0 + s.sw), hi = Math.max(s.a0, s.a0 + s.sw);
    while (ang < lo) ang += 360;
    while (ang > lo + 360) ang -= 360;
    if (ang <= hi) return Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r) - s.w / 2;
    const end = (d) => Math.hypot(x - (s.cx + s.r * Math.cos(d * rad)), y - (s.cy + s.r * Math.sin(d * rad))) - s.w / 2;
    return Math.min(end(lo), end(hi));
  }
  const qx = Math.abs(x - (s.x + s.w / 2)) - (s.w / 2 - s.r), qy = Math.abs(y - (s.y + s.h / 2)) - (s.h / 2 - s.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r;
}

function render(size, opaqueBg = null) {
  const px = new Uint8ClampedArray(size * size * 4);
  const k = 64 / size;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      let c = opaqueBg ? [...opaqueBg] : [0, 0, 0], a = opaqueBg ? 1 : 0;
      const x = (i + 0.5) * k, y = (j + 0.5) * k;
      for (const s of SHAPES) {
        const cov = Math.min(1, Math.max(0, 0.5 - sd(s, x, y) / k)) * s.a;
        if (cov <= 0) continue;
        const na = cov + a * (1 - cov);
        c = c.map((v, n) => (s.color[n] * cov + v * a * (1 - cov)) / na);
        a = na;
      }
      const o = 4 * (j * size + i);
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = a * 255;
    }
  return px;
}

writePNG('assets/icon-180.png', 180, 180, render(180, hex('#F7F3EC')));
writePNG('assets/icon-512.png', 512, 512, render(512));
writePNG('assets/icon-32.png', 32, 32, render(32));
console.log('wrote assets/icon-180.png, icon-512.png, icon-32.png');
