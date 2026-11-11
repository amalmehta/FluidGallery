# File structure

```
index.html              Gallery page
sim.html                One simulation page (sim.html?id=cylinder | spinning | foil | fish | draw)
src/
  lbm/                  Physics. No DOM; the same files run in the browser and in Node.
    solver.js           CPU reference: D2Q9 lattice Boltzmann, TRT collision, walls, sponges, forces
    gpu.js              The same method in WebGL2 shaders (what the site runs), plus the vorticity renderer
    raster.js           Turns a body polygon into solid cells; shared by both solvers
    bodies.js           Shapes and their motion: cylinder, flapping foil, fish, draggable shape
    scenes.js           The five scenes: grid, speeds, sliders, stability limits
    measure.js          Force coefficients and shedding frequency (Strouhal number)
    render.js           Colour palettes and the CPU vorticity renderer
  worker.js             Runs a scene off the main thread and draws to the canvas
  content.js            Words: what you see, things to try, equations, limits, references
  validation.js         Numbers from the last validation run (generated)
  ui/
    boot.js             Sets the theme and opening animation before first paint
    common.js           Preferences, settings sheet, feedback tab, toast, icons
    gallery.js          Gallery page
    sim.js              Simulation page: controls, numbers, chart, force arrow, drawing
    styles.css          All styles, light and dark
assets/
  icon.svg, icon-*.png  App icon (favicon, touch icon)
  thumbs/               Gallery images from real solver runs (light and dark)
vendor/
  katex/                KaTeX 0.16.11 for typesetting equations (MIT)
  fonts/                Inter and Newsreader (SIL OFL)
tests/
  solver.test.mjs       Unit tests (npm test)
  gpu-check.html        GPU vs CPU comparison, in the browser
  stability.html        Stability at slider extremes, in the browser
tools/
  validate.mjs          Physics validation runner (npm run validate)
  validate-case.mjs     One validation case
  thumbs.mjs            Renders gallery thumbnails
  make-icons.mjs        Renders icon PNGs
  png.mjs               Tiny PNG writer
  bench.mjs             Speed check for one scene on the CPU
  serve.py              Local static server without caching
docs/
  SYSTEM-DESIGN.md      Architecture, decisions, threat model, limits
  VALIDATION.md         Every check with its numbers (generated)
  INSTRUCTIONS.md       Run, use, test, deploy
  PROMPTS.md            Prompt log
```
