# Agent `wordle`: Wordle

Game id: `wordle` · Dev server port: **5201** · Scope check: `node scripts/check-scope.mjs wordle`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at duplicate-letter colouring, hard-mode rules exactly as the original enforces them, invalid-word
feedback, flip timing, keyboard colour precedence, accessible tile announcements (aria-live), the
original share format.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: answers = ENABLE ∩ common rank < 15000, minus blocklist, plurals (ends in s, stem in
  ENABLE) and past tenses (ends in ed, stem in ENABLE). Seed 1, no repeats in the schedule.
  Day file `{ answer }`. Guess list → `public/assets/wordle/guesses.json`.
- Game: 6 guesses, shared Keyboard and `lib/wordle-score.ts`, row shake + toast on an invalid word,
  staggered flip reveal, optional hard mode (a per-play setting, fixed at the first guess).
- State: `{ guesses: string[], hardMode: boolean }`. Everything else is derived.
- Theme: white, near-black, square tiles, #6aaa64 / #c9b458 / #787c7e, Libre Franklin, with a
  DM Serif Display title.
