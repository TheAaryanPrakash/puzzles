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
