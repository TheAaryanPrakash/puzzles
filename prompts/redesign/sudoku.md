# Redesign agent `sudoku`: Sudoku and Mini Sudoku (two games, one agent)

Game id: `sudoku and mini-sudoku` · Dev server port: **5204** · Scope check:
`node scripts/check-scope.mjs sudoku` (covers both folders, same grouping as phase 1)

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
Both `src/games/sudoku/theme.css` and `src/games/mini-sudoku/theme.css` are already redesigned
(given/entry/error ink colours re-derived against the new dark board; mini-sudoku shares the same
family via `--game-accent`, reusing `sudoku/shared/components/Board.tsx`). Don't re-derive the
palette. No fx component is assigned to either game for phase 2.

## What to actually do
This is a verification + polish pass on both games, not a build:
- Play both at 375px and with a physical keyboard (cell select, number pad, notes mode, undo,
  mistake-check if present) — check given/entry/error/notes all still read clearly, and that the
  shared `Board.tsx` looks right at both sizes (9×9 and 6×6).
- Read each game's `meta.ts` `howTo` with fresh eyes; polish if sparse.
- If anything about the shared board component looks like it's still assuming the old paper-white
  (sudoku) or pastel (mini-sudoku) background, fix it — but check both games after any shared-file
  change, since they render through the same component.
