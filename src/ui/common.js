// Shared UI: preferences, theme, settings sheet, feedback tab, toast, icons, opening animation.

export const REPO = 'https://github.com/amalmehta/FluidGallery';

// ---- Icons (24px stroke icons, drawn for this app) ----
const PATHS = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  check: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  wave: '<path d="M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/><path d="M2 16c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  gpu: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h4v4H7zM15 10h2M15 14h2"/>',
  fast: '<path d="M13 19l9-7-9-7v14zM2 19l9-7-9-7v14z"/>',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ''}</svg>`;

// ---- Preferences: stored only in this browser ----
const KEY = 'fluid-gallery-prefs-v1';
export const PREF_OPTIONS = {
  theme: ['system', 'light', 'dark'],
  quality: ['fast', 'balanced', 'sharp'],
  contrast: ['low', 'medium', 'high'],
  arrow: [true, false],
  motion: ['system', 'reduce'],
};
const DEFAULTS = { theme: 'system', quality: 'balanced', contrast: 'medium', arrow: true, motion: 'system' };

export function loadPrefs() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { raw = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (PREF_OPTIONS[k].includes(raw[k])) out[k] = raw[k]; // only known values
  return out;
}
export function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: keep in memory */ } }
export function clearPrefs() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

const mqDark = matchMedia('(prefers-color-scheme: dark)');
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
export const resolvedTheme = (p) => (p.theme === 'system' ? (mqDark.matches ? 'dark' : 'light') : p.theme);
export const reduceMotion = (p) => p.motion === 'reduce' || mqReduce.matches;

export function applyPrefs(p) {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme(p);
  root.classList.toggle('reduce', reduceMotion(p));
}

export function onSystemChange(fn) {
  mqDark.addEventListener('change', fn);
  mqReduce.addEventListener('change', fn);
}

// ---- Toast ----
let toastEl, toastTimer;
export function toast(text, ms = 3200) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---- Feedback tab: opens a prefilled GitHub issue. Only the page name goes in the URL. ----
export function feedbackTab(page) {
  const a = document.createElement('a');
  a.className = 'feedback-tab';
  a.target = '_blank';
  a.rel = 'noopener';
  const title = encodeURIComponent(`Feedback: ${page}`);
  const body = encodeURIComponent(`Page: ${page}\n\nWhat happened / what would make this better:\n`);
  a.href = `${REPO}/issues/new?title=${title}&body=${body}`;
  a.innerHTML = `${icon('message')}<span>Feedback</span>`;
  a.title = 'Opens a GitHub issue form in a new tab (needs a GitHub account). Nothing is sent until you submit it there.';
  document.body.append(a);
}

// ---- Settings sheet (⌘, / Ctrl+,) ----
const LABELS = {
  theme: ['Theme', { system: 'System', light: 'Light', dark: 'Dark' }],
  quality: ['Simulation quality', { fast: 'Fast', balanced: 'Balanced', sharp: 'Sharp' }],
  contrast: ['Vortex colour strength', { low: 'Soft', medium: 'Medium', high: 'Strong' }],
  arrow: ['Force arrow on the body', { true: 'Show', false: 'Hide' }],
  motion: ['Motion', { system: 'Follow system', reduce: 'Reduce' }],
};
const HINTS = {
  quality: 'More cells across each body: sharper and allows higher Reynolds numbers, but runs fewer steps per second. Fast = 0.75×, Sharp = 1.25× the cells across.',
  contrast: 'How quickly colour saturates with spin. Soft shows only the strongest vortices.',
};

export function settings(prefs, onChange) {
  let dlg = document.querySelector('dialog.sheet');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.setAttribute('aria-label', 'Settings');
    document.body.append(dlg);
  }
  const render = () => {
    dlg.innerHTML = `
      <header><h2>Settings</h2><button class="icon-btn" data-close aria-label="Close">${icon('close')}</button></header>
      <div class="rows">
        ${Object.entries(LABELS).map(([k, [label, opts]]) => `
          <div class="field"><span>${label}</span>
            <div class="seg" role="group" aria-label="${label}">
              ${PREF_OPTIONS[k].map((v) => `<button data-k="${k}" data-v="${v}" aria-pressed="${prefs[k] === v}">${opts[String(v)]}</button>`).join('')}
            </div>
            ${HINTS[k] ? `<span class="small muted">${HINTS[k]}</span>` : ''}
          </div>`).join('')}
      </div>
      <div class="privacy">
        <div>${icon('lock')} <b>What’s stored:</b> only these five preferences, in this browser (localStorage). No account, no analytics, no cookies, and nothing is sent anywhere. Fonts and maths typesetting are served from this site, not a third party.</div>
        <div><button class="icon-btn" data-copy>Copy my data</button> <button class="icon-btn" data-clear>Delete my data</button></div>
      </div>
      <footer><span class="small muted" style="margin-right:auto">Shortcut: <span class="kbd">⌘,</span> or <span class="kbd">Ctrl ,</span></span><button class="icon-btn primary" data-close>Done</button></footer>`;
  };
  render();
  dlg.onclick = (e) => {
    const b = e.target.closest('button');
    if (e.target === dlg || (b && b.hasAttribute('data-close'))) return dlg.close();
    if (!b) return;
    if (b.dataset.k) {
      const k = b.dataset.k;
      const v = PREF_OPTIONS[k].find((o) => String(o) === b.dataset.v);
      prefs[k] = v;
      savePrefs(prefs);
      dlg.querySelectorAll(`button[data-k="${k}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(k, v);
    } else if (b.hasAttribute('data-copy')) {
      const text = JSON.stringify(prefs, null, 2);
      navigator.clipboard?.writeText(text).then(() => toast('Copied your preferences as JSON.'), () => toast(text, 6000));
    } else if (b.hasAttribute('data-clear')) {
      clearPrefs();
      Object.assign(prefs, loadPrefs());
      render();
      onChange('*', null);
      toast('Deleted. Settings are back to defaults.');
    }
  };
  dlg.showModal();
}

export function settingsShortcut(open) {
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); open(); }
  });
}

export function header(rightHtml = '') {
  return `<div class="wrap top">
    <a class="brand" href="./index.html"><img src="assets/icon.svg" alt="" width="28" height="28">Fluid Gallery</a>
    <div style="display:flex;gap:8px;align-items:center">${rightHtml}<button class="icon-btn" id="open-settings" aria-label="Settings (⌘,)" title="Settings (⌘,)">${icon('gear')}</button></div>
  </div>`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
