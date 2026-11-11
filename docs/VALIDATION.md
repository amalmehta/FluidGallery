# Validation

Last run: 2026-11-11 with `npm run validate` (CPU reference solver, Node v24.13.0). **Some checks fail. See below.**

Pass/fail thresholds are fixed in the project spec (DEFINITIONS AND DEFERRED) before running. They are not tuned to the results.

| Check | Result | Measured |
|---|---|---|
| Cylinder Re=100 Strouhal number, Balanced | pass | 0.178 vs 0.165 (8.0%) |
| Cylinder Re=100 mean drag, Balanced | pass | 1.478 vs 1.33 (11.2%) |
| Cylinder Re=100: finer grid moves toward reference | pass | St 0.177, C_D 1.473 at 30 cells across |
| Cylinder Re=40 stays steady (no shedding) | pass | lift swing 0.0016 |
| Spinning: mean lift rises with spin | pass | α=0.5: 1.32, α=1: 2.68, α=1.5: 4.13, α=2: 5.79 |
| Spinning: lift below ideal-flow 2πα | pass | 0.42× ideal, 0.43× ideal, 0.44× ideal, 0.46× ideal |
| Spinning: shedding stops at α = 2 | **FAIL** | lift swing 0.0432 at α=2 vs 0.373 at α=1 |
| Flapping wing: drag at St=0.1, thrust at St=0.4 | pass | mean C_D 0.213 → -0.637 |
| Fish: drag at St=0.2, thrust by St=0.5 | **FAIL** | St 0.2: 0.221, St 0.35: 0.121, St 0.5: 0.054 |
| No run went unstable | pass | 12 runs |
| GPU matches CPU: flow fields (rms < 1e-3 U) | pass | worst 5.9e-4 |
| GPU matches CPU: mean force (< 1%) | **FAIL** | worst 1.12% (foil) |

## Cylinder at Re = 100

Reference: C_D = 1.33, St = 0.165 (Park, Kwon & Choi 1998; St 0.164–0.165 in Williamson 1996). These are unconfined flows. Ours has free-slip walls at ±5 D (10% blockage), which is known to raise both numbers by a few percent.

| Cells across D | Grid | τ | St | Error | Mean C_D | Error | Lift swing ±C_L |
|---|---|---|---|---|---|---|---|
| 24 | 600 × 240 | 0.572 | 0.178 | 8.0% | 1.478 | 11.2% | 0.345 |
| 30 | 750 × 300 | 0.590 | 0.177 | 7.5% | 1.473 | 10.8% | 0.332 |

At Re = 40 (below the onset of shedding, Re ≈ 47) the wake stays steady: lift swing 0.0016, mean C_D 1.775.

## Spinning cylinder at Re = 100

Literature (Kang, Choi & Lee 1999; Stojković, Breuer & Durst 2002): mean lift grows with α, drag falls, and shedding stops near α ≈ 1.8–1.9. We check those trends, not exact values.

| α | Mean C_L | Ideal 2πα | Mean C_D | Lift swing | St |
|---|---|---|---|---|---|
| 0.5 | 1.321 | 3.14 | 1.484 | 0.3683 | 0.184 |
| 1 | 2.677 | 6.28 | 1.308 | 0.3733 | 0.185 |
| 1.5 | 4.135 | 9.42 | 1.019 | 0.3180 | 0.185 |
| 2 | 5.789 | 12.57 | 0.682 | 0.0432 | 0.171 |

## Flapping wing (Re = 250, pure heave h₀ = 0.2 c)

| Flapping St | Mean C_D | Meaning |
|---|---|---|
| 0.1 | 0.213 | drag |
| 0.4 | -0.637 | thrust |

## Swimming fish (Re = 400, tethered)

| Tail-beat St | Mean C_x | Meaning |
|---|---|---|
| 0.2 | 0.221 | drag |
| 0.35 | 0.121 | drag |
| 0.5 | 0.054 | drag |

## GPU solver vs CPU reference

Checked in the browser with `tests/gpu-check.html` (2026-11-11, Intel UHD Graphics 630 (ANGLE Metal), Chromium): after 1,500–2,000 steps the flow fields differ by at most 5.9e-4 of the stream speed (rms), and mean forces by at most 1.12%.

| Scene | rms Δu / U | max Δu / U | mean F_x difference |
|---|---|---|---|
| cylinder | 8.6e-6 | 1.3e-5 | 0.003% |
| spinning | 1.1e-5 | 2.0e-5 | 0.037% |
| foil | 2.9e-4 | 2.6e-2 | 1.119% (over the 1% limit) |
| fish | 2.4e-4 | 1.1e-2 | 0.259% |
| draw | 5.9e-4 | 2.4e-2 | 0.346% |

## Stability

`tests/stability.html` runs every scene on the GPU for 5,000–6,000 steps at the highest Reynolds number each quality allows, plus the other slider extremes. The floors for τ come from those runs. See docs/SYSTEM-DESIGN.md.

## Raw results

```json
{
 "cylinder-re40-q1": {
  "name": "cylinder-re40-q1",
  "scene": "cylinder",
  "params": {
   "Re": 40
  },
  "q": 1,
  "steps": 25000,
  "D": 24,
  "U": 0.1,
  "grid": [
   600,
   240
  ],
  "tau": 0.68,
  "cd": 1.7745606470705104,
  "cl": 0.020641606212377032,
  "clAmp": 0.0016290753783428054,
  "st": null,
  "flapSt": null,
  "nan": false,
  "seconds": 929.614
 },
 "cylinder-re100-q1": {
  "name": "cylinder-re100-q1",
  "scene": "cylinder",
  "params": {
   "Re": 100
  },
  "q": 1,
  "steps": 30000,
  "D": 24,
  "U": 0.1,
  "grid": [
   600,
   240
  ],
  "tau": 0.5720000000000001,
  "cd": 1.4783822937076816,
  "cl": 0.032336462738725945,
  "clAmp": 0.34549967518501457,
  "st": 0.1781389373809667,
  "flapSt": null,
  "nan": false,
  "seconds": 1077.906
 },
 "spinning-a05": {
  "name": "spinning-a05",
  "scene": "spinning",
  "params": {
   "alpha": 0.5,
   "Re": 100
  },
  "q": 1,
  "steps": 40000,
  "D": 32,
  "U": 0.05,
  "grid": [
   576,
   256
  ],
  "tau": 0.548,
  "cd": 1.4835014701279807,
  "cl": 1.3209224192539046,
  "clAmp": 0.3682651670445569,
  "st": 0.1841316198663092,
  "flapSt": null,
  "nan": false,
  "seconds": 1444.74
 },
 "spinning-a10": {
  "name": "spinning-a10",
  "scene": "spinning",
  "params": {
   "alpha": 1,
   "Re": 100
  },
  "q": 1,
  "steps": 40000,
  "D": 32,
  "U": 0.05,
  "grid": [
   576,
   256
  ],
  "tau": 0.548,
  "cd": 1.307996801710454,
  "cl": 2.6765921338456997,
  "clAmp": 0.37332043154401345,
  "st": 0.18523283348246278,
  "flapSt": null,
  "nan": false,
  "seconds": 1445.095
 },
 "spinning-a15": {
  "name": "spinning-a15",
  "scene": "spinning",
  "params": {
   "alpha": 1.5,
   "Re": 100
  },
  "q": 1,
  "steps": 40000,
  "D": 32,
  "U": 0.05,
  "grid": [
   576,
   256
  ],
  "tau": 0.548,
  "cd": 1.0192056855150438,
  "cl": 4.134775838202095,
  "clAmp": 0.31802527859206,
  "st": 0.1846654738371114,
  "flapSt": null,
  "nan": false,
  "seconds": 1452.207
 },
 "foil-st010": {
  "name": "foil-st010",
  "scene": "foil",
  "params": {
   "St": 0.1,
   "pitch": 0,
   "Re": 250
  },
  "q": 1,
  "steps": 22000,
  "D": 64,
  "U": 0.05,
  "grid": [
   576,
   256
  ],
  "tau": 0.5384,
  "cd": 0.21344365487060651,
  "cl": -0.1395009105548042,
  "clAmp": 0.9053504023008034,
  "st": null,
  "flapSt": 0.1,
  "nan": false,
  "seconds": 661.99
 },
 "fish-st020": {
  "name": "fish-st020",
  "scene": "fish",
  "params": {
   "St": 0.2,
   "Re": 400
  },
  "q": 1,
  "steps": 16000,
  "D": 100,
  "U": 0.06,
  "grid": [
   600,
   240
  ],
  "tau": 0.545,
  "cd": 0.2210238896186192,
  "cl": -0.0014912721961139143,
  "clAmp": 0.4272726966210374,
  "st": 1.0016231031628269,
  "flapSt": 0.2,
  "nan": false,
  "seconds": 462.301
 },
 "fish-st035": {
  "name": "fish-st035",
  "scene": "fish",
  "params": {
   "St": 0.35,
   "Re": 400
  },
  "q": 1,
  "steps": 16000,
  "D": 100,
  "U": 0.06,
  "grid": [
   600,
   240
  ],
  "tau": 0.545,
  "cd": 0.12098103847979506,
  "cl": 0.007693010017953291,
  "clAmp": 2.942895848216917,
  "st": 1.739433555757379,
  "flapSt": 0.35,
  "nan": false,
  "seconds": 485.382
 },
 "cylinder-re100-q125": {
  "name": "cylinder-re100-q125",
  "scene": "cylinder",
  "params": {
   "Re": 100
  },
  "q": 1.25,
  "steps": 37000,
  "D": 30,
  "U": 0.1,
  "grid": [
   750,
   300
  ],
  "tau": 0.59,
  "cd": 1.4731601870018773,
  "cl": 0.02018435219699743,
  "clAmp": 0.3320068814902676,
  "st": 0.17730369712969923,
  "flapSt": null,
  "nan": false,
  "seconds": 1999.501
 },
 "foil-st040": {
  "name": "foil-st040",
  "scene": "foil",
  "params": {
   "St": 0.4,
   "pitch": 0,
   "Re": 250
  },
  "q": 1,
  "steps": 22000,
  "D": 64,
  "U": 0.05,
  "grid": [
   576,
   256
  ],
  "tau": 0.5384,
  "cd": -0.6366471003279677,
  "cl": 0.723762020410473,
  "clAmp": 16.446365074641484,
  "st": 0.9974622245821567,
  "flapSt": 0.4,
  "nan": false,
  "seconds": 720.015
 },
 "spinning-a20": {
  "name": "spinning-a20",
  "scene": "spinning",
  "params": {
   "alpha": 2,
   "Re": 100
  },
  "q": 1,
  "steps": 40000,
  "D": 32,
  "U": 0.05,
  "grid": [
   576,
   256
  ],
  "tau": 0.548,
  "cd": 0.6819285837936893,
  "cl": 5.788514194395341,
  "clAmp": 0.04322989364889734,
  "st": 0.1711783672459701,
  "flapSt": null,
  "nan": false,
  "seconds": 1305.304
 },
 "fish-st050": {
  "name": "fish-st050",
  "scene": "fish",
  "params": {
   "St": 0.5,
   "Re": 400
  },
  "q": 1,
  "steps": 16000,
  "D": 100,
  "U": 0.06,
  "grid": [
   600,
   240
  ],
  "tau": 0.545,
  "cd": 0.05431184716086594,
  "cl": -0.0012636188642212614,
  "clAmp": 1.6816160663177462,
  "st": 2.5019472854341798,
  "flapSt": 0.5,
  "nan": false,
  "seconds": 542.789
 }
}
```
