# Agent `flagle`: Flagle

Game id: `flagle` · Dev server port: **5210** · Scope check: `node scripts/check-scope.mjs flagle`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at original Flagle's reveal mechanics and feedback, rendering flags at small sizes.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: countries that have a flag in flag-icons, seed 71, no repeats. Day file `{ code }`.
- Game: the flag under a 2×3 grid of tiles; each wrong guess reveals one tile (in a seeded order);
  6 guesses with autocomplete and geo feedback.
- State: `{ guesses }`. Theme: neutral background, tile flip reveal, Inter.
