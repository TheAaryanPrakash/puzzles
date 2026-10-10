# Agent `sudoku`: Sudoku and Mini Sudoku (two games, one agent)

Game id: `sudoku and mini-sudoku` · Dev server port: **5204** · Scope check: `node scripts/check-scope.mjs sudoku`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at fast generators with uniqueness checks (dancing links vs backtracking), technique-based difficulty
grading, phone input UX (cell-first vs number-first), notes mode.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- You own two games: `sudoku` (9×9) and `mini-sudoku` (6×6, 2×3 boxes). Shared generator code may live
  in `scripts/sudoku/` and be imported by `scripts/mini-sudoku/`; shared UI may live in
  `src/games/sudoku/shared/` and be imported by mini-sudoku.
- Unique-solution puzzles. Difficulty by weekday (sudoku: Mon/Tue easy, Wed/Thu medium, Fri/Sat hard,
  Sun medium; mini: easy Mon–Thu, medium Fri–Sun). Seeds 11 and 12.
  Day file `{ puzzle, solution, difficulty }`. A test checks every generated file has exactly one solution.
- Game: select a cell, number pad and keyboard, notes, erase, undo, highlights, optional mistake
  check, timer (elapsed seconds in state), win detection.
- State: `{ entries, notes, elapsed }`.
- Themes: sudoku is paper white with ink-blue entries, Source Serif 4 + IBM Plex Mono. Mini sudoku is
  pastel with rounded cells, Nunito.
- Use the agent name `sudoku` for check-scope; it covers both folders.
