// Turns a body polygon into solid cells (cell centres at integer coordinates), shared by the
// CPU and GPU solvers. Only the region the body covered last call or covers now is visited.
//
// grid: { nx, ny, solid: Uint8Array, uwx, uwy: Float32Array, box: [x0,x1,y0,y1] | null }
// onUncover(idx, x, y): called for cells that were solid and are now fluid.
// Returns the visited box [x0, x1, y0, y1].
export function rasterize(body, grid, onUncover) {
  const { nx, ny, solid, uwx, uwy } = grid;
  const poly = body.polygon;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < poly.length; k += 2) {
    const px = poly[k], py = poly[k + 1];
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
  let bx0 = Math.max(1, Math.floor(x0) - 1), bx1 = Math.min(nx - 2, Math.ceil(x1) + 1);
  let by0 = Math.max(1, Math.floor(y0) - 1), by1 = Math.min(ny - 2, Math.ceil(y1) + 1);
  const newBox = [bx0, bx1, by0, by1];
  if (grid.box) {
    bx0 = Math.min(bx0, grid.box[0]); bx1 = Math.max(bx1, grid.box[1]);
    by0 = Math.min(by0, grid.box[2]); by1 = Math.max(by1, grid.box[3]);
  }
  grid.box = newBox;
  const row = grid._row || (grid._row = new Uint8Array(nx));
  const nv = poly.length >> 1;
  if (!grid._xs || grid._xs.length < nv) grid._xs = new Float64Array(nv * 2);
  const xs = grid._xs;
  for (let y = by0; y <= by1; y++) {
    // Scanline fill: where do polygon edges cross this row?
    const yy = y + 1e-6;
    let n = 0;
    for (let k = 0, j = nv - 1; k < nv; j = k++) {
      const ay = poly[2 * k + 1], by = poly[2 * j + 1];
      if ((ay > yy) !== (by > yy)) {
        const ax = poly[2 * k], bxp = poly[2 * j];
        xs[n++] = ax + ((yy - ay) * (bxp - ax)) / (by - ay);
      }
    }
    for (let a = 1; a < n; a++) {
      const v = xs[a]; let b = a - 1;
      while (b >= 0 && xs[b] > v) { xs[b + 1] = xs[b]; b--; }
      xs[b + 1] = v;
    }
    for (let x = bx0; x <= bx1; x++) row[x] = 0;
    for (let a = 0; a + 1 < n; a += 2) {
      const s = Math.max(bx0, Math.ceil(xs[a])), e = Math.min(bx1, Math.floor(xs[a + 1]));
      for (let x = s; x <= e; x++) row[x] = 1;
    }
    for (let x = bx0; x <= bx1; x++) {
      const idx = y * nx + x;
      if (row[x]) {
        const v = body.velocity(x, y);
        uwx[idx] = v[0]; uwy[idx] = v[1];
        solid[idx] = 1;
      } else if (solid[idx]) {
        const v = body.velocity(x, y);
        uwx[idx] = v[0]; uwy[idx] = v[1];
        solid[idx] = 0;
        onUncover(idx, x, y);
      }
    }
  }
  return [bx0, bx1, by0, by1];
}

// Bounding box of a polygon grown by `pad`, clamped to the grid.
export function polyBox(poly, nx, ny, pad = 2) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < poly.length; k += 2) {
    x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]);
    y0 = Math.min(y0, poly[k + 1]); y1 = Math.max(y1, poly[k + 1]);
  }
  return [Math.max(0, Math.floor(x0) - pad), Math.min(nx - 1, Math.ceil(x1) + pad),
    Math.max(0, Math.floor(y0) - pad), Math.min(ny - 1, Math.ceil(y1) + pad)];
}
