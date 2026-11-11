// Written by tools/validate.mjs from its last run (2026-11-11). Do not edit by hand.
export const VALIDATION = {
  "when": "2026-11-11",
  "cylinder100": {
    "st": 0.1781389373809667,
    "cd": 1.4783822937076816,
    "stErr": 0.07962992352101025,
    "cdErr": 0.11156563436667784
  },
  "cylinder": {
    "rows": [
      {
        "what": "Strouhal number, Re = 100",
        "measured": "0.178",
        "reference": "0.165"
      },
      {
        "what": "Mean drag C_D, Re = 100",
        "measured": "1.48",
        "reference": "1.33"
      },
      {
        "what": "Same, finer grid (30 cells across)",
        "measured": "0.177 / 1.47",
        "reference": "0.165 / 1.33"
      },
      {
        "what": "Lift swing at Re = 40 (should be ~0)",
        "measured": "0.0016",
        "reference": "steady"
      }
    ],
    "note": "Our domain has walls at ±5 diameters (10% blockage), which pushes both numbers up a few percent compared with the unconfined references."
  },
  "spinning": {
    "rows": [
      {
        "what": "Mean lift C_L at α = 0.5",
        "measured": "1.32",
        "reference": "< 3.14 (ideal)"
      },
      {
        "what": "Mean lift C_L at α = 1",
        "measured": "2.68",
        "reference": "< 6.28 (ideal)"
      },
      {
        "what": "Mean lift C_L at α = 1.5",
        "measured": "4.13",
        "reference": "< 9.42 (ideal)"
      },
      {
        "what": "Mean lift C_L at α = 2",
        "measured": "5.79",
        "reference": "< 12.57 (ideal)"
      },
      {
        "what": "Lift swing at α = 2 (shedding?)",
        "measured": "0.0432",
        "reference": "stops near 1.9"
      }
    ]
  },
  "foil": {
    "rows": [
      {
        "what": "Mean C_D at St = 0.1",
        "measured": "0.213",
        "reference": "drag (> 0)"
      },
      {
        "what": "Mean C_D at St = 0.4",
        "measured": "-0.637",
        "reference": "thrust (< 0)"
      }
    ]
  },
  "fish": {
    "rows": [
      {
        "what": "Mean C_x at St = 0.2",
        "measured": "0.221",
        "reference": "drag"
      },
      {
        "what": "Mean C_x at St = 0.35",
        "measured": "0.121",
        "reference": "drag"
      },
      {
        "what": "Mean C_x at St = 0.5",
        "measured": "0.054",
        "reference": "drag"
      }
    ]
  },
  "gpu": {
    "when": "2026-11-11",
    "field": "5.9e-4",
    "force": "1.12%"
  },
  "allPass": false
};
