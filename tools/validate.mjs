// npm run validate  ->  runs every case in tools/validate-case.mjs (in parallel) on the CPU
// reference solver, then writes docs/VALIDATION.md and src/validation.js (numbers shown in the app).
// Takes 10-20 minutes. Set JOBS=n to change parallelism.
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { CASES } from './validate-case.mjs';

const JOBS = +(process.env.JOBS || Math.max(2, Math.min(6, cpus().length - 2)));
const names = Object.keys(CASES);
const results = {};

function run(name) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['tools/validate-case.mjs', name], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', (code) => {
      if (code) return reject(new Error(`${name} exited ${code}`));
      results[name] = JSON.parse(out.trim().split('\n').pop());
      console.log(`done ${name} in ${results[name].seconds.toFixed(0)} s`);
      resolve();
    });
  });
}

// REUSE=1 rebuilds the reports from docs/validation-raw.json without rerunning the solver.
if (process.env.REUSE) Object.assign(results, JSON.parse(readFileSync('docs/validation-raw.json', 'utf8')));
else {
  const queue = [...names];
  await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) await run(queue.shift()); }));
  writeFileSync('docs/validation-raw.json', JSON.stringify(results, null, 1));
}

// ---- Pass/fail criteria (defined in the spec, DEFINITIONS AND DEFERRED) ----
const R = results;
const rel = (v, ref) => Math.abs(v - ref) / ref;
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const f = (v, d = 3) => (v == null ? '—' : v.toFixed(d));
const c1 = R['cylinder-re100-q1'], c2 = R['cylinder-re100-q125'], c40 = R['cylinder-re40-q1'];
const spins = ['spinning-a05', 'spinning-a10', 'spinning-a15', 'spinning-a20'].map((n) => R[n]);
const checks = [
  { what: 'Cylinder Re=100 Strouhal number, Balanced', pass: rel(c1.st, 0.165) <= 0.08, detail: `${f(c1.st)} vs 0.165 (${pct(rel(c1.st, 0.165))})` },
  { what: 'Cylinder Re=100 mean drag, Balanced', pass: rel(c1.cd, 1.33) <= 0.12, detail: `${f(c1.cd)} vs 1.33 (${pct(rel(c1.cd, 1.33))})` },
  { what: 'Cylinder Re=100: finer grid moves toward reference', pass: rel(c2.st, 0.165) <= rel(c1.st, 0.165) + 0.005 && rel(c2.cd, 1.33) <= rel(c1.cd, 1.33) + 0.005, detail: `St ${f(c2.st)}, C_D ${f(c2.cd)} at 30 cells across` },
  { what: 'Cylinder Re=40 stays steady (no shedding)', pass: c40.clAmp < 0.01, detail: `lift swing ${f(c40.clAmp, 4)}` },
  { what: 'Spinning: mean lift rises with spin', pass: spins.every((s, i) => i === 0 || s.cl > spins[i - 1].cl), detail: spins.map((s) => `α=${s.params.alpha}: ${f(s.cl, 2)}`).join(', ') },
  { what: 'Spinning: lift below ideal-flow 2πα', pass: spins.every((s) => s.cl < 2 * Math.PI * s.params.alpha), detail: spins.map((s) => `${f(s.cl / (2 * Math.PI * s.params.alpha), 2)}× ideal`).join(', ') },
  { what: 'Spinning: shedding stops at α = 2', pass: R['spinning-a20'].clAmp < 0.1 * R['spinning-a10'].clAmp, detail: `lift swing ${f(R['spinning-a20'].clAmp, 4)} at α=2 vs ${f(R['spinning-a10'].clAmp, 3)} at α=1` },
  { what: 'Flapping wing: drag at St=0.1, thrust at St=0.4', pass: R['foil-st010'].cd > 0 && R['foil-st040'].cd < 0, detail: `mean C_D ${f(R['foil-st010'].cd)} → ${f(R['foil-st040'].cd)}` },
  { what: 'Fish: drag at St=0.2, thrust by St=0.5', pass: R['fish-st020'].cd > 0 && R['fish-st050'].cd < 0, detail: ['fish-st020', 'fish-st035', 'fish-st050'].map((n) => `St ${R[n].params.St}: ${f(R[n].cd)}`).join(', ') },
  { what: 'No run went unstable', pass: Object.values(R).every((r) => !r.nan), detail: `${Object.keys(R).length} runs` },
];
const gpuData = existsSync('docs/gpu-check.json') ? JSON.parse(readFileSync('docs/gpu-check.json', 'utf8')) : null;
if (gpuData) {
  checks.push({ what: 'GPU matches CPU: flow fields (rms < 1e-3 U)', pass: parseFloat(gpuData.field) < 1e-3, detail: `worst ${gpuData.field}` });
  checks.push({ what: 'GPU matches CPU: mean force (< 1%)', pass: parseFloat(gpuData.force) < 1, detail: `worst ${gpuData.force} (${gpuData.rows.filter((r) => parseFloat(r.force) >= 1).map((r) => r.id).join(', ') || 'none over'})` });
}

const gpu = existsSync('docs/gpu-check.json') ? JSON.parse(readFileSync('docs/gpu-check.json', 'utf8')) : null;
const when = new Date().toISOString().slice(0, 10);
const allPass = checks.every((c) => c.pass);

// ---- docs/VALIDATION.md ----
const md = `# Validation

Last run: ${when} with \`npm run validate\` (CPU reference solver, Node ${process.version}). ${allPass ? '**All checks pass.**' : '**Some checks fail. See below.**'}

Pass/fail thresholds are fixed in the project spec (DEFINITIONS AND DEFERRED) before running. They are not tuned to the results.

| Check | Result | Measured |
|---|---|---|
${checks.map((c) => `| ${c.what} | ${c.pass ? 'pass' : '**FAIL**'} | ${c.detail} |`).join('\n')}

## Cylinder at Re = 100

Reference: C_D = 1.33, St = 0.165 (Park, Kwon & Choi 1998; St 0.164–0.165 in Williamson 1996). These are unconfined flows. Ours has free-slip walls at ±5 D (10% blockage), which is known to raise both numbers by a few percent.

| Cells across D | Grid | τ | St | Error | Mean C_D | Error | Lift swing ±C_L |
|---|---|---|---|---|---|---|---|
${[c1, c2].map((r) => `| ${r.D} | ${r.grid.join(' × ')} | ${r.tau.toFixed(3)} | ${f(r.st)} | ${pct(rel(r.st, 0.165))} | ${f(r.cd)} | ${pct(rel(r.cd, 1.33))} | ${f(r.clAmp)} |`).join('\n')}

At Re = 40 (below the onset of shedding, Re ≈ 47) the wake stays steady: lift swing ${f(c40.clAmp, 4)}, mean C_D ${f(c40.cd)}.

## Spinning cylinder at Re = 100

Literature (Kang, Choi & Lee 1999; Stojković, Breuer & Durst 2002): mean lift grows with α, drag falls, and shedding stops near α ≈ 1.8–1.9. We check those trends, not exact values.

| α | Mean C_L | Ideal 2πα | Mean C_D | Lift swing | St |
|---|---|---|---|---|---|
${spins.map((r) => `| ${r.params.alpha} | ${f(r.cl, 3)} | ${(2 * Math.PI * r.params.alpha).toFixed(2)} | ${f(r.cd, 3)} | ${f(r.clAmp, 4)} | ${f(r.st)} |`).join('\n')}

## Flapping wing (Re = 250, pure heave h₀ = 0.2 c)

| Flapping St | Mean C_D | Meaning |
|---|---|---|
${['foil-st010', 'foil-st040'].map((n) => `| ${R[n].params.St} | ${f(R[n].cd)} | ${R[n].cd < 0 ? 'thrust' : 'drag'} |`).join('\n')}

## Swimming fish (Re = 400, tethered)

| Tail-beat St | Mean C_x | Meaning |
|---|---|---|
${['fish-st020', 'fish-st035', 'fish-st050'].map((n) => `| ${R[n].params.St} | ${f(R[n].cd)} | ${R[n].cd < 0 ? 'thrust' : 'drag'} |`).join('\n')}

## GPU solver vs CPU reference

${gpu ? `Checked in the browser with \`tests/gpu-check.html\` (${gpu.when}, ${gpu.renderer}): after 1,500–2,000 steps the flow fields differ by at most ${gpu.field} of the stream speed (rms), and mean forces by at most ${gpu.force}.

| Scene | rms Δu / U | max Δu / U | mean F_x difference |
|---|---|---|---|
${gpu.rows.map((r) => `| ${r.id} | ${r.rms} | ${r.max} | ${r.force} |`).join('\n')}` : 'Run `tests/gpu-check.html` in a browser and save its numbers to `docs/gpu-check.json`.'}

## Stability

\`tests/stability.html\` runs every scene on the GPU for 5,000–6,000 steps at the highest Reynolds number each quality allows, plus the other slider extremes. The floors for τ come from those runs. See docs/SYSTEM-DESIGN.md.

## Raw results

\`\`\`json
${JSON.stringify(R, null, 1)}
\`\`\`
`;
writeFileSync('docs/VALIDATION.md', md);

// ---- src/validation.js (what the app shows) ----
const app = {
  when,
  cylinder100: { st: c1.st, cd: c1.cd, stErr: rel(c1.st, 0.165), cdErr: rel(c1.cd, 1.33) },
  cylinder: { rows: [
    { what: 'Strouhal number, Re = 100', measured: f(c1.st), reference: '0.165' },
    { what: 'Mean drag C_D, Re = 100', measured: f(c1.cd, 2), reference: '1.33' },
    { what: 'Same, finer grid (30 cells across)', measured: `${f(c2.st)} / ${f(c2.cd, 2)}`, reference: '0.165 / 1.33' },
    { what: 'Lift swing at Re = 40 (should be ~0)', measured: f(c40.clAmp, 4), reference: 'steady' },
  ], note: 'Our domain has walls at ±5 diameters (10% blockage), which pushes both numbers up a few percent compared with the unconfined references.' },
  spinning: { rows: spins.map((r) => ({ what: `Mean lift C_L at α = ${r.params.alpha}`, measured: f(r.cl, 2), reference: `< ${(2 * Math.PI * r.params.alpha).toFixed(2)} (ideal)` }))
    .concat([{ what: 'Lift swing at α = 2 (shedding?)', measured: f(R['spinning-a20'].clAmp, 4), reference: 'stops near 1.9' }]) },
  foil: { rows: ['foil-st010', 'foil-st040'].map((n) => ({ what: `Mean C_D at St = ${R[n].params.St}`, measured: f(R[n].cd), reference: R[n].params.St < 0.2 ? 'drag (> 0)' : 'thrust (< 0)' })) },
  fish: { rows: ['fish-st020', 'fish-st035', 'fish-st050'].map((n) => ({ what: `Mean C_x at St = ${R[n].params.St}`, measured: f(R[n].cd), reference: R[n].cd < 0 ? 'thrust' : 'drag' })) },
  gpu: gpu ? { when: gpu.when, field: gpu.field, force: gpu.force } : null,
  allPass,
};
writeFileSync('src/validation.js', `// Written by tools/validate.mjs from its last run (${when}). Do not edit by hand.\nexport const VALIDATION = ${JSON.stringify(app, null, 2)};\n`);
console.log(checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'}  ${c.what}: ${c.detail}`).join('\n'));
process.exit(allPass ? 0 : 1);
