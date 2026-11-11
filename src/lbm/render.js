// Colour map shared by the GPU shader and the CPU renderer.
// Vorticity (spin of the fluid): clockwise = blue, counter-clockwise = terracotta, none = background.

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export const PALETTES = {
  light: { bg: hex('#F7F3EC'), neg: hex('#3E6A9E'), pos: hex('#C2643F'), ink: hex('#2B2824') },
  dark: { bg: hex('#171512'), neg: hex('#7FA6D6'), pos: hex('#E08C68'), ink: hex('#EDE6DA') },
};

export const CONTRAST = { low: 4, medium: 2.5, high: 1.5 };

// Multiplier so that tanh(omega * scale) uses the range well: vorticity in units of U/D.
export const vortScale = (U, D, contrast = 'medium') => D / (U * (CONTRAST[contrast] || 2.5));

// CPU path: draw a Lattice into an RGBA buffer (row 0 at the top), one pixel per cell.
export function renderField(lat, scale, colors, rgba) {
  const { nx, ny, ux, uy, solid, uwx, uwy } = lat;
  const vx = (i) => (solid[i] ? uwx[i] : ux[i]);
  const vy = (i) => (solid[i] ? uwy[i] : uy[i]);
  const { bg, neg, pos, ink } = colors;
  for (let y = 0; y < ny; y++) {
    const ym = Math.max(0, y - 1), yp = Math.min(ny - 1, y + 1);
    for (let x = 0; x < nx; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(nx - 1, x + 1);
      const i = y * nx + x;
      const o = 4 * ((ny - 1 - y) * nx + x);
      let c;
      if (solid[i]) c = ink;
      else {
        const w = 0.5 * (vy(y * nx + xp) - vy(y * nx + xm)) - 0.5 * (vx(yp * nx + x) - vx(ym * nx + x));
        const t = Math.tanh(w * scale);
        const a = Math.pow(Math.max(Math.abs(t) - 0.06, 0) / 0.94, 0.85), tc = t < 0 ? neg : pos; // dead zone: see gpu.js
        c = [bg[0] + (tc[0] - bg[0]) * a, bg[1] + (tc[1] - bg[1]) * a, bg[2] + (tc[2] - bg[2]) * a];
      }
      rgba[o] = c[0] * 255; rgba[o + 1] = c[1] * 255; rgba[o + 2] = c[2] * 255; rgba[o + 3] = 255;
    }
  }
  return rgba;
}
