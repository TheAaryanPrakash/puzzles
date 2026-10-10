# Agent `states`: Indian States (id `states`)

Game id: `states` · Dev server port: **5213** · Scope check: `node scripts/check-scope.mjs states`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at existing India-map guessing games, alternate and former state names, scaling proximity to India's
extent rather than the globe's.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: states and union territories from `public/assets/shared/india-states.json`, seed 101,
  no repeats until used up. Silhouettes → `public/assets/states/silhouettes.json`. Day file `{ code }`.
- Game: the Worldle mechanic within India, with aliases (Orissa → Odisha, Bombay-era names where
  relevant), distance, arrow, and proximity scaled to India.
- State: `{ guesses }`. Theme: terracotta, indigo and cream, Poppins.
