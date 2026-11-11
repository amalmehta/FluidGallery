// Words for each scene. Equations are TeX, typeset with KaTeX. Every symbol is defined under its
// equation. "checked" values are filled from docs/VALIDATION.md (measured by tools/validate.mjs).

export const KINDS = {
  // related kinds share a hue family; shades differ so each reads apart at a glance
  benchmark: { label: 'Benchmark', hue: 'blue deep' },
  machine: { label: 'Machine', hue: 'blue' },
  animal: { label: 'Animal', hue: 'warm deep' },
  playground: { label: 'Playground', hue: 'warm' },
};

export const CHECKS = {
  checked: { label: 'Checked against data', short: 'Checked' },
  qualitative: { label: 'Qualitative', short: 'Qualitative' },
};

// Shared method, shown on every sim under "How it's computed".
export const METHOD = {
  intro:
    'The fluid is a grid of cells. Each cell holds nine numbers: how much fluid is moving in each of nine directions (still, four sides, four diagonals). Every time step, those amounts hop to the neighbouring cell (streaming), then nudge toward the mix you would expect for that cell’s density and speed (collision). Do this millions of times and the result obeys the Navier–Stokes equations. This is the lattice Boltzmann method.',
  analogy:
    'Think of a crowd crossing a plaza: each person only looks at their neighbours and adjusts a little, yet the whole crowd flows like a fluid. The method never solves Navier–Stokes directly; it gets there by averaging.',
  equations: [
    {
      tex: 'f_i(\\mathbf{x}+\\mathbf{c}_i,\\,t+1) = f_i - \\omega^{+}\\!\\left(f_i^{+}-f_i^{\\mathrm{eq}+}\\right) - \\omega^{-}\\!\\left(f_i^{-}-f_i^{\\mathrm{eq}-}\\right)',
      plain: 'Each population moves one cell along its direction, after relaxing toward equilibrium. Its symmetric and antisymmetric halves relax at different rates (the two-relaxation-time, or TRT, scheme).',
      symbols: [
        ['f_i', 'amount of fluid moving in direction i (9 directions)', 'lattice density'],
        ['\\mathbf{c}_i', 'direction i: one cell in x, y, or both', 'cells per step'],
        ['f_i^{\\pm}', 'symmetric / antisymmetric halves, $\\tfrac12(f_i \\pm f_{\\bar\\imath})$, where $\\bar\\imath$ is the opposite direction', ''],
        ['\\omega^{\\pm}', 'relaxation rates; $\\omega^{+}=1/\\tau$ sets the viscosity', 'per step'],
      ],
    },
    {
      tex: 'f_i^{\\mathrm{eq}} = w_i\\,\\rho\\left[1 + 3\\,\\mathbf{c}_i\\!\\cdot\\mathbf{u} + \\tfrac{9}{2}(\\mathbf{c}_i\\!\\cdot\\mathbf{u})^2 - \\tfrac{3}{2}\\,|\\mathbf{u}|^2\\right]',
      plain: 'The equilibrium mix for a cell with density ρ moving at velocity u.',
      symbols: [
        ['w_i', 'weight of direction i: 4/9 still, 1/9 sides, 1/36 diagonals', ''],
        ['\\rho = \\textstyle\\sum_i f_i', 'density', 'lattice units (rest = 1)'],
        ['\\mathbf{u} = \\textstyle\\sum_i f_i\\,\\mathbf{c}_i / \\rho', 'fluid velocity', 'cells per step'],
      ],
    },
    {
      tex: '\\nu = \\tfrac{1}{3}\\left(\\tau - \\tfrac12\\right), \\qquad \\mathrm{Re} = \\frac{U D}{\\nu}',
      plain: 'The relaxation time τ fixes the viscosity, and with the speed and size it fixes the Reynolds number: the one number that decides what the flow looks like.',
      symbols: [
        ['\\nu', 'kinematic viscosity: how quickly the fluid smooths out differences in speed', 'cells² per step'],
        ['\\tau', 'relaxation time; must stay above ½ (we keep it ≥ 0.512–0.53 for stability)', 'steps'],
        ['U,\\ D', 'flow speed and body size', 'cells per step, cells'],
        ['\\mathrm{Re}', 'Reynolds number: inertia over viscosity', 'dimensionless'],
      ],
    },
  ],
  walls:
    'Walls bounce populations straight back (bounce-back). A moving wall adds a little momentum on the way back (Ladd 1994). The force on a body is the momentum those bounces exchange (momentum exchange, in its Galilean-invariant form; Wen et al. 2014).',
  units:
    'Everything runs in lattice units: one cell is the unit of length and one step the unit of time. Only dimensionless numbers (Re, St, force coefficients) carry over to real flows, and they carry over exactly: water past a 1 cm pipe at Re = 100 looks the same as this.',
  refs: [
    ['Krüger et al., The Lattice Boltzmann Method: Principles and Practice (Springer, 2017)', 'https://doi.org/10.1007/978-3-319-44649-3'],
    ['Ginzburg, Verhaeghe & d’Humières, Commun. Comput. Phys. 3, 427 (2008): TRT scheme', 'https://scholar.google.com/scholar?q=Ginzburg+Verhaeghe+d%27Humieres+2008+Two-relaxation-time+lattice+Boltzmann+scheme+parametrization+boundary+conditions'],
    ['Ladd, J. Fluid Mech. 271, 285 (1994): moving bounce-back', 'https://arxiv.org/abs/comp-gas/9306004'],
    ['Wen et al., J. Comput. Phys. 266, 161 (2014): Galilean-invariant momentum exchange', 'https://arxiv.org/abs/1303.0625'],
  ],
};

export const CONTENT = {
  cylinder: {
    title: 'Cylinder Wake',
    tagline: 'A cylinder moving through still water sheds vortices left, right, left.',
    kind: 'benchmark',
    check: 'checked',
    seeing:
      'You are riding along with a cylinder moving through still water, so the water streams past it from the left. Above Re ≈ 47 the wake can’t stay symmetric: vortices peel off alternately from the top (blue, spinning clockwise) and bottom (terracotta, counter-clockwise). This is the von Kármán vortex street, the same thing that makes wires hum in wind.',
    tryThis: [
      'Drop Re below 45. The wake settles into two still eddies and the lift trace goes flat.',
      'Raise Re to 200. Shedding gets faster (St rises) and the street tightens.',
      'Watch the lift trace: one full swing is one pair of vortices.',
    ],
    equations: [
      {
        tex: '\\mathrm{St} = \\frac{f\\,D}{U}',
        plain: 'How often vortices shed, scaled by size and speed. Around 0.16–0.2 for a cylinder over a wide range of Re.',
        symbols: [
          ['f', 'shedding frequency: one full lift cycle', 'per step'],
          ['D', 'cylinder diameter', 'cells'],
          ['U', 'free-stream speed', 'cells per step'],
        ],
      },
      {
        tex: 'C_D = \\frac{F_x}{\\tfrac12 \\rho U^2 D}, \\qquad C_L = \\frac{F_y}{\\tfrac12 \\rho U^2 D}',
        plain: 'Drag and lift as fractions of the dynamic pressure acting on the cylinder’s width.',
        symbols: [
          ['F_x,\\ F_y', 'force on the cylinder along and across the flow', 'lattice force per unit span'],
          ['\\rho', 'fluid density', '1 in lattice units'],
        ],
      },
    ],
    refs: [
      ['Williamson, Annu. Rev. Fluid Mech. 28, 477 (1996): vortex dynamics in cylinder wakes', 'https://doi.org/10.1146/annurev.fl.28.010196.002401'],
      ['Park, Kwon & Choi, KSME Int. J. 12, 1200 (1998): drag coefficient 1.33, St = 0.165 at Re = 100', 'https://scholar.google.com/scholar?q=Park+Kwon+Choi+1998+Numerical+solutions+of+flow+past+a+circular+cylinder+at+Reynolds+numbers+up+to+160'],
      ['Provansal, Mathis & Boyer, J. Fluid Mech. 182, 1 (1987): shedding onset near Re ≈ 47', 'https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/benardvon-karman-instability-transient-and-forced-regimes/E952B649863C503D73E6178E2C2013AD'],
    ],
    limits: [
      '2D: real cylinder wakes go 3D above Re ≈ 190, which this cannot show.',
      'Channel walls at ±5 D raise drag and shedding rate a few percent (10% blockage).',
      'The wall is a staircase of cells, 24 across at Balanced quality.',
    ],
  },
  spinning: {
    title: 'Spinning Cylinder',
    tagline: 'Spin a cylinder in a stream and it lifts: the Magnus effect behind curveballs.',
    kind: 'machine',
    check: 'checked',
    seeing:
      'The cylinder spins clockwise, so its top surface moves with the stream and its bottom against it. Flow speeds up over the top and slows underneath, and the pressure difference pushes the cylinder up. As the spin ratio α grows, lift grows and the vortex street weakens until, near α ≈ 1.9 at Re = 100, shedding stops altogether.',
    tryThis: [
      'Set α to 0: it’s the plain cylinder, with lift averaging zero.',
      'Raise α slowly to 2. The mean lift climbs and the wiggle in the lift trace dies.',
      'Compare the measured lift with the ideal-flow line 2πα; real (viscous) lift is always lower.',
    ],
    equations: [
      {
        tex: '\\alpha = \\frac{\\Omega R}{U}',
        plain: 'Spin ratio: how fast the surface moves compared with the oncoming flow.',
        symbols: [
          ['\\Omega', 'rotation rate (clockwise)', 'radians per step'],
          ['R', 'cylinder radius, D/2', 'cells'],
        ],
      },
      {
        tex: "L' = \\rho\\,U\\,\\Gamma \\;\\;\\Rightarrow\\;\\; C_L^{\\text{ideal}} = 2\\pi\\alpha",
        plain: 'Kutta–Joukowski: lift equals density × speed × circulation. If the spinning surface dragged all the fluid around with it (no viscosity, no separation), the lift coefficient would be 2πα. Real lift falls short.',
        symbols: [
          ["L'", 'lift per unit span', 'lattice force'],
          ['\\Gamma = 2\\pi R\\,(\\Omega R)', 'circulation if the fluid moved with the surface', 'cells² per step'],
        ],
      },
    ],
    refs: [
      ['Kang, Choi & Lee, Phys. Fluids 11, 3312 (1999): laminar flow past a rotating cylinder', 'https://doi.org/10.1063/1.870190'],
      ['Stojković, Breuer & Durst, Phys. Fluids 14, 3160 (2002): shedding stops near α ≈ 1.8 at Re = 100', 'https://doi.org/10.1063/1.1492811'],
    ],
    limits: [
      '2D, laminar. Real Magnus lift at sports-ball Reynolds numbers (10⁵) involves turbulence and can even reverse sign.',
      'A spinning staircase wall needs resolution: the cylinder is 32 cells across, and α is capped at 2.',
      'Channel walls at ±4 D (12.5% blockage).',
    ],
  },
  foil: {
    title: 'Flapping Wing',
    tagline: 'Heave a wing up and down fast enough and drag turns into thrust.',
    kind: 'machine',
    check: 'qualitative',
    seeing:
      'A wing section (NACA 0012) heaves up and down in a stream, and can also pitch. At low flapping rates it leaves a normal drag wake. Raise the Strouhal number and the vortex street flips (terracotta on top, blue below, the opposite of the cylinder): a reverse von Kármán street, which pushes a jet backwards. That jet is thrust. This is how birds, bats and many fish (their tails) swim and fly.',
    tryThis: [
      'Start at St = 0: a still wing in a stream, small drag.',
      'Raise St past ~0.2. The wake flips and mean drag ($C_D$) turns negative, which means thrust.',
      'Add 10–15° of pitch: the wing feathers, angles of attack drop, and the flow stays smoother.',
    ],
    equations: [
      {
        tex: 'h(t) = h_0 \\sin(2\\pi f t), \\qquad \\theta(t) = \\theta_0 \\sin\\!\\left(2\\pi f t + \\tfrac{\\pi}{2}\\right)',
        plain: 'The wing heaves (up-down) and pitches (nose up-down) at the same frequency, with pitch leading heave by a quarter cycle.',
        symbols: [
          ['h_0', 'heave amplitude, 0.2 chord', 'cells'],
          ['\\theta_0', 'pitch amplitude, about the quarter-chord point', 'degrees'],
          ['f', 'flapping frequency', 'per step'],
        ],
      },
      {
        tex: '\\mathrm{St} = \\frac{2 h_0 f}{U}, \\qquad \\alpha_{\\text{eff}}(t) = \\theta(t) - \\arctan\\frac{\\dot h(t)}{U}',
        plain: 'St compares the trailing-edge sweep with the flow speed. Swimmers and flyers cruise at St ≈ 0.2–0.4. The effective angle of attack is what the wing actually feels.',
        symbols: [
          ['2h_0', 'peak-to-peak heave', 'cells'],
          ['\\dot h', 'heave velocity', 'cells per step'],
          ['c', 'chord (the wing’s length), 64 cells at Balanced', 'cells'],
        ],
      },
    ],
    refs: [
      ['Triantafyllou, Triantafyllou & Grosenbaugh, J. Fluids Struct. 7, 205 (1993): best thrust at St ≈ 0.25–0.35', 'https://doi.org/10.1006/jfls.1993.1012'],
      ['Godoy-Diana, Aider & Wesfreid, Phys. Rev. E 77, 016308 (2008): the wake flips before drag turns to thrust', 'https://arxiv.org/abs/physics/0702219'],
    ],
    limits: [
      'Qualitative: we show the drag-to-thrust transition and the wake flip, not exact thrust values.',
      'Re (chord) is limited to 100–400 by stability, far below birds (10⁴–10⁵). Viscous drag is larger here, so thrust needs a higher St.',
      'Prescribed motion: the wing doesn’t react to the forces on it.',
    ],
  },
  fish: {
    title: 'Swimming Fish',
    tagline: 'A travelling wave down the body pushes water back and the fish forward.',
    kind: 'animal',
    check: 'qualitative',
    seeing:
      'A fish shape held in a current (tethered, like in a flume) bends with a wave that travels from head to tail and grows toward the tail, the carangiform style of mackerel and jacks. Each tail beat sheds a vortex. Strong enough beats form a reverse street that pushes water back: the net force along the body turns from drag to thrust.',
    tryThis: [
      'Lower St to 0.15: the tail flicks weakly and the body is dragged backwards ($C_x > 0$).',
      'Raise St toward 0.3–0.4 (where real fish cruise). Net force crosses zero into thrust.',
      'Watch the head: it barely moves; the motion is in the back third.',
    ],
    equations: [
      {
        tex: 'y(x,t) = L\\,A\\!\\left(\\tfrac{x}{L}\\right) \\sin\\!\\left[2\\pi\\left(\\frac{x}{\\lambda} - f t\\right)\\right]',
        plain: 'The body’s midline is a wave travelling toward the tail, whose size grows along the body.',
        symbols: [
          ['x', 'distance from the head', 'cells'],
          ['L', 'body length, 100 cells at Balanced', 'cells'],
          ['\\lambda', 'wavelength, 1.05 L', 'cells'],
          ['f', 'tail-beat frequency', 'per step'],
        ],
      },
      {
        tex: 'A(s) = 0.02 - 0.0825\\,s + 0.1625\\,s^2, \\qquad \\mathrm{St} = \\frac{2\\,A(1)\\,L f}{U}',
        plain: 'Amplitude envelope fitted to a swimming saithe: small at the head (0.02 L), smallest just behind it, largest at the tail (0.1 L).',
        symbols: [
          ['s = x/L', 'position along the body', '0 = head, 1 = tail'],
          ['A(1)\\,L = 0.1\\,L', 'tail amplitude', 'cells'],
        ],
      },
    ],
    refs: [
      ['Khalid et al., arXiv 2010.04748: kinematics (Eqs. 1–2), λ ≈ 1.05 L, St ≈ 0.3', 'https://arxiv.org/abs/2010.04748'],
      ['Videler, Fish Swimming (Chapman & Hall, 1993): the saithe data behind A(s)', 'https://scholar.google.com/scholar?q=Videler+1993+Fish+Swimming+Chapman+Hall'],
    ],
    limits: [
      'Qualitative only: a 2D slice with a NACA 0012 thickness, not a real fish cross-section.',
      'Tethered in a current with prescribed motion: it doesn’t swim freely or react to forces.',
      'Re ≤ ~800 (body length), versus 10⁵ or more for real fish. The wall speed uses the small-amplitude (sideways-only) form.',
    ],
  },
  draw: {
    title: 'Draw and Drag',
    tagline: 'Draw any shape, then drag it through the water and feel the wake.',
    kind: 'playground',
    check: 'qualitative',
    seeing:
      'Grab the shape and move it. The water is still (or gently flowing, if you turn the current on). A moving body pushes water aside and leaves vortices behind, and how many depends on its shape and speed. Blunt shapes leave big wakes; slim ones slip through. Stop suddenly and watch the wake overtake the body.',
    tryThis: [
      'Drag the slim shape sideways (broadside), then up and down (edge-on). Compare the wakes and the force arrow.',
      'Press D (or Draw) and sketch a closed loop, like a fish, a boat or a letter, then drag it.',
      'Move in a circle: the shape runs into its own wake.',
    ],
    equations: [
      {
        tex: "F_D = \\tfrac12\\,\\rho\\,v^2\\,C_D\\,h, \\qquad \\mathrm{Re} = \\frac{v\\,h}{\\nu}",
        plain: 'Drag grows with the square of speed. $C_D$ captures everything about shape (and Re).',
        symbols: [
          ['v', 'shape speed relative to the water', 'cells per step'],
          ['h', 'shape height across the motion', 'cells'],
          ['C_D', 'drag coefficient', 'dimensionless'],
        ],
      },
    ],
    refs: [],
    limits: [
      'Speed is capped at 0.08 cells per step to stay accurate, so a fast drag lags your pointer.',
      'The shape only translates (no rotation), and the drag numbers are rough: forces on a moving staircase wall are noisy.',
      'Re around 150 at the reference speed.',
    ],
  },
};
