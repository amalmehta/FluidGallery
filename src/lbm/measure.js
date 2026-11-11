// Turns the raw force on a body into coefficients, and finds the shedding frequency.
//   C_D = F_x / (1/2 rho U^2 D),  C_L = F_y / (1/2 rho U^2 D),  St = f D / U.

export class Meter {
  constructor({ U, refLength, window = 6000, cap = 40000, chartEvery = 20, chartLen = 300 }) {
    this.U = U;
    this.D = refLength;
    this.q = 0.5 * U * U * refLength; // rho = 1
    this.window = window;
    this.cap = cap;
    this.cd = new Float32Array(cap);
    this.cl = new Float32Array(cap);
    this.n = 0; // total samples pushed
    this.chartEvery = chartEvery;
    this.chartLen = chartLen;
    this.chartCd = [];
    this.chartCl = [];
    this._acc = [0, 0, 0];
  }

  reset() {
    this.n = 0; this.chartCd = []; this.chartCl = []; this._acc = [0, 0, 0];
  }

  push(fx, fy) {
    const cd = fx / this.q, cl = fy / this.q;
    const k = this.n % this.cap;
    this.cd[k] = cd; this.cl[k] = cl;
    this.n++;
    const a = this._acc;
    a[0] += cd; a[1] += cl; a[2]++;
    if (a[2] >= this.chartEvery) {
      this.chartCd.push(a[0] / a[2]); this.chartCl.push(a[1] / a[2]);
      if (this.chartCd.length > this.chartLen) { this.chartCd.shift(); this.chartCl.shift(); }
      this._acc = [0, 0, 0];
    }
  }

  // The last `len` samples of a series, oldest first.
  series(arr, len) {
    len = Math.min(len, this.n, this.cap);
    const out = new Float64Array(len);
    for (let i = 0; i < len; i++) out[i] = arr[(this.n - len + i) % this.cap];
    return out;
  }

  // Mean of the last n samples (cheap; used every frame for the force arrow).
  recent(n = 50) {
    const len = Math.min(n, this.n, this.cap);
    if (!len) return { cd: NaN, cl: NaN };
    let a = 0, b = 0;
    for (let i = 0; i < len; i++) { const k = (this.n - 1 - i) % this.cap; a += this.cd[k]; b += this.cl[k]; }
    return { cd: a / len, cl: b / len };
  }

  summary() {
    const len = Math.min(this.window, this.n);
    if (len < 50) return { cd: NaN, cl: NaN, cdNow: NaN, clNow: NaN, st: NaN, clAmp: NaN };
    const cd = this.series(this.cd, len), cl = this.series(this.cl, len);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const tail = Math.min(50, len);
    const r = strouhal(cl);
    return {
      cd: mean(cd),
      cl: mean(cl),
      cdNow: mean(cd.subarray(len - tail)),
      clNow: mean(cl.subarray(len - tail)),
      clAmp: r.amp,
      st: r.period ? this.D / (r.period * this.U) : NaN,
      period: r.period,
    };
  }
}

// Period (in samples) of an oscillating signal from its upward mean crossings.
// Returns period = NaN if fewer than 3 crossings or the swing is tiny.
export function strouhal(sig, minAmp = 0.02) {
  const n = sig.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += sig[i];
  m /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (sig[i] - m) ** 2;
  const amp = Math.sqrt((2 * v) / n); // amplitude of an equivalent sine
  if (!(amp > minAmp)) return { period: NaN, amp };
  // light smoothing so per-step noise does not create false crossings
  const k = 15;
  const s = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += sig[i] - m;
    if (i >= k) acc -= sig[i - k] - m;
    s[i] = acc / Math.min(i + 1, k);
  }
  const cross = [];
  const hyst = amp * 0.2;
  let armed = false;
  for (let i = 1; i < n; i++) {
    if (s[i] < -hyst) armed = true;
    if (armed && s[i - 1] < 0 && s[i] >= 0) {
      cross.push(i - 1 + -s[i - 1] / (s[i] - s[i - 1]));
      armed = false;
    }
  }
  if (cross.length < 3) return { period: NaN, amp };
  return { period: (cross[cross.length - 1] - cross[0]) / (cross.length - 1), amp };
}
