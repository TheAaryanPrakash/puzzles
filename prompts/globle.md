# Agent `globle`: Globle

Game id: `globle` · Dev server port: **5211** · Scope check: `node scripts/check-scope.mjs globle`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at how Globle computes border distance and its colour scale, globe rendering performance on phones
(canvas vs SVG, simplification level), touch rotate and zoom.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Precompute a border-to-border distance matrix (neighbours = 0 km) →
  `public/assets/globle/distances.json`. Seed 81, no repeats. Day file `{ code }`.
- Game: a draggable, zoomable orthographic globe on deep navy, unlimited guesses, a warm colour scale
  (far = pale, close = deep red), a closest-so-far list. Must stay smooth on a phone.
- State: `{ guesses }`. Theme: deep navy #0b1026, glowing fills, Space Grotesk.
