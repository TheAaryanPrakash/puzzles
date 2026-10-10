# Agent `worldle`: Worldle

Game id: `worldle` · Dev server port: **5209** · Scope check: `node scripts/check-scope.mjs worldle`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at original Worldle's feedback (distance, direction, the proximity formula), how clones handle tiny
countries and territories, accessible autocomplete.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: countries from `public/assets/shared/countries.json`, excluding very small territories
  (list them in the samples file). Seed 61, no repeats until the pool is used up. Precompute
  silhouettes to `public/assets/worldle/silhouettes.json`. Day file `{ code }`.
- Game: silhouette, 6 guesses through an autocomplete that accepts aliases, and distance / arrow /
  proximity rows using `lib/geo.ts`.
- State: `{ guesses }`. Theme: light grey, dark silhouette, Inter.
