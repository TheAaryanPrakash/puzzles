# Agent `zip`: Zip

Game id: `zip` · Dev server port: **5208** · Scope check: `node scripts/check-scope.mjs zip`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at LinkedIn Zip's rules, Hamiltonian path generation and uniqueness checking, smooth drag-to-draw on touch
(pointer capture, hit-testing between cells).

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: size by weekday (6×6 Mon–Wed, 7×7 Thu–Sat, 8×8 Sun), a random Hamiltonian path, numbered
  checkpoints, optional walls; add constraints until there is exactly one solution. Seed 51.
  Day file `{ size, checkpoints, walls, solution }`. Test uniqueness for every generated file.
- Game: drag to draw, drag back to retract, undo, clear, timer, arrow keys extend the path.
- State: `{ path, elapsed }`. Theme: light grid, orange→purple gradient path, Nunito.
