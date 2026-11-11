// Bodies: a polygon (grid units, y up) plus the wall velocity at any point inside it.
// Every body exposes { polygon, velocity(x, y), update(t), moving, refLength, center }.

const TAU = Math.PI * 2;

// Smooth start: amplitude eases from 0 to 1 over T steps (r) with its rate of change (rd),
// so a body does not start impulsively and send pressure waves around the domain.
export function ramp(t, T) {
  if (t >= T) return [1, 0];
  return [0.5 * (1 - Math.cos((Math.PI * t) / T)), ((0.5 * Math.PI) / T) * Math.sin((Math.PI * t) / T)];
}

// NACA 00xx half-thickness at chord fraction s (0..1), for thickness ratio t.
export function nacaHalf(s, t = 0.12) {
  return 5 * t * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1015 * s ** 4);
}

// Circular cylinder. alpha = surface speed / free-stream speed; alpha > 0 spins clockwise,
// so the top moves with a left-to-right stream and lift points up (Magnus effect).
export function cylinder({ cx, cy, D, alpha = 0, U = 0 }) {
  const n = 96, R = D / 2;
  const polygon = new Float64Array(2 * n);
  for (let k = 0; k < n; k++) {
    polygon[2 * k] = cx + R * Math.cos((TAU * k) / n);
    polygon[2 * k + 1] = cy + R * Math.sin((TAU * k) / n);
  }
  const body = {
    polygon, moving: false, refLength: D, center: [cx, cy],
    alpha: 0, target: alpha, // spin eases toward the target so it never starts impulsively
    omega: 0,
    velocity(x, y) { return [this.omega * (y - cy), -this.omega * (x - cx)]; },
    update() {
      if (this.alpha === this.target) return;
      const step = 0.002; // max change in alpha per lattice step
      const d = this.target - this.alpha;
      this.alpha = Math.abs(d) <= step ? this.target : this.alpha + Math.sign(d) * step;
      this.omega = (2 * this.alpha * U) / D;
      this.dirty = true;
    },
    setAlpha(a) { this.target = a; },
  };
  return body;
}

// NACA 0012 airfoil heaving h(t) = h0 sin(2 pi f t) and pitching theta(t) = theta0 sin(2 pi f t + 90°)
// about its quarter chord. theta > 0 is nose up.
export function flappingFoil({ px, py, c, h0, f, theta0 = 0 }) {
  const n = 60;
  const base = [];
  for (let k = 0; k <= n; k++) { // upper surface, leading edge -> trailing edge
    const s = (1 - Math.cos((Math.PI * k) / n)) / 2;
    base.push([s * c - 0.25 * c, nacaHalf(s) * c]);
  }
  for (let k = n - 1; k >= 1; k--) { // lower surface back to the nose
    const s = (1 - Math.cos((Math.PI * k) / n)) / 2;
    base.push([s * c - 0.25 * c, -nacaHalf(s) * c]);
  }
  const polygon = new Float64Array(base.length * 2);
  const body = {
    polygon, moving: true, refLength: c, center: [px, py], h0, f, theta0, rampT: f > 0 ? Math.min(4000, Math.round(1 / f)) : 1000,
    _h: 0, _hd: 0, _om: 0, _ph: 0, _lt: 0,
    update(t) {
      // Accumulate phase so changing f mid-run does not make the body jump.
      this._ph += TAU * this.f * (t - this._lt); this._lt = t;
      const w = TAU * this.f, ph = this._ph;
      const [r, rd] = ramp(t, this.rampT);
      const h = r * this.h0 * Math.sin(ph), hd = r * this.h0 * w * Math.cos(ph) + rd * this.h0 * Math.sin(ph);
      const th = r * this.theta0 * Math.sin(ph + Math.PI / 2);
      const thd = r * this.theta0 * w * Math.cos(ph + Math.PI / 2) + rd * this.theta0 * Math.sin(ph + Math.PI / 2);
      const phi = -th; // nose up = clockwise rotation in y-up coordinates
      this._h = h; this._hd = hd; this._om = -thd;
      const cs = Math.cos(phi), sn = Math.sin(phi);
      for (let k = 0; k < base.length; k++) {
        const [bx, by] = base[k];
        polygon[2 * k] = px + bx * cs - by * sn;
        polygon[2 * k + 1] = py + h + bx * sn + by * cs;
      }
      this.center = [px, py + h];
    },
    velocity(x, y) {
      const rx = x - px, ry = y - (py + this._h);
      return [-this._om * ry, this._hd + this._om * rx];
    },
  };
  body.update(0);
  return body;
}

// Carangiform swimmer, tethered in a current. Midline (Khalid et al., arXiv 2010.04748, Eq. 1–2):
//   y(s, t) = L A(s) sin(2 pi (s / lambda - f t)),  A(s) = 0.02 - 0.0825 s + 0.1625 s^2,  s = x / L.
// Body thickness: NACA 0012 profile along the midline (a simplification, not a real fish section).
export function fish({ hx, hy, L, f, lambda = 1.05 }) {
  const n = 50;
  const ss = [];
  for (let k = 0; k <= n; k++) ss.push((1 - Math.cos((Math.PI * k) / n)) / 2);
  const m = ss.length;
  const polygon = new Float64Array(2 * (2 * m - 2));
  const amp = (s) => 0.02 - 0.0825 * s + 0.1625 * s * s;
  const body = {
    polygon, moving: true, refLength: L, center: [hx + L / 2, hy], f, lambda, _ph: 0, _lt: 0,
    // phase = 2 pi f t, accumulated so a change of f mid-run is smooth
    rampT: f > 0 ? Math.min(4000, Math.round(1 / f)) : 1000, _r: 0, _rd: 0,
    midline(s) { return this._r * L * amp(s) * Math.sin(TAU * s / this.lambda - this._ph); },
    update(t) {
      this._ph += TAU * this.f * (t - this._lt); this._lt = t;
      [this._r, this._rd] = ramp(t, this.rampT);
      let k = 0;
      for (let j = 0; j < m; j++) {
        const s = ss[j];
        polygon[k++] = hx + s * L;
        polygon[k++] = hy + this.midline(s) + nacaHalf(s) * L;
      }
      for (let j = m - 2; j >= 1; j--) {
        const s = ss[j];
        polygon[k++] = hx + s * L;
        polygon[k++] = hy + this.midline(s) - nacaHalf(s) * L;
      }
    },
    // Small-amplitude wall velocity: the lateral speed of the midline at this x.
    velocity(x) {
      const s = Math.min(1, Math.max(0, (x - hx) / L));
      const a = L * amp(s), arg = TAU * s / this.lambda - this._ph;
      return [0, -this._r * a * TAU * this.f * Math.cos(arg) + this._rd * a * Math.sin(arg)];
    },
  };
  body.update(0);
  return body;
}

// A rigid shape the user moves. `shape` is a flat array of points relative to its centroid.
export function dragShape({ shape, cx, cy, size }) {
  const polygon = new Float64Array(shape.length);
  const body = {
    polygon, moving: true, refLength: size, center: [cx, cy], shape,
    vx: 0, vy: 0, target: null,
    // Move toward the target: speed at most vmax, slowing as it arrives, and speed changes by at
    // most amax per step (inertia), so the body never jerks and sends pressure waves out.
    steer(vmax, lo, hi, amax = 0.002) {
      let [x, y] = this.center;
      let dvx = 0, dvy = 0;
      if (this.target) {
        const dx = this.target[0] - x, dy = this.target[1] - y;
        const d = Math.hypot(dx, dy);
        const sp = Math.min(vmax, Math.sqrt(2 * amax * d) * 0.9); // can still stop in time
        if (d > 1e-6) { dvx = (dx / d) * sp; dvy = (dy / d) * sp; }
      }
      let ax = dvx - this.vx, ay = dvy - this.vy;
      const a = Math.hypot(ax, ay);
      if (a > amax) { ax *= amax / a; ay *= amax / a; }
      this.vx += ax; this.vy += ay;
      const nx = Math.min(hi[0], Math.max(lo[0], x + this.vx));
      const ny = Math.min(hi[1], Math.max(lo[1], y + this.vy));
      if (nx !== x + this.vx) this.vx = 0; // hit the edge of the allowed box
      if (ny !== y + this.vy) this.vy = 0;
      this.center = [nx, ny];
    },
    update() {
      const [x, y] = this.center;
      for (let k = 0; k < shape.length; k += 2) { polygon[k] = x + shape[k]; polygon[k + 1] = y + shape[k + 1]; }
    },
    velocity() { return [this.vx, this.vy]; },
    contains(px, py) { return pointInPolygon(polygon, px, py); },
  };
  body.update();
  return body;
}

export function pointInPolygon(poly, px, py) {
  let inside = false;
  const n = poly.length >> 1;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[2 * i], yi = poly[2 * i + 1], xj = poly[2 * j], yj = poly[2 * j + 1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Turn a freehand stroke into a centred, simplified polygon. Returns null if it is too small.
export function strokeToShape(points, minSize = 8, maxPoints = 120) {
  if (points.length < 6) return null;
  // keep points at least 1.5 cells apart
  const pts = [points[0]];
  for (const p of points) {
    const q = pts[pts.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1.5) pts.push(p);
  }
  while (pts.length > maxPoints) for (let i = pts.length - 2; i > 0; i -= 2) pts.splice(i, 1);
  if (pts.length < 4) return null;
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cr = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    area += cr; cx += (pts[j][0] + pts[i][0]) * cr; cy += (pts[j][1] + pts[i][1]) * cr;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) return null;
  cx /= 6 * area; cy /= 6 * area;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const size = Math.max(x1 - x0, y1 - y0);
  if (size < minSize || Math.abs(area) < minSize * 2) return null;
  const shape = new Float64Array(pts.length * 2);
  pts.forEach(([x, y], i) => { shape[2 * i] = x - cx; shape[2 * i + 1] = y - cy; });
  return { shape, cx, cy, size: y1 - y0 || size };
}

export function ellipseShape(a, b, n = 64) {
  const s = new Float64Array(2 * n);
  for (let k = 0; k < n; k++) { s[2 * k] = a * Math.cos((TAU * k) / n); s[2 * k + 1] = b * Math.sin((TAU * k) / n); }
  return s;
}
