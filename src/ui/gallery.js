import { SCENES } from '../lbm/scenes.js';
import { CONTENT, KINDS, CHECKS, METHOD } from '../content.js';
import { VALIDATION } from '../validation.js';
import { header, icon, loadPrefs, applyPrefs, settings, settingsShortcut, feedbackTab, onSystemChange, esc } from './common.js';

const prefs = loadPrefs();
applyPrefs(prefs);
onSystemChange(() => applyPrefs(prefs));

document.getElementById('top').innerHTML = header();
const openSettings = () => settings(prefs, () => applyPrefs(prefs));
document.getElementById('open-settings').onclick = openSettings;
settingsShortcut(openSettings);
feedbackTab('Gallery');

const cyl = VALIDATION.cylinder100;
document.getElementById('facts').innerHTML = [
  `<span>${icon('gpu')} Solved live on your GPU</span>`,
  cyl ? `<span>${icon('check')} Cylinder wake within ${Math.round(Math.max(cyl.stErr, cyl.cdErr) * 100)}% of published values</span>` : '',
  `<span>${icon('wave')} 2D, Reynolds numbers 20–800</span>`,
].join('');

document.getElementById('grid').innerHTML = SCENES.map((s) => {
  const c = CONTENT[s.id];
  const kind = KINDS[c.kind], chk = CHECKS[c.check];
  return `<a class="card" href="sim.html?id=${s.id}">
    <div class="thumb">
      <img class="theme-light" src="assets/thumbs/${s.id}-light.png" alt="${esc(c.title)}: vorticity field from a real run" loading="lazy" width="900" height="360">
      <img class="theme-dark" src="assets/thumbs/${s.id}-dark.png" alt="" loading="lazy" width="900" height="360">
    </div>
    <div class="body">
      <div class="meta">
        <span class="tag ${kind.hue}">${kind.label}</span>
        <span class="tag outline ${c.check}">${icon(c.check === 'checked' ? 'check' : 'eye')}${chk.short}</span>
      </div>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.tagline)}</p>
    </div>
  </a>`;
}).join('');

document.getElementById('explainer').innerHTML = `
  <h2>How these work</h2>
  <div style="display:grid;gap:12px">
    <p>${METHOD.intro}</p>
    <p>${METHOD.analogy}</p>
  </div>
  <div style="display:grid;gap:12px">
    <p><b style="color:var(--ink)">Colour shows spin.</b> <span style="color:var(--accent)">Blue</span> water is turning clockwise, <span style="color:var(--warm)">terracotta</span> counter-clockwise, and the background colour isn’t turning. Vortices are the blobs of colour.</p>
    <p><b style="color:var(--ink)">What it can’t show.</b> These are 2D slices at low Reynolds numbers (20–800). Real drones, birds and fish are 3D and run at 10⁴–10⁶, where wakes turn turbulent. The mechanisms carry over; the exact numbers don’t. Each sim lists its own limits.</p>
    <p class="small">Two sims are <b>checked</b> against published measurements; three are <b>qualitative</b>: right in kind, not tested number for number.</p>
  </div>`;
