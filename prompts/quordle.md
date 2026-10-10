# Agent `quordle`: Quordle

Game id: `quordle` · Dev server port: **5202** · Scope check: `node scripts/check-scope.mjs quordle`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at how existing clones fit 4 boards on a small phone, quadrant keyboard colouring, the original guess
limit and share format.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Generator: the same answer rules as Wordle, implemented independently in `scripts/quordle/` (the
  Wordle agent is building its own at the same time; don't wait for or import it). Seed 2. Four
  distinct answers per day. Add an `--exclude <dir>` flag: when given a folder of Wordle day files,
  no Quordle answer may equal that day's Wordle answer. Integration re-runs it with
  `--exclude content/puzzles/wordle` after merging. Test the flag with a fake folder.
  Day file `{ answers: [a, b, c, d] }`. Guesses: ENABLE 5-letter words → `public/assets/quordle/`.
- Game: 4 boards, 9 guesses, each guess applies to every unsolved board. Quadrant keyboard via the
  Keyboard render prop. Solved boards dim and show their guess count.
- State: `{ guesses }`. Theme: Wordle's tile language but denser, tinted board borders, Libre Franklin.
