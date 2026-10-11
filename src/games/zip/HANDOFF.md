# Zip — HANDOFF

## Built
- Generator (`scripts/zip/`): randomized Hamiltonian path with connectivity-pruned DFS, then a
  witness-driven uniqueness loop (grow a capped checkpoint allowance first, fall back to walling
  off a confirmed alternate solution's edge, re-grow checkpoints past the cap only if walls run
  out). Ran for the full `LAUNCH_DATE … LAUNCH_DATE+365` schedule; every day's `countSolutions`
  comes back exactly 1 (the generator throws otherwise, and it completed cleanly). Samples report
  at `scripts/out/zip-samples.md`.
- Game (`logic.ts` + `index.tsx` + `components/Grid.tsx`): pure rule engine
  (`applyCellInteraction` is the one function behind drag, retraction and arrow keys),
  drag-to-draw via Pointer Events with capture (verified with real pointer-event clicks through a
  live dev server — see Review), undo, clear, a per-second timer persisted in `state.elapsed`,
  physical-keyboard arrow-key + Backspace support, restorable state, spoiler-free share summary.
- Theme: light grid, Nunito, orange→purple gradient path (`components/Grid.tsx`'s `pathColorAt`,
  kept in sync with `theme.css`'s `--zip-path-start/--zip-path-end`), a distinct ring head-marker
  so the current pen position reads without relying on color alone.
- Deviation from RESEARCH.md's plan: the described "staggered pulse down the finished path before
  confetti" win animation was simplified to just the shared `celebrate()` confetti plus the path's
  own per-segment grow-in animation (already satisfies the "signature animation" requirement).
  Adding a second, separate win-only animation sequence felt like gold-plating a very brief moment
  for the added complexity (sequencing it before `finish()`'s persist-then-confetti call without
  delaying the actual save). Noted here rather than silently dropped.
- Deviation from the task prompt's baseline: checkpoint density ended up meaningfully higher than
  "size - 1" (now baseline + a tuned allowance — 8/12/17 checkpoints on 6×6/7×7/8×8 rather than
  5/6/7). This was a deliberate tuning pass after reading the first full-schedule samples report
  critically: pure wall-first uniqueness left 68% of the 365 days with more than 6 walls (the
  report's own "may look cluttered" heuristic), and some rendered grids had a wall on nearly every
  row. The final balance (documented with measurements in RESEARCH.md) cut that to 14% while
  keeping checkpoint density well under half the grid. See RESEARCH.md's "Final tuning" section.

## Review
1. **Checkpoint/wall density tradeoff** — read `scripts/out/zip-samples.md`'s pool stats and a few
   sample grids yourself. Checkpoints now run ~20-30% of the grid's cells (vs. the original
   "size - 1" baseline) to keep the average wall count down; if that reads as too close to
   connect-the-dots for your taste, `scripts/zip/generate.ts`'s `softCheckpointAllowance` is the
   one function to retune (lower it to lean back toward more walls instead).
2. **Touch target size on 8×8 at 375px.** An 8×8 board (Sundays) in a 375px-wide viewport gives
   cells of roughly 43px — just under the usual 44px touch-target guideline. Drag gestures are
   more forgiving than discrete taps (confirmed by testing on a simulated 375px viewport — see
   below), but worth a hands-on check on an actual phone.
3. **Pointer-drag mechanics** — verified end-to-end against a live dev server: single-cell
   clicks, illegal-move rejection (non-adjacent, wrong checkpoint order), wall blocking,
   retraction by clicking back onto an already-drawn cell, Undo, Clear, arrow keys, Backspace,
   full-solution completion → confetti → ResultModal → read-only board on reload. All passed; see
   `src/games/zip/screenshots/`.
4. **`aria-live` was removed from the ticking timer** (would have re-announced every second to
   screen readers) during a `web-design-guidelines` self-review — worth a second look if the
   human wants the final time announced some other way.
5. **Browser-resize tool limitation**: this environment's `resize_window` tool reported success
   but never actually changed the viewport (stuck at ~606×685 regardless of requested size), so
   the "375px" screenshot was captured via an iframe sized to 375 CSS px instead (a legitimate
   test of the responsive layout, since iframes establish their own viewport for width-relative
   CSS) rather than literally resizing the browser window. Worth a real-device check regardless.

## Shared changes requested
None.

## Licences
None — no code copied from external sources (RESEARCH.md's "Code reuse" section confirms every
cited source was read for technique only, not copied from).

## Known issues
- Checkpoint/wall balance is a generator tuning choice, not a bug — see Review #1.
- 8×8-at-375px touch targets are slightly under the usual 44px guideline — see Review #2.
- No hint system (out of scope per RESEARCH.md's "Deliberately left out").
