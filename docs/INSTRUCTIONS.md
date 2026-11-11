# Instructions

## Use it

Open the gallery (GitHub Pages, or locally as below), pick a simulation, and change one slider at a time.

| Key | Does |
|---|---|
| Space | Pause / play |
| R | Restart the flow |
| ← → | Previous / next simulation |
| D / M | Draw a new shape / move it (Draw and Drag) |
| ⌘, or Ctrl , | Settings |

- **Speed:** Slow / Normal / Max. Normal aims for about one shedding cycle every 1.5 s. Max runs as many steps as your GPU allows.
- **Settings:** theme, simulation quality (cells across each body), vortex colour strength, force arrow, motion. Higher quality allows higher Reynolds numbers; the slider tells you the limit.
- **Numbers** under the sim are averaged over the last few cycles. They read "…" while they settle after a change.

Needs a browser with WebGL2 and OffscreenCanvas in workers: Chrome, Edge, Firefox, or Safari 17+. Without float render targets it falls back to the CPU solver at lower resolution and says so.

## Run locally

No build step and no dependencies.

```bash
npm run serve
```

Then open http://localhost:8137. (`tools/serve.py` is a plain static server that turns off caching, so edits show on reload.)

## Test

Fast unit tests (about a minute): rest state, viscosity, mass conservation, rasteriser, Strouhal detector, wall velocities, slider limits, every scene stable.

```bash
npm test
```

Physics validation against published data (10–20 minutes, runs cases in parallel). It rewrites `docs/VALIDATION.md` and `src/validation.js`, which hold the numbers the app shows.

```bash
npm run validate
```

GPU checks run in the browser while the dev server is up:

- http://localhost:8137/tests/gpu-check.html: the GPU solver vs the CPU reference on every scene. Copy the JSON it prints into `docs/gpu-check.json`, then rerun `npm run validate` to include it.
- http://localhost:8137/tests/stability.html: every scene at its slider extremes, at every quality.

## Regenerate images

```bash
node tools/thumbs.mjs
```

```bash
node tools/make-icons.mjs
```

Gallery thumbnails come from real runs of the CPU solver (about 6 minutes). Icons are rendered from the shapes in `assets/icon.svg`.

## Deploy

GitHub Pages serves the repository root of `main`. Push to `main` and Pages updates in a minute or two.

## Manual review checklist

Things the tests can't judge. Tick them on a real device.

**Feel and readability**
- [ ] Gallery: can you tell at a glance what each sim is and which are checked?
- [ ] Sim page: is the one next step obvious (move a slider)? Do the "Try this" items work as described?
- [ ] Equations: readable size, every symbol defined, fine in dark mode and on a phone.
- [ ] Dark mode on every component: cards, sliders, settings sheet, chart, toast, feedback tab.

**Smoothness**
- [ ] Sliders answer instantly (the number changes as you drag); the flow follows within a fraction of a second.
- [ ] No stutter while the sim runs at Normal; Max stays responsive to clicks.
- [ ] The opening animation plays once per session, about a second, and doesn't block clicks; with Reduce Motion it's a plain fade.
- [ ] Resizing the window doesn't flicker or jump.

**Hardware**
- [ ] Speed on your GPU: the status line shows steps/s (this Mac's Intel UHD 630: ~1,000 at Balanced). On a laptop on battery, does Normal still look smooth?
- [ ] Safari 17+, Chrome, Firefox, and a phone.
- [ ] Hidden tab: the sim pauses and resumes.

**Privacy and security**
- [ ] Settings → "Delete my data" clears preferences; reload shows defaults.
- [ ] DevTools → Network: no requests to any host other than this site (and github.com only if you click Feedback).
- [ ] `sim.html?id=<script>` shows the "doesn't exist" page, not a script.

**Physics sanity**
- [ ] Cylinder: Re below 45 stops the shedding; Re 100 gives St close to 0.165.
- [ ] Spinning: α 0 → 2 raises lift and the wiggle dies.
- [ ] Wing: St 0 → 0.4 turns mean drag negative.
- [ ] Draw: a broadside plate leaves a bigger wake than an edge-on one.
