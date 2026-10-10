# Agent `bee`: Spelling Bee

Game id: `bee` · Dev server port: **5203** · Scope check: `node scripts/check-scope.mjs bee`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at the official rules (centre letter, minimum length, pangram bonus, rank thresholds and names), how
clones source word lists and avoid obscure words, hive layout on small screens, shuffle animation.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: 7-letter sets from pangrams in ENABLE ∩ common (top 40k), no S, blocklist removed,
  bitmask + submask enumeration, 20–60 answers per puzzle, seed 7.
  Day file `{ center, outer, answers, pangrams, maxScore }`.
- Game: hive, type or tap, delete, shuffle, enter, feedback messages, found-words list, rank bar.
- Completion: the play stays in progress while she finds words (save after every word). It finishes
  when she taps "Finish for today" or finds every word, and auto-finishes when an earlier day's
  in-progress play is opened. Won = reached Genius at finish.
- State: `{ found: string[] }`. Theme: yellow #f7da21 centre, grey hexes, bold Libre Franklin.
