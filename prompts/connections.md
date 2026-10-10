# Agent `connections`: Connections

Game id: `connections` · Dev server port: **5206** · Scope check: `node scripts/check-scope.mjs connections`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at the official rules (one-away hint, mistakes, reveal order, share format), how clones store and shuffle
puzzles, selection UX and animations.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Read `data/README.md` first. Importer: archive puzzles before ARCHIVE_CUTOFF (no dates in the data →
  game 1 = 2023-06-12, one per day), normalised to `{ groups: [{ label, level, words }] }`, NYT
  metadata stripped. Validate: 4 groups of 4, 16 unique words, levels 0–3 once each, no split numbers
  (e.g. "20" + "000" from "20,000"). Seed 31. One main and one reserve per day; day file `{ main, reserve }`.
  Report rejected puzzles and counts in the samples file.
- Game: select 4, submit, shuffle, deselect all, "One away…" toast, 4 mistakes, solved groups become
  coloured bars, a loss reveals the rest in order. "Seen this before? Skip" before the first guess.
- State: `{ guesses: string[][], order: string[] }` (order, so a shuffle survives a refresh).
- Theme: off-white, beige rounded tiles, bold uppercase Libre Franklin.
