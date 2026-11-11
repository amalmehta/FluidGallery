// D2Q9 lattice Boltzmann solver with two-relaxation-time (TRT) collision.
// Pure JS, no DOM: the same file runs in the browser worker and in Node tests.
//
// Units are lattice units: one cell = 1 length, one step = 1 time, rest density = 1.
// Speed of sound cs = 1/sqrt(3); kinematic viscosity nu = (tau - 1/2) / 3.
//
// Directions (y points up):
//   6 2 5
//   3 0 1
//   7 4 8

import { rasterize } from './raster.js';

export const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
export const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
// Same direction with its y component flipped (free-slip walls).
const FLIPY = [0, 1, 4, 3, 2, 8, 7, 6, 5];

export class Lattice {
  constructor({ nx, ny, nu, U = 0, periodic = false }) {
    this.nx = nx;
    this.ny = ny;
    this.N = nx * ny;
    this.U = U; // inflow speed (left edge), lattice units
    this.periodic = periodic;
    const N = this.N;
    this.f = new Float64Array(9 * N);
    this.g = new Float64Array(9 * N);
    this.rho = new Float32Array(N).fill(1);
    this.ux = new Float32Array(N);
    this.uy = new Float32Array(N);
    this.solid = new Uint8Array(N);
    this.uwx = new Float32Array(N); // wall velocity of solid cells
    this.uwy = new Float32Array(N);
    this.fx = 0; // force on bodies during the last step (momentum exchange)
    this.fy = 0;
    this.time = 0;
    this.box = null; // region the moving body touched last step
    this.setViscosity(nu);
    this.initEquilibrium(() => U, () => 0);
  }

  setViscosity(nu) {
    this.nu = nu;
    // Per-column relaxation rates. Near the inlet and outlet a sponge raises the viscosity
    // smoothly so pressure waves and the odd-even mode the hard inlet excites die out there.
    const { nx } = this;
    if (!this.omPx) { this.omPx = new Float64Array(nx); this.omMx = new Float64Array(nx); }
    for (let x = 0; x < nx; x++) {
      const t = 3 * spongeNu(nu, x, nx, this.periodic) + 0.5;
      this.omPx[x] = 1 / t;
      // TRT "magic" parameter Lambda = (tau+ - 1/2)(tau- - 1/2) = 1/4: the choice with the best
      // stability (Ginzburg et al. 2008). Bounce-back walls sit exactly halfway only at Lambda = 3/16;
      // at 1/4 the wall position shifts slightly with viscosity (a known, small error).
      this.omMx[x] = 1 / (0.5 + 0.25 / (t - 0.5));
    }
  }

  initEquilibrium(uxFn, uyFn) {
    const { nx, ny, N, f } = this;
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const idx = y * nx + x;
        const ux = uxFn(x, y), uy = uyFn(x, y);
        this.ux[idx] = ux; this.uy[idx] = uy; this.rho[idx] = 1;
        for (let i = 0; i < 9; i++) f[i * N + idx] = feq(i, 1, ux, uy);
      }
  }

  // Rasterise a body into the solid mask (with wall velocities) and refill cells it uncovers
  // at equilibrium with the local wall speed and the mean density of fluid neighbours.
  applyBody(body) {
    const { nx, N, solid, f } = this;
    rasterize(body, this, (idx, x, y) => {
      let rs = 0, rc = 0;
      for (let i = 1; i < 9; i++) {
        const n2 = (y + CY[i]) * nx + (x + CX[i]);
        if (!solid[n2]) { rs += this.rho[n2]; rc++; }
      }
      const r = rc ? rs / rc : 1;
      const ux = this.uwx[idx], uy = this.uwy[idx];
      for (let i = 0; i < 9; i++) f[i * N + idx] = feq(i, r, ux, uy);
      this.rho[idx] = r; this.ux[idx] = ux; this.uy[idx] = uy;
    });
  }

  clearSolids() {
    this.solid.fill(0);
    this.box = null;
  }

  step() {
    const { nx, ny, N, f, g, solid, rho: R, ux: UX, uy: UY, omPx, omMx, periodic } = this;
    this._fx = 0; this._fy = 0;
    const post = this._post || (this._post = new Float64Array(9));
    const N2 = 2 * N, N3 = 3 * N, N4 = 4 * N, N5 = 5 * N, N6 = 6 * N, N7 = 7 * N, N8 = 8 * N;
    for (let y = 0; y < ny; y++) {
      const edgeRow = periodic || y === 0 || y === ny - 1;
      for (let x = 0; x < nx; x++) {
        const idx = y * nx + x;
        if (solid[idx]) continue;
        const omP = omPx[x], omM = omMx[x];
        const f0 = f[idx], f1 = f[N + idx], f2 = f[N2 + idx], f3 = f[N3 + idx], f4 = f[N4 + idx];
        const f5 = f[N5 + idx], f6 = f[N6 + idx], f7 = f[N7 + idx], f8 = f[N8 + idx];
        const rho = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
        const ir = 1 / rho;
        const ux = (f1 - f3 + f5 - f6 - f7 + f8) * ir;
        const uy = (f2 - f4 + f5 + f6 - f7 - f8) * ir;
        R[idx] = rho; UX[idx] = ux; UY[idx] = uy;
        const usq = 1.5 * (ux * ux + uy * uy);
        // TRT: relax the even (symmetric) and odd (antisymmetric) parts of each
        // direction pair towards equilibrium at different rates.
        const r9 = rho / 9, r36 = rho / 36;
        let cu = 3 * ux;
        let a = omP * (0.5 * (f1 + f3) - r9 * (1 + 0.5 * cu * cu - usq));
        let b = omM * (0.5 * (f1 - f3) - r9 * cu);
        const p1 = f1 - a - b, p3 = f3 - a + b;
        cu = 3 * uy;
        a = omP * (0.5 * (f2 + f4) - r9 * (1 + 0.5 * cu * cu - usq));
        b = omM * (0.5 * (f2 - f4) - r9 * cu);
        const p2 = f2 - a - b, p4 = f4 - a + b;
        cu = 3 * (ux + uy);
        a = omP * (0.5 * (f5 + f7) - r36 * (1 + 0.5 * cu * cu - usq));
        b = omM * (0.5 * (f5 - f7) - r36 * cu);
        const p5 = f5 - a - b, p7 = f7 - a + b;
        cu = 3 * (uy - ux);
        a = omP * (0.5 * (f6 + f8) - r36 * (1 + 0.5 * cu * cu - usq));
        b = omM * (0.5 * (f6 - f8) - r36 * cu);
        const p6 = f6 - a - b, p8 = f8 - a + b;
        g[idx] = f0 - omP * (f0 - (4 / 9) * rho * (1 - usq));

        if (!edgeRow && x > 0 && x < nx - 1) {
          // Interior fast path: no domain edges to worry about.
          let t;
          t = idx + 1; if (solid[t]) this._bounce(1, p1, idx, t, rho); else g[N + t] = p1;
          t = idx + nx; if (solid[t]) this._bounce(2, p2, idx, t, rho); else g[N2 + t] = p2;
          t = idx - 1; if (solid[t]) this._bounce(3, p3, idx, t, rho); else g[N3 + t] = p3;
          t = idx - nx; if (solid[t]) this._bounce(4, p4, idx, t, rho); else g[N4 + t] = p4;
          t = idx + nx + 1; if (solid[t]) this._bounce(5, p5, idx, t, rho); else g[N5 + t] = p5;
          t = idx + nx - 1; if (solid[t]) this._bounce(6, p6, idx, t, rho); else g[N6 + t] = p6;
          t = idx - nx - 1; if (solid[t]) this._bounce(7, p7, idx, t, rho); else g[N7 + t] = p7;
          t = idx - nx + 1; if (solid[t]) this._bounce(8, p8, idx, t, rho); else g[N8 + t] = p8;
          continue;
        }
        post[1] = p1; post[2] = p2; post[3] = p3; post[4] = p4;
        post[5] = p5; post[6] = p6; post[7] = p7; post[8] = p8;
        for (let i = 1; i < 9; i++) {
          const v = post[i];
          let tx = x + CX[i], ty = y + CY[i], dir = i;
          if (periodic) {
            if (tx < 0) tx += nx; else if (tx >= nx) tx -= nx;
            if (ty < 0) ty += ny; else if (ty >= ny) ty -= ny;
          } else {
            if (tx < 0 || tx >= nx) continue; // left/right columns are reset below
            if (ty < 0 || ty >= ny) { ty = y; dir = FLIPY[i]; } // free-slip wall: mirror vertically
          }
          const t = ty * nx + tx;
          if (solid[t]) this._bounce(i, v, idx, t, rho);
          else g[dir * N + t] = v;
        }
      }
    }
    if (!periodic) this._edges();
    this.f = g;
    this.g = f;
    this.fx = this._fx;
    this.fy = this._fy;
    this.time++;
  }

  // Bounce back from a (possibly moving) wall, with Ladd's correction 2 w rho (c·uw) / cs^2,
  // and add the Galilean-corrected momentum exchange (Wen et al. 2014) to the body force.
  _bounce(i, v, idx, t, rho) {
    const wx = this.uwx[t], wy = this.uwy[t];
    const vb = v - 6 * W[i] * rho * (CX[i] * wx + CY[i] * wy);
    this.g[OPP[i] * this.N + idx] = vb;
    this._fx += CX[i] * (v + vb) - wx * (v - vb);
    this._fy += CY[i] * (v + vb) - wy * (v - vb);
  }

  // Inflow (left): equilibrium at rho = 1, u = (U, 0). Outflow (right): zero gradient.
  _edges() {
    const { nx, ny, N, g, U } = this;
    for (let y = 0; y < ny; y++) {
      const a = y * nx, z = y * nx + nx - 1;
      for (let i = 0; i < 9; i++) {
        g[i * N + a] = feq(i, 1, U, 0);
        g[i * N + z] = g[i * N + z - 1];
      }
    }
  }

  hasNaN() {
    const { rho } = this;
    for (let i = 0; i < rho.length; i += 97) if (!(rho[i] > 0 && rho[i] < 10)) return true;
    return false;
  }
}

// Sponge layers: viscosity rises smoothly (quadratically) to NU_SPONGE over the first and last
// SPONGE columns. Bodies sit well inside, where nu is the value set from the Reynolds number.
export const SPONGE_FRAC = 1 / 15, SPONGE_MAX = 40, NU_SPONGE = 0.1;
export function spongeWidth(nx) { return Math.min(SPONGE_MAX, Math.round(nx * SPONGE_FRAC)); }
export function spongeNu(nu, x, nx, periodic = false) {
  if (periodic) return nu;
  const w = spongeWidth(nx);
  const d = Math.min(x, nx - 1 - x);
  if (d >= w) return nu;
  const s = (w - d) / w;
  return nu + (Math.max(nu, NU_SPONGE) - nu) * s * s;
}

export function feq(i, rho, ux, uy) {
  const cu = 3 * (CX[i] * ux + CY[i] * uy);
  return W[i] * rho * (1 + cu + 0.5 * cu * cu - 1.5 * (ux * ux + uy * uy));
}
