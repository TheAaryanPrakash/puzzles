# Sudoku & Mini Sudoku — HANDOFF

One agent, two games, sharing a generation engine (`scripts/sudoku/{core,grading}.ts`) and a board
engine + UI (`src/games/sudoku/shared/`) per CLAUDE.md's explicit allowance for this agent. See
`RESEARCH.md` for sources, the chosen approach and every edge case considered.

## Built

**Generators** (`scripts/sudoku/`, `scripts/mini-sudoku/`) — MRV-backtracking fill + hole-digging
with an exhaustive `countSolutions` uniqueness check (not a heuristic), and a technique-based
difficulty grader (singles → locked candidates/pairs → "needs backtracking"). Both games write the
full `SCHEDULE_DAYS` schedule from `LAUNCH_DATE`, matching the weekday→difficulty table in CLAUDE.md
(sudoku: Mon/Tue easy, Wed/Thu medium, Fri/Sat hard, Sun medium; mini: easy Mon–Thu, medium Fri–Sun).
`scripts/out/{sudoku,mini-sudoku}-samples.md` are written and were read critically before moving on.

**Shared board engine** (`src/games/sudoku/shared/engine.ts`) — pure functions (`setEntry`,
`toggleNote`, `eraseCell`, `findConflicts`, `getHighlight`, `isSolved`, …) parameterized by
`BoardConfig {size, boxH, boxW}`, used by both games' own `logic.ts`. Given cells are immutable;
setting a value clears that cell's notes; noting a filled cell is a no-op — all covered in
`engine.test.ts`, `sudoku/logic.test.ts` and `mini-sudoku/logic.test.ts`.

**Shared UI** (`src/games/sudoku/shared/components/`) — `Board` (cell-first grid: click/tap or arrow
keys to select, box dividers drawn in `var(--game-fg)` for contrast, notes render in a
`ceil(sqrt(size))`-column mini-grid, conflict/peer/same-value highlighting, win-state shimmer, full
`motion`/`useReducedMotion` support) and `NumberPad` (digit pad with per-digit "already placed `size`
times" dimming, Notes toggle, Erase, in-memory Undo — all ≥44px touch targets).

**Both games' `index.tsx`** — wired to the full contract: `usePuzzle`/`usePlay`, the `{}`-gotcha-safe
`{ ...defaultState(puzzle), ...play?.state }` merge, `start()` deferred to the first real move, a
timer that ticks locally before `start()` and then persists through `play.state.elapsed` afterwards,
win detection → `finish({ won: true, ... })` → `ResultModal` + confetti (via the shared
`completeGame`), `AlreadyPlayed` + "View result" for a replayed finished day, physical-keyboard
support (digits, Backspace/Delete to erase, `N` to toggle notes, Ctrl/Cmd+Z to undo — all suppressed
while any Modal, including GameLayout's own Archive/Stats, is open), and a spoiler-free
`buildSummary` (puzzle number, difficulty emoji, `m:ss` solve time — never the grid).

**Themes** — sudoku: paper white (`#faf7f0`) with ink-blue (`#1e3a8a`) entries, Source Serif 4
headline + IBM Plex Mono digits. Mini sudoku: pastel lilac/pink (`#fdf4fb`/`#c15fb0`), rounded cells
(`--tile-radius: 0.9rem`), Nunito throughout.

## Deviations from the prompt (explained further in RESEARCH.md)

- No number-first input mode — research (Sommervold 2020) favors cell-first as the default; not
  adding a second mode nobody asked for.
- No lose state — sudoku's brief lists "win detection", not "lose"; a play stays `in_progress` until
  solved, matching how the physical game and most clones behave. "Optional mistake check" is a
  view-only highlight toggle, not a fail condition.
- `score` is elapsed seconds, not required by the prompt but accepted by `ResultModalProps` — lets
  friends' solve times show up in the friends board instead of just ✅.
- Undo is in-memory only (not part of the persisted `{entries, notes, elapsed}` state) — see "Known
  issues".

## Review — please check by hand

1. **Box divider contrast** (`shared/components/Board.tsx`): box edges draw in `var(--game-fg)` at
   full opacity, cell edges in `var(--game-border)`. Worth a glance on an actual device/monitor, not
   just the screenshots, since this was the one thing that looked wrong in an early pass (box lines
   were the same colour as ordinary cell borders and essentially invisible).
2. **Timer behaviour**: play a puzzle, wait a few seconds *before* your first move, then make your
   first move — the elapsed time shown should already include that wait (it ticks locally pre-
   `start()`, then hands off to `play.state.elapsed`). Also check it stops exactly on solve and stays
   stopped when revisiting an already-won day.
3. **Modal + keyboard**: open Help (or GameLayout's Archive) mid-puzzle and type digits — the board
   underneath must not change (fixed via a `document.querySelector('[role="dialog"]')` guard in the
   global keydown handler; GameLayout's Archive modal state isn't visible to this game, so this is a
   DOM-based workaround rather than a prop-based one).
4. **Notes mode on mobile at 375px** (`screenshots/mobile.png` for both games) — pencil marks are
   small by necessity on a 9×9 board; confirm they're still legible on an actual phone.
5. **Mini sudoku's difficulty signal**: RESEARCH.md found the technique grader reports "easy" for
   almost every 6×6/2×3 puzzle regardless of clue count, so mini's two tiers are driven by clue count
   alone (grader only used as a "never ship something needing real backtracking" floor). Worth
   playing a "medium" (Fri–Sun) mini day to confirm it still feels meaningfully harder than "easy".

## Shared changes requested

None. `Board.tsx`/`NumberPad.tsx` live in this agent's own `src/games/sudoku/shared/` (explicitly
allowed for sudoku+mini-sudoku in CLAUDE.md's prompt), so no changes were needed in `src/components/`
or `src/lib/data/types.ts`.

## Licences

None. No code was copied from any reviewed project (see RESEARCH.md's comparison table) — every
generator, grader and UI function here was written from scratch, informed by the approaches reviewed.

## Known issues

- **Undo only reaches back to the last reload.** `state` is exactly `{ entries, notes, elapsed }` per
  the prompt, so a history stack can't live inside it; the undo stack is a plain in-memory
  `useState` array, reset on every reload or day change. Documented in RESEARCH.md as a deliberate
  trade-off.
- **NumberPad's per-digit "complete" dimming is a raw frequency count**, not a correctness check — a
  digit dims once it's been placed `size` times anywhere on the board, even if one of those
  placements is wrong. Matches most sudoku apps' behaviour (dimming is a convenience, not a solver
  hint) but is worth knowing about.
- **Hover styles use plain Tailwind `hover:` classes** (no `@media (hover: hover)` guard), consistent
  with the rest of the codebase (e.g. `Button.tsx`) — not fixed here since it's a site-wide pattern,
  not specific to these two games.

## Phase 2 (redesign, 2026-10) — verification + one real bug found

Both `theme.css` files were already redesigned (see their own comments) and needed no palette
changes — confirmed the given/entry/error/notes contrast ratios still hold against the new
`--game-bg`/`--game-surface`. This pass was verification + polish, per `prompts/redesign/sudoku.md`.

**Bug fixed** (`shared/components/Board.tsx`): the conflict highlight (`text-brand-danger`, used
when "Check mistakes" flags a cell) never actually rendered — it was always pink, identical to a
normal entry. Root cause: the cell's `className` array could include both `text-game-accent` and
`text-brand-danger` at once (the given/entry base color and the conflict override), two classes
setting the same CSS property at equal specificity. Tailwind v4's generated rule order — not JSX
order — decided which one painted, and it consistently lost to the accent pink. Verified with pixel
sampling: conflicting cells rendered exactly `#ea86a7` (accent), zero `#e06552` (danger) pixels,
even though the `aria-label` correctly said "conflicts with another cell" the whole time — the bug
was purely visual, so it was easy to miss from a code read alone. Fixed by computing a single
`textColorClass` (`isConflict ? danger : given ? tile-fg : accent`) so at most one color class is
ever applied. This landed in the one shared `Board.tsx`, so it fixes the conflict highlight for both
Sudoku and Mini Sudoku — confirmed in-browser for both games after the fix (screenshots below).

**A dev-loop gotcha worth recording for future agents in this worktree**: `vite.config.ts` sets
`watch.ignored: ["**/.claude/**"]` (so the main checkout's dev server doesn't react to every agent
worktree's files). Since each worktree itself lives under `.claude/worktrees/<agent>/`, its *own*
dev server's file watcher also ignores its *own* source edits — so Vite's in-memory transform cache
goes stale after an edit and a plain browser reload (even a fresh profile/navigation) can keep
serving the pre-edit module indefinitely. **A source edit in this worktree needs a dev-server
restart, not just a reload**, before trusting what the browser shows. This cost real time here: the
conflict-color fix above looked like it wasn't working for several reload/re-navigate attempts until
the dev server itself was restarted.

**Verified** (both games, `PORT=5204 pnpm dev`, `playwright-cli --headed`, iPhone-15 emulation +
1440×900 desktop): given/entry/conflict/notes colors all read clearly (notes confirmed legible at
375px), "Check mistakes" conflict highlight now correctly shows red, physical-keyboard digit entry
and the `N` notes-toggle shortcut work, Mini Sudoku's rounder cells/grid render correctly through the
same `Board.tsx`. `howTo` copy in both `meta.ts` files was re-read and is already clear — no changes
needed. Neither game does pointer-dragging, so `src/lib/noSwipe.ts` doesn't apply here.

`pnpm test` (836 tests, full suite) and `pnpm build` both pass. `node scripts/check-scope.mjs sudoku`
passes (1 file changed: `shared/components/Board.tsx`).

### Shared changes requested (phase 2)
None — the fix was inside this agent's own `src/games/sudoku/shared/`.
