# Redesign agent `zip`: Zip

Game id: `zip` · Dev server port: **5208** · Scope check: `node scripts/check-scope.mjs zip`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## The drag-path bug: already fixed, on main
What the original brief meant by this is already done, outside this worktree:
- Drag-to-draw was completely dead (a shared `noSwipeProps` regression swallowed the board's own
  `onPointerMove` handler) — fixed, see `prompts/redesign/_game.md` §1 for the exact gotcha.
- Wall separators (`--zip-wall`) were nearly invisible against the cell fill — fixed, now a bright,
  clearly-contrasting colour.

Both are already on main; you'll have them in your worktree. **Don't re-investigate or re-fix
either** — verify live that dragging still works and walls are still visible, then move on.

## Focus: add 3 tests for the drag-path interaction
`applyCellInteraction` (`src/games/zip/logic.ts`) is "the single rule engine behind both
drag-to-draw and arrow-key movement" (its own doc comment) — this is the actual pure-logic surface
behind dragging, so this is where drag-path tests belong, not anything DOM/pointer-event-based.
Existing coverage (`src/games/zip/logic.test.ts`'s `applyCellInteraction` block) already has: legal
extension, drag-back retraction, and one illegal-cell case (a diagonal neighbour). Three real gaps
to fill:
1. A drag attempt across a wall from the current path end — `canExtend` checks `hasWall` (tested
   directly), but `applyCellInteraction` itself has no wall-blocked case.
2. A drag onto a checkpoint cell visited out of order (e.g., checkpoint 3 before checkpoint 2) —
   same gap, `canExtend`'s checkpoint-order check isn't exercised through `applyCellInteraction`.
3. Drag-back retraction all the way to a single-cell path (re-entering checkpoint 1 itself) — the
   existing retraction test only covers retracting to a multi-cell prefix, not down to length 1.

## Restyle
`src/games/zip/theme.css` is already redesigned (path gradient, wall colour just fixed above). No
fx component is assigned to this game for phase 2. Spot-check at 375px; otherwise this is done.
