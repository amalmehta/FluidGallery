# Prompt log

## 2026-11-11 — Build the project from the spec

1. > fluid dynamics simulator around various things in motion, with accurate equations: build this project. Read fluid dynamics simulator around various things in motion, with accurate equations.md in this folder and build what it describes, following its META-INSTRUCTIONS exactly.

   Led to: reading the spec, two rounds of questions, the build.

2. Answers in the question widget (round 1): purpose: build my own intuition, robotics / RL use, teach others, portfolio piece. Accuracy: checked 2D, honest limits. Why build: things that move. Objects: classic benchmarks, animals, machines, draw your own.

   Led to: pushback on breadth (every option picked) and a narrowing round.

3. Answers (round 2): one purpose: robotics intuition. v1 set: the 5 proposed (cylinder, spinning cylinder, flapping wing, fish, draw-and-drag). Hosting: public repo + GitHub Pages. Feedback: open a GitHub issue.

   Led to: a check on the trade-off and the visual choice.

4. Answers (round 3): trade-off of 2D: "3D effects are missing". Flow look: vorticity, blue–terracotta.

   Led to: design doc, CPU solver, speed measurement.

5. Answer (mid-build): speed: GPU solver + CPU reference.

   Led to: the WebGL2 solver, GPU-vs-CPU tests, stability work, the site.
