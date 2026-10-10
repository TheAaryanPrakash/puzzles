# Agent `travle`: Travle

Game id: `travle` · Dev server port: **5212** · Scope check: `node scripts/check-scope.mjs travle`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at original Travle's rules (guess allowance, colour meanings, island countries), border-adjacency data
quality and its known gaps.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Land-border adjacency via topojson-client `neighbors()` plus a documented fixes file in
  `scripts/travle/`. Daily start/end pairs with 3–7 countries between them (BFS), seed 91.
  Day file `{ start, end, shortestLength, allowedGuesses }`.
- Game: a map with start and end; guessed countries coloured on-path / adjacent / unconnected;
  won when start and end are connected within the allowance.
- State: `{ guesses }`. Theme: muted atlas palette (sea blue, land beige), Inter.
