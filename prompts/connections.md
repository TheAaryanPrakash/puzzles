# Agent `connections`: Connections

Game id: `connections` · Dev server port: **5206** · Scope check: `node scripts/check-scope.mjs connections`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at the official rules (one-away hint, mistakes, reveal order, share format), how clones store and shuffle
puzzles, selection UX and animations.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Read `data/README.md` first (the data agent found 628 clean puzzles, 2023-06-12 to 2025-02-28).
  Importer: archive puzzles before ARCHIVE_CUTOFF, normalised to `{ groups: [{ label, level, words }] }`,
  NYT metadata stripped. Validate: 4 groups of 4, 16 unique words, levels 0–3 once each, no split
  numbers (e.g. "20" + "000" from "20,000"). Report rejected puzzles and counts in the samples file.
- Scheduling (seed 31): there aren't enough puzzles for a unique main *and* a unique reserve every day,
  so: shuffle the valid puzzles; the first 365 are the daily mains (no repeats); everything left is
  the **reserve pool**. Day *n*'s reserve is `pool[n % pool.length]`. A reserve is never a main on any
  day. Day file `{ "payload": <main>, "reserve": <reserve> }`. Report the pool size.
- Game: select 4, submit, shuffle, deselect all, "One away…" toast, 4 mistakes, solved groups become
  coloured bars, a loss reveals the rest in order. "Seen this before? Skip" before the first guess.
- State: `{ guesses: string[][], order: string[] }` (order, so a shuffle survives a refresh).
- Theme: off-white, beige rounded tiles, bold uppercase Libre Franklin.
