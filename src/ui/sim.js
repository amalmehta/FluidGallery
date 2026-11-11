import { SCENES, byId, defaults, paramMax, clampParams, QUALITY } from '../lbm/scenes.js';
import { CONTENT, METHOD, KINDS, CHECKS } from '../content.js';
import { VALIDATION } from '../validation.js';
import katex from '../../vendor/katex/katex.mjs';
import { header, icon, loadPrefs, applyPrefs, resolvedTheme, settings, settingsShortcut, feedbackTab, onSystemChange, toast, esc } from './common.js';

const prefs = loadPrefs();
applyPrefs(prefs);

const id = new URLSearchParams(location.search).get('id');
const scene = byId(id);
const main = document.getElementById('main');
const idx = SCENES.indexOf(scene);
const prev = scene && SCENES[(idx + SCENES.length - 1) % SCENES.length];
const next = scene && SCENES[(idx + 1) % SCENES.length];

document.getElementById('top').innerHTML = header(scene ? `
  <a class="icon-btn" href="sim.html?id=${prev.id}" title="Previous: ${esc(CONTENT[prev.id].title)} (←)" aria-label="Previous simulation">${icon('back')}</a>
  <a class="icon-btn" href="sim.html?id=${next.id}" title="Next: ${esc(CONTENT[next.id].title)} (→)" aria-label="Next simulation">${icon('next')}</a>` : '');
feedbackTab(scene ? CONTENT[id].title : 'Unknown sim');

if (!scene) {
  main.innerHTML = `<div class="empty"><img src="assets/icon.svg" alt=""><h2>That simulation doesn’t exist</h2>
    <p class="muted">The link may be old or mistyped. Here are all five.</p><a class="icon-btn primary" href="index.html">Open the gallery</a></div>`;
  document.getElementById('open-settings').onclick = () => settings(prefs, () => applyPrefs(prefs));
} else {
  start();
}

// Escaped text with $...$ spans typeset as inline maths.
function rich(s) {
  return String(s).split('$').map((part, i) => (i % 2 ? tex(part, false) : esc(part))).join('');
}

function tex(s, display = true) {
  try { return katex.renderToString(s, { displayMode: display, throwOnError: false, output: 'html' }); } catch { return esc(s); }
}

// What each scene shows in its number tiles.
const UNIT = { cylinder: 'diameters', spinning: 'diameters', foil: 'chords', fish: 'body lengths', draw: null };
const ARROW_REF = { cylinder: 1.5, spinning: 3, foil: 1, fish: 0.2, draw: 4 };
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');

function tiles(st, p) {
  const settling = st.settling;
  const s = (v, d) => (settling ? '…' : fmt(v, d));
  switch (id) {
    case 'cylinder': {
      const atRef = Math.abs(p.Re - 100) < 1e-9;
      const shedding = st.clAmp > 0.02;
      return [
        { k: 'Reynolds number', v: p.Re.toFixed(0) },
        { k: 'Strouhal number St', v: shedding ? s(st.st, 3) : (settling ? '…' : 'no shedding'), ref: atRef ? refLine(st.st, 0.165, 0.05) : p.Re < 47 ? 'steady below Re ≈ 47' : '' },
        { k: 'Mean drag <i>C</i><sub>D</sub>', v: s(st.cd, 2), ref: atRef ? refLine(st.cd, 1.33, 0.1) : '' },
        { k: 'Lift swing ±<i>C</i><sub>L</sub>', v: s(st.clAmp, 2) },
      ];
    }
    case 'spinning': {
      const ideal = 2 * Math.PI * p.alpha;
      return [
        { k: 'Spin ratio α', v: p.alpha.toFixed(1) },
        { k: 'Mean lift <i>C</i><sub>L</sub>', v: s(st.cl, 2), ref: `ideal flow 2πα = ${ideal.toFixed(2)}` },
        { k: 'Mean drag <i>C</i><sub>D</sub>', v: s(st.cd, 2) },
        { k: 'Shedding St', v: st.clAmp > 0.03 ? s(st.st, 3) : (settling ? '…' : 'none'), ref: p.alpha >= 1.9 ? 'expected: stops near α ≈ 1.9' : '' },
      ];
    }
    case 'foil':
      return [
        { k: 'Flapping St', v: p.St.toFixed(2) },
        { k: 'Mean drag <i>C</i><sub>D</sub>', v: s(st.cd, 3), ref: settling || !Number.isFinite(st.cd) ? '' : st.cd < 0 ? '<b>negative: net thrust</b>' : 'positive: net drag' },
        { k: 'Lift swing ±<i>C</i><sub>L</sub>', v: s(st.clAmp, 2) },
        { k: 'Reynolds (chord)', v: p.Re.toFixed(0) },
      ];
    case 'fish':
      return [
        { k: 'Tail-beat St', v: p.St.toFixed(2) },
        { k: 'Net force <i>C</i><sub>x</sub>', v: s(st.cd, 3), ref: settling || !Number.isFinite(st.cd) ? '' : st.cd < 0 ? '<b>negative: swimming thrust</b>' : 'positive: dragged back' },
        { k: 'Side force swing', v: s(st.clAmp, 2) },
        { k: 'Reynolds (length)', v: p.Re.toFixed(0) },
      ];
    case 'draw':
      return [
        { k: 'Speed (× reference)', v: fmt(st.speed, 2) },
        { k: 'Reynolds now', v: Number.isFinite(st.ReNow) ? st.ReNow.toFixed(0) : '—' },
        { k: 'Force <i>C</i><sub>x</sub>', v: fmt(st.cdNow, 2), ref: 'along x, per ½ρU²h' },
        { k: 'Force <i>C</i><sub>y</sub>', v: fmt(st.clNow, 2) },
      ];
  }
  return [];
}

function refLine(v, ref, tol) {
  if (!Number.isFinite(v)) return `published ${ref}`;
  const err = Math.abs(v - ref) / ref;
  return `<span class="${err <= tol ? 'good' : ''}">published ${ref} · ${err <= tol ? 'within' : 'off by'} ${(err * 100).toFixed(0)}%</span>`;
}

function start() {
  const c = CONTENT[id];
  document.title = `${c.title} · Fluid Gallery`;
  let q = QUALITY[prefs.quality];
  let params = clampParams(scene, defaults(scene), q);
  const kind = KINDS[c.kind];

  main.innerHTML = `
    <div class="sim-head">
      <div class="titles">
        <div class="crumbs"><a href="index.html">${icon('back')} Gallery</a></div>
        <h1>${esc(c.title)}</h1>
        <p class="tagline">${esc(c.tagline)}</p>
      </div>
      <div class="meta" style="display:flex;gap:8px">
        <span class="tag ${kind.hue}">${kind.label}</span>
        <span class="tag outline ${c.check}">${icon(c.check === 'checked' ? 'check' : 'eye')}${CHECKS[c.check].label}</span>
      </div>
    </div>
    <div class="stage" id="stage" style="aspect-ratio:${scene.aspect}">
      <canvas id="field" aria-label="Live vorticity field of the simulation" role="img"></canvas>
      <canvas class="overlay" id="overlay"></canvas>
      <div class="badge legend"><span class="sw" style="background:var(--accent)"></span>clockwise <span class="sw" style="background:var(--warm);margin-left:6px"></span>counter-clockwise<span id="arrow-key" style="margin-left:8px">→ force right now</span></div>
      <div class="badge flowhint" id="flowhint">${id === 'draw' ? `${icon('hand')} Drag the shape` : `${icon('wave')} Flow from left to right`}</div>
    </div>
    <div class="controls">
      <div class="transport">
        <button class="icon-btn" id="run" aria-label="Pause (Space)" title="Pause (Space)">${icon('pause')}</button>
        <button class="icon-btn" id="reset" aria-label="Restart (R)" title="Restart (R)">${icon('reset')}</button>
        <div class="seg" role="group" aria-label="Speed" id="speed">
          <button data-v="slow" aria-pressed="false">Slow</button><button data-v="normal" aria-pressed="true">Normal</button><button data-v="max" aria-pressed="false" title="As fast as your GPU allows">Max</button>
        </div>
        ${id === 'draw' ? `<div class="seg" role="group" aria-label="Tool" id="tool">
          <button data-v="move" aria-pressed="true" title="Move the shape (M)">${icon('hand')} Move</button><button data-v="draw" aria-pressed="false" title="Draw a new shape (D)">${icon('pencil')} Draw</button></div>` : ''}
      </div>
      <div class="sliders" id="sliders"></div>
    </div>
    <div class="status" id="status"><span class="dot"></span><span id="status-text">Starting…</span></div>
    <div class="readout">
      <div class="stats" id="stats"></div>
      <div class="chart">
        <div class="k"><span><b class="swatch" style="background:var(--accent)"></b>${id === 'fish' ? 'side force <i>C</i><sub>y</sub>' : 'lift <i>C</i><sub>L</sub>'}</span><span><b class="swatch" style="background:var(--muted)"></b>${id === 'fish' ? 'net force <i>C</i><sub>x</sub>' : 'drag <i>C</i><sub>D</sub>'}</span><span class="muted" style="margin-left:auto">recent history</span></div>
        <canvas id="chart" aria-label="Force coefficients over time"></canvas>
      </div>
    </div>
    <section class="learn">
      <div style="display:grid;gap:10px"><h2>What you’re seeing</h2><p>${rich(c.seeing)}</p></div>
      <div style="display:grid;gap:10px"><h3>Try this</h3><ul>${c.tryThis.map((t) => `<li>${icon('spark')}<span>${rich(t)}</span></li>`).join('')}</ul></div>
    </section>
    <details class="fold" id="fold-eq"><summary>The equations <span class="hint">${c.equations.length} equations, every symbol defined</span><span class="chev">${icon('next')}</span></summary>
      <div class="inner">${c.equations.map(eqBlock).join('')}</div></details>
    <details class="fold"><summary>How it was checked <span class="hint">${c.check === 'checked' ? 'measured against published data' : 'what we test and what we don’t'}</span><span class="chev">${icon('next')}</span></summary>
      <div class="inner">${checksHtml()}</div></details>
    <details class="fold"><summary>Limits <span class="hint">what this can’t tell you</span><span class="chev">${icon('next')}</span></summary>
      <div class="inner"><ul class="limits">${c.limits.map((l) => `<li>${rich(l)}</li>`).join('')}</ul></div></details>
    <details class="fold"><summary>How it’s computed <span class="hint">the lattice Boltzmann method in 3 equations</span><span class="chev">${icon('next')}</span></summary>
      <div class="inner"><p>${esc(METHOD.intro)}</p><p class="muted">${esc(METHOD.analogy)}</p>${METHOD.equations.map(eqBlock).join('')}<p>${esc(METHOD.walls)}</p><p class="muted">${esc(METHOD.units)}</p></div></details>
    <details class="fold"><summary>References <span class="chev">${icon('next')}</span></summary>
      <div class="inner"><ol class="refs">${[...c.refs, ...METHOD.refs].map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ol></div></details>`;

  // ---- sliders ----
  const slidersEl = document.getElementById('sliders');
  function renderSliders() {
    slidersEl.innerHTML = scene.params.map((p) => {
      if (p.toggle) return `<label class="switch"><input type="checkbox" data-k="${p.key}" ${params[p.key] ? 'checked' : ''}>${esc(p.label)}</label>`;
      const max = paramMax(scene, p, q);
      const limited = max < p.max;
      return `<div class="slider">
        <div class="row"><label for="s-${p.key}">${esc(p.label)}</label><span class="val" id="v-${p.key}">${fmtParam(p, params[p.key])}</span></div>
        <input type="range" id="s-${p.key}" data-k="${p.key}" min="${p.min}" max="${max}" step="${p.step}" value="${params[p.key]}">
        <div class="note">${limited ? `Up to ${max} at ${prefs.quality} quality. Sharp quality reaches ${paramMax(scene, p, QUALITY.sharp)}.` : ''}</div>
      </div>`;
    }).join('');
    slidersEl.querySelectorAll('input[type=range]').forEach(paintRange);
  }
  const fmtParam = (p, v) => (p.step < 1 ? (+v).toFixed(p.step < 0.1 ? 2 : 1) : String(v));
  const paintRange = (el) => el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min || 1)) * 100}%`);
  renderSliders();
  slidersEl.addEventListener('input', (e) => {
    const el = e.target, k = el.dataset.k;
    if (!k) return;
    const p = scene.params.find((x) => x.key === k);
    const v = el.type === 'checkbox' ? (el.checked ? 1 : 0) : +el.value;
    params[k] = v;
    if (el.type === 'range') { document.getElementById(`v-${k}`).textContent = fmtParam(p, v); paintRange(el); }
    worker.postMessage({ type: 'set', key: k, value: v });
    lastStats.settleFrom = lastStats.time || 0;
  });

  // ---- worker + canvas ----
  const stage = document.getElementById('stage');
  const field = document.getElementById('field');
  const overlay = document.getElementById('overlay');
  const octx = overlay.getContext('2d');
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  const size = () => [Math.max(2, Math.round(stage.clientWidth * dpr())), Math.max(2, Math.round(stage.clientHeight * dpr()))];
  let worker;
  let lastStats = { time: 0, settleFrom: 0 };
  let live = null;
  try {
    const off = field.transferControlToOffscreen();
    worker = new Worker('src/worker.js', { type: 'module' });
    const [w, h] = size();
    worker.postMessage({ type: 'init', canvas: off, scene: id, params, quality: prefs.quality, theme: resolvedTheme(prefs), contrast: prefs.contrast, w, h }, [off]);
  } catch (err) {
    document.getElementById('status-text').textContent = 'This browser can’t run the simulation (it needs OffscreenCanvas and module workers: Safari 17+, Chrome or Firefox).';
    return;
  }
  worker.onerror = (e) => { document.getElementById('status-text').textContent = 'The simulation stopped with an error: ' + (e.message || 'unknown'); };

  let backend = '';
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'live') { live = m; }
    else if (m.type === 'stats') { onStats(m); }
    else if (m.type === 'notice') toast(m.text, 4500);
    else if (m.type === 'built') { backend = m.backend; lastStats.settleFrom = 0; }
    else if (m.type === 'grab') stage.classList.toggle('grabbing', m.value);
  };

  const ro = new ResizeObserver(() => {
    const [w, h] = size();
    overlay.width = w; overlay.height = h;
    worker.postMessage({ type: 'resize', w, h });
    drawChart();
  });
  ro.observe(stage);

  // ---- transport ----
  let running = true;
  const runBtn = document.getElementById('run');
  const setRun = (v) => {
    running = v;
    worker.postMessage({ type: 'run', value: v });
    runBtn.innerHTML = icon(v ? 'pause' : 'play');
    runBtn.title = runBtn.ariaLabel = v ? 'Pause (Space)' : 'Play (Space)';
  };
  runBtn.onclick = () => setRun(!running);
  const reset = () => { worker.postMessage({ type: 'reset' }); lastStats = { time: 0, settleFrom: 0 }; chartData = { cd: [], cl: [] }; };
  document.getElementById('reset').onclick = reset;
  document.getElementById('speed').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#speed button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    worker.postMessage({ type: 'speed', value: b.dataset.v });
  };
  document.addEventListener('visibilitychange', () => worker.postMessage({ type: 'run', value: running && !document.hidden }));

  // ---- draw-and-drag tools ----
  let tool = 'move', stroke = null;
  const setTool = (t) => {
    tool = t;
    stage.classList.toggle('drawing', t === 'draw');
    stage.classList.toggle('can-grab', t === 'move' && id === 'draw');
    document.querySelectorAll('#tool button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === t)));
    document.getElementById('flowhint').innerHTML = t === 'draw' ? `${icon('pencil')} Draw a closed loop` : `${icon('hand')} Drag the shape`;
  };
  if (id === 'draw') {
    setTool('move');
    document.getElementById('tool').onclick = (e) => { const b = e.target.closest('button'); if (b) setTool(b.dataset.v); };
  }
  const norm = (e) => { const r = overlay.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; };
  overlay.addEventListener('pointerdown', (e) => {
    if (id !== 'draw') return;
    overlay.setPointerCapture(e.pointerId);
    if (tool === 'draw') { stroke = [norm(e)]; }
    else worker.postMessage({ type: 'pointer', kind: 'down', ...xy(norm(e)) });
  });
  overlay.addEventListener('pointermove', (e) => {
    if (id !== 'draw') return;
    if (tool === 'draw' && stroke) stroke.push(norm(e));
    else if (tool === 'move') worker.postMessage({ type: 'pointer', kind: 'move', ...xy(norm(e)) });
  });
  const up = () => {
    if (id !== 'draw') return;
    if (tool === 'draw' && stroke) {
      worker.postMessage({ type: 'shape', points: stroke });
      stroke = null;
      setTool('move');
    } else worker.postMessage({ type: 'pointer', kind: 'up', x: 0, y: 0 });
  };
  overlay.addEventListener('pointerup', up);
  overlay.addEventListener('pointercancel', up);
  const xy = ([x, y]) => ({ x, y });

  // ---- overlay: force arrow and the stroke being drawn ----
  function drawOverlay() {
    const W = overlay.width, H = overlay.height;
    octx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    if (prefs.arrow && live && Number.isFinite(live.cd) && live.time > 200) {
      const [cx, cy] = live.center;
      const nx = live.nx, ny = live.ny;
      if (nx) {
        const x0 = (cx / nx) * W, y0 = (1 - cy / ny) * H;
        const mag = Math.hypot(live.cd, live.cl);
        const len = (live.D / nx) * W * 1.4 * Math.tanh(mag / ARROW_REF[id]);
        if (len > 3 * dpr()) {
          const ux = live.cd / mag, uy = -live.cl / mag;
          const x1 = x0 + ux * len, y1 = y0 + uy * len;
          octx.strokeStyle = octx.fillStyle = css.getPropertyValue('--ink');
          octx.globalAlpha = 0.75;
          octx.lineWidth = 2.2 * dpr(); octx.lineCap = 'round';
          octx.beginPath(); octx.moveTo(x0, y0); octx.lineTo(x1, y1); octx.stroke();
          const hl = 8 * dpr();
          octx.beginPath();
          octx.moveTo(x1 + ux * 2, y1 + uy * 2);
          octx.lineTo(x1 - ux * hl - uy * hl * 0.55, y1 - uy * hl + ux * hl * 0.55);
          octx.lineTo(x1 - ux * hl + uy * hl * 0.55, y1 - uy * hl - ux * hl * 0.55);
          octx.closePath(); octx.fill();
          octx.globalAlpha = 1;
        }
      }
    }
    if (stroke && stroke.length > 1) {
      octx.strokeStyle = css.getPropertyValue('--accent');
      octx.lineWidth = 2.5 * dpr(); octx.lineJoin = octx.lineCap = 'round';
      octx.beginPath();
      stroke.forEach(([x, y], i) => (i ? octx.lineTo(x * W, (1 - y) * H) : octx.moveTo(x * W, (1 - y) * H)));
      octx.stroke();
    }
    requestAnimationFrame(drawOverlay);
  }
  requestAnimationFrame(drawOverlay);

  // ---- stats + chart ----
  const statsEl = document.getElementById('stats');
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  let chartData = { cd: [], cl: [] };
  function onStats(m) {
    const sinceChange = m.time - (lastStats.settleFrom || 0);
    m.settling = sinceChange < (m.window || 4000) * 0.75;
    lastStats = { ...m, settleFrom: lastStats.settleFrom };
    chartData = { cd: m.chartCd, cl: m.chartCl };
    statsEl.innerHTML = tiles(m, params).map((t) => `<div class="stat"><div class="k"><span>${t.k}</span></div><div class="v">${t.v}</div>${t.ref ? `<div class="ref">${t.ref}</div>` : ''}</div>`).join('');
    const u = UNIT[id];
    const travelled = u && m.U ? ` · ${Math.round((m.time * m.U) / m.D)} ${u} of flow so far` : '';
    statusEl.classList.toggle('live', running);
    statusText.textContent = `${running ? 'Running' : 'Paused'} on ${m.backend === 'gpu' ? 'GPU' : 'CPU'} · ${Math.round(m.sps).toLocaleString()} steps/s${travelled}${m.settling ? ' · averages settling…' : ''}`;
    drawChart();
  }
  const chart = document.getElementById('chart');
  function drawChart() {
    const ctx = chart.getContext('2d');
    const W = (chart.width = Math.round(chart.clientWidth * dpr())), H = (chart.height = Math.round(chart.clientHeight * dpr()));
    ctx.clearRect(0, 0, W, H);
    const all = [...chartData.cd, ...chartData.cl].filter(Number.isFinite);
    if (all.length < 2) return;
    let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.12 || 0.1; lo -= pad; hi += pad;
    const css = getComputedStyle(document.documentElement);
    const Y = (v) => H - ((v - lo) / (hi - lo)) * H;
    ctx.strokeStyle = css.getPropertyValue('--line'); ctx.lineWidth = dpr();
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
    ctx.fillStyle = css.getPropertyValue('--faint'); ctx.font = `${11 * dpr()}px Inter, sans-serif`;
    ctx.fillText(hi.toFixed(2), 4, 12 * dpr()); ctx.fillText(lo.toFixed(2), 4, H - 4); ctx.fillText('0', W - 12 * dpr(), Y(0) - 3);
    const line = (arr, color) => {
      const n = arr.length; if (n < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = 1.8 * dpr(); ctx.lineJoin = 'round';
      ctx.beginPath();
      arr.forEach((v, i) => { const x = ((300 - n + i) / 299) * W; i ? ctx.lineTo(x, Y(v)) : ctx.moveTo(x, Y(v)); });
      ctx.stroke();
    };
    line(chartData.cd, css.getPropertyValue('--muted'));
    line(chartData.cl, css.getPropertyValue('--accent'));
  }

  // ---- settings ----
  const arrowKey = () => { document.getElementById('arrow-key').style.display = prefs.arrow ? '' : 'none'; };
  arrowKey();
  const openSettings = () => settings(prefs, (k) => {
    applyPrefs(prefs);
    arrowKey();
    if (k === 'theme' || k === 'contrast' || k === '*') worker.postMessage({ type: 'theme', theme: resolvedTheme(prefs), contrast: prefs.contrast });
    if (k === 'quality' || k === '*') {
      q = QUALITY[prefs.quality];
      params = clampParams(scene, params, q);
      renderSliders();
      worker.postMessage({ type: 'quality', value: prefs.quality, params });
      lastStats = { time: 0, settleFrom: 0 };
    }
  });
  document.getElementById('open-settings').onclick = openSettings;
  settingsShortcut(openSettings);
  onSystemChange(() => { applyPrefs(prefs); worker.postMessage({ type: 'theme', theme: resolvedTheme(prefs), contrast: prefs.contrast }); });

  // ---- keyboard ----
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const typing = t.matches?.('input, textarea, select, [contenteditable]');
    if (document.querySelector('dialog[open]')) return;
    if (e.key === ' ' && !t.matches?.('button, a, summary, input')) { e.preventDefault(); setRun(!running); }
    else if ((e.key === 'r' || e.key === 'R') && !typing) reset();
    else if (e.key === 'ArrowLeft' && !typing) location.href = `sim.html?id=${prev.id}`;
    else if (e.key === 'ArrowRight' && !typing) location.href = `sim.html?id=${next.id}`;
    else if (id === 'draw' && (e.key === 'd' || e.key === 'D') && !typing) setTool('draw');
    else if (id === 'draw' && (e.key === 'm' || e.key === 'M' || e.key === 'Escape') && !typing) { stroke = null; setTool('move'); }
  });
}

function eqBlock(e) {
  return `<div class="eq">
    <div class="tex">${tex(e.tex)}</div>
    <p class="plain">${rich(e.plain)}</p>
    <table>${e.symbols.map(([sym, what, unit]) => `<tr><td>${tex(sym, false)}</td><td>${rich(what)}</td><td class="u">${esc(unit || '')}</td></tr>`).join('')}</table>
  </div>`;
}

function checksHtml() {
  const v = VALIDATION[id];
  const intro = {
    cylinder: 'The reference solver (the same equations, on the CPU) ran the cylinder at Re = 100 until the shedding was steady, then measured the shedding frequency and mean drag over the last cycles. It also checked that the wake stays steady at Re = 40, below the onset near 47.',
    spinning: 'The reference solver ran the spinning cylinder at Re = 100 for several spin ratios and checked three things from the literature: mean lift rises with spin, it stays below the ideal-flow value 2πα, and shedding stops once α passes about 1.9.',
    foil: 'Qualitative check: at a low flapping rate the mean force must be drag, and at a high one thrust, the transition reported in flapping-foil experiments. We don’t claim exact thrust values.',
    fish: 'Qualitative check: with weak tail beats the body is dragged back, and with strong ones (St ≈ 0.4) the mean force flips to thrust. The kinematics are copied from published fish data; the forces are not compared number for number.',
    draw: 'Not checked against data. The moving-wall method underneath it is the same one the fish and wing use, and the GPU-vs-CPU test confirms the moving-body code matches the reference solver.',
  }[id];
  const rows = (v?.rows || []).map((r) => `<div class="row"><span>${esc(r.what)}</span><span class="num">${esc(r.measured)}</span><span class="num muted">${esc(r.reference)}</span></div>`).join('');
  const gpu = VALIDATION.gpu ? `<p class="small muted">GPU vs reference solver (${esc(VALIDATION.gpu.when)}): flow fields agree to ${esc(VALIDATION.gpu.field)} of the stream speed; mean forces to ${esc(VALIDATION.gpu.force)}.</p>` : '';
  return `<p>${esc(intro)}</p>${rows ? `<div class="checks"><div class="row" style="background:transparent;border:0;padding-bottom:0"><span class="small muted">Quantity</span><span class="small muted">This sim</span><span class="small muted">Reference</span></div>${rows}</div>` : ''}
    ${v?.note ? `<p class="small muted">${esc(v.note)}</p>` : ''}${gpu}
    <p class="small muted">Full numbers, settings and run commands: <a href="https://github.com/amalmehta/FluidGallery/blob/main/docs/VALIDATION.md" target="_blank" rel="noopener">docs/VALIDATION.md</a>.</p>`;
}
