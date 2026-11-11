# Fluid Gallery

Live 2D simulations of things moving through water, solved in your browser on the GPU with the lattice Boltzmann method and checked against published data.

**[Open the gallery →](https://amalmehta.github.io/FluidGallery/)**

| | |
|---|---|
| ![Cylinder wake](assets/thumbs/cylinder-light.png) **Cylinder Wake**: the von Kármán vortex street. *Checked* against St and drag at Re = 100. | ![Spinning cylinder](assets/thumbs/spinning-light.png) **Spinning Cylinder**: Magnus lift, shedding that stops at high spin. *Checked* against published trends. |
| ![Flapping wing](assets/thumbs/foil-light.png) **Flapping Wing**: heave faster and drag turns into thrust. *Qualitative.* | ![Swimming fish](assets/thumbs/fish-light.png) **Swimming Fish**: carangiform kinematics from real fish data. *Qualitative.* |
| ![Draw and drag](assets/thumbs/draw-light.png) **Draw and Drag**: sketch any shape and drag it through the water. | Blue = water spinning clockwise, terracotta = counter-clockwise. Every image here is a real run of the solver. |

```mermaid
flowchart LR
  UI[Page: controls, numbers, equations] -- sliders, pointer --> W[Web Worker]
  W --> G[WebGL2 lattice Boltzmann solver]
  G -- forces --> W -- stats --> UI
  R[CPU reference solver] -. same equations, tested in Node .-> G
```

- [How to run it, use it and test it](docs/INSTRUCTIONS.md)
- [Validation: every number checked, with the commands](docs/VALIDATION.md)
- [System design, decisions and limits](docs/SYSTEM-DESIGN.md)
- [What's where](docs/FILE-STRUCTURE.md)
- [Prompt log](docs/PROMPTS.md)

2D and low Reynolds number (20–800): the mechanisms carry over to real drones and fish, the exact numbers don't. Each sim states its own limits.
