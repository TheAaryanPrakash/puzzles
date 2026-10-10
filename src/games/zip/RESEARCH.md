# Zip — RESEARCH

## 1. Original game rules

Source: [LinkedIn's "Introducing Zip" announcement on GMPuzzles](https://www.gmpuzzles.com/blog/2025/03/introducing-zip) (the designer's own write-up) plus LinkedIn's in-app rules, cross-checked against
[a walkthrough tutorial](https://www.guideflow.com/tutorial/how-to-play-zip-on-linkedin) and
[AOL's coverage of the launch](https://www.aol.com/linkedin-game-zip-challenge-brain-140009846.html).

- The grid has numbered checkpoint cells (1, 2, 3, …). Draw **one continuous path that visits every
  cell in the grid exactly once**, starting at cell 1, passing through every other numbered cell in
  increasing order, and ending at the highest-numbered cell. It is a full Hamiltonian path, not just
  a connect-the-dots between checkpoints — every blank cell must be covered too.
- Movement is one step at a time, horizontally or vertically. No diagonals.
- The path can't cross or revisit a cell.
- Some boards add **walls** between two adjacent cells; the path can never cross a wall, even though
  the cells are grid-adjacent.
- Every published puzzle has exactly one solution.
- Difficulty ramps across the week (LinkedIn runs Monday easiest through Sunday hardest) — this
  project's CLAUDE.md already encodes that as a size ramp (6×6 Mon–Wed, 7×7 Thu–Sat, 8×8 Sun), which
  this generator follows.

## 2–3. Prior art

No open-source clone of Zip itself turned up (it's a 2025 LinkedIn original), so research focused on
its puzzle family — Numberlink/Flow-Free (connect same-numbered pairs, no full-coverage requirement)
and **Rikudo** (numbered-checkpoint Hamiltonian path on a hex/square grid — mechanically the closest
existing puzzle to Zip) — plus solver write-ups specifically about Zip.

| Source | Approach | Strengths | Known gaps | Licence |
|---|---|---|---|---|
| [thomasahle/numberlink](https://github.com/thomasahle/numberlink) | Go solver + Python generator for Numberlink-family grids | Fast, handles large grids | Generator doesn't verify uniqueness; pairs-only (no full coverage) | not checked for an OSS licence header — **not copied from** |
| [cauimsouza/rikudo-solver](https://github.com/cauimsouza/rikudo-solver) | SAT solver finds a Hamiltonian path; **binary search over added clue clues to find a minimal set that forces a unique solution** | Directly the "add constraints until unique" idea this prompt asks for, for the puzzle closest to Zip | SAT-based, Python — different tech stack, not portable as-is | not checked — **not copied from** |
| [Puzzle Madness's Numberlink generator write-up](https://puzzlemadness.co.uk/howwemakenumberlink/) | Backtracking solver that **keeps searching after the first solution** to detect a second one, used as the uniqueness oracle while building the puzzle | Simple, proven pattern for "generate, then prove unique by trying to find a second solution" | Write-up only, no repo | n/a — technique description only |
| ITB student paper, *"Implementing State-Space Trees and Backtracking Algorithms for an Automated LinkedIn Zip Puzzle Solver"* (Munir, 2025–2026 coursework) | Models Zip exactly as this project does: grid graph, Hamiltonian path, checkpoints impose a strict visiting order; DFS over the state-space tree with order-violation pruning | Zip-specific confirmation of the model and pruning strategy | Solver only (verifies a given board), not a generator | n/a — technique description only |

**Chosen approach**, combining the above: generate a random Hamiltonian path first (so a valid
solution always exists by construction), then — mirroring Puzzle Madness's and Rikudo's
uniqueness-by-search method — add checkpoints (and, if that's not enough, walls) one at a time,
re-running a bounded backtracking solver after each addition until it proves exactly one solution.
No code is copied from any of the above; only the published techniques (DFS with order pruning,
search-for-a-second-solution as a uniqueness oracle, iterative constraint tightening) are reused.

## 4. Chosen approach, in detail

### Hamiltonian path generation (`scripts/zip/hamiltonian.ts: buildHamiltonianPath`)
Randomized DFS with **connectivity pruning**: before committing to a neighbor, flood-fill the
remaining unvisited cells from that neighbor and reject the move if it would strand any unvisited
cell (a well-known speed-up for Hamiltonian-path/knight's-tour backtracking — the general technique
is described in the Hamiltonian-path and Warnsdorff literature found during research, e.g.
[SFU's Hamiltonian path generator notes](https://www.sfu.ca/~eemberly/phys847/assignments/hamiltonian_paths.html)).
Neighbor order is shuffled with the day's `mulberry32` stream so different days get different paths.
A node-expansion budget forces a fresh random restart (new start cell) rather than exploring a bad
branch forever; this comfortably finds full paths on 8×8 within a handful of restarts.

### Checkpoints and uniqueness (`scripts/zip/hamiltonian.ts: countSolutions`, `scripts/zip/generate.ts`)
`countSolutions` is the state-space-tree solver from the ITB paper's model: DFS that extends a
simple path one cell at a time, pruning immediately if a candidate cell is a checkpoint visited out
of order, pruning via the same connectivity check as the generator, and capping at 2 found solutions
(we only need "is it exactly 1", never the full count). The win condition it checks is the full rule
set: every cell visited, checkpoints hit in increasing order, **and the path's last cell is the
highest checkpoint** (matching "ending at the highest number" — see Edge cases below).

Generation per day, per CLAUDE.md's "add constraints until there is exactly one solution":
1. Build a random Hamiltonian path for the day's size.
2. Start with a baseline checkpoint count (one per row, roughly matching real Zip's density) and
   place them at evenly-spaced-with-jitter positions along the path, always including the first and
   last cell.
3. Run `countSolutions` (capped at 2, with a node budget). If it comes back 1, done.
4. Otherwise add one more checkpoint (at the path's current largest gap) and retry.
5. If checkpoints reach a ceiling (half the grid) without reaching uniqueness, add a wall on a
   "chord" edge (two grid-adjacent cells that are **not** consecutive on the solution path, so the
   true solution can never cross it) and reset to the baseline checkpoint count, then repeat from
   step 3.
6. If a size runs out of attempts entirely, build a brand-new random path and start over. The whole
   generator throws if a day can't be solved within the attempt budget (per CLAUDE.md).

This is deterministic: a single `mulberry32(51)` stream (seed 51, per the task prompt) is advanced
sequentially across all `SCHEDULE_DAYS` days in date order, so re-running the generator reproduces
byte-identical output.

### Game logic (`src/games/zip/logic.ts`)
Pure, framework-free functions operating on `{ path, elapsed }`:
- `applyCellInteraction(puzzle, path, cell)` is the single rule engine behind both drag-to-draw and
  arrow-key movement: if `cell` is already in the path, **truncate the path to that point** (drag
  back / arrow-key-into-your-own-tail = retract); otherwise, if it's a legal extension (adjacent to
  the path's current end, or — for an empty path — exactly checkpoint 1; not wall-blocked; and, if
  it's a checkpoint, the *next* one in order), append it; otherwise the path is unchanged (illegal
  moves are silently ignored, matching the original game's feel of "the pen just doesn't move
  there").
- `isSolved` requires full coverage **and** that the path's last cell is the highest checkpoint —
  not just "all checkpoints visited in order" — see Edge cases.

### Drag-to-draw UX
Per research into pointer-events drag patterns (MDN's `setPointerCapture` guidance, and a W3C
pointer-events thread describing *dropped* pointer events when capture isn't used across fast
drags): the grid container captures the pointer on `pointerdown` via `setPointerCapture`, and
`pointermove` converts client coordinates into a `{row, col}` via the container's bounding rect and
cell size (not `elementFromPoint` or per-cell listeners, which the same research flagged as missing
events when a finger/mouse crosses several cells between two animation frames). Every pointer move
feeds the same `applyCellInteraction` the arrow keys use, so there is exactly one place path-legality
is decided. `touch-action: none` on the grid stops the browser from scrolling the page mid-drag.

### Animation (`motion-framer` skill)
Read for: the signature animation is the path **drawing itself** — each new segment animates in
with a short `scaleX`/`scaleY` grow from the previous cell's center (a `motion.div` per segment,
animated `transform-origin`), and the win state does a brief staggered pulse down the finished path
before the shared `celebrate()` confetti. Reduced-motion: segments render at full size immediately
(no grow-in), honoured via Motion's `useReducedMotion`.

### Design (`ui-ux-pro-max` skill)
Read for: touch target sizing (cells sized well above the 44×44px minimum at 375px — 6×6 fits
comfortably, 8×8 is the tight case so cell size is computed from viewport width), using a real
orange→purple gradient on the drawn path (not color-alone to convey direction — the *head* of the
path also gets a small distinct marker so direction is visible without color vision), and keeping
the checkpoint numbers legible against the gradient (a light halo behind each number).

### Review (`playwright-cli`, `web-design-guidelines`)
Used after the UI was built: screenshots at 375px and 1280px across a few `?date=` values (one of
each grid size), a keyboard-only run (arrow keys + Backspace + Enter-to-open-help), and a pass of the
fetched Web Interface Guidelines against `index.tsx`/`components/`.

## Edge cases (each is a test in `logic.test.ts` / `hamiltonian.test.ts`)
- Starting anywhere other than checkpoint 1 is rejected; starting there is accepted from an empty path.
- Diagonal "adjacency" is never legal.
- Stepping onto a checkpoint out of numeric order is rejected, even though the cell is otherwise a
  legal grid-adjacent, unvisited, non-walled move.
- A wall blocks an otherwise-legal adjacent extension.
- Re-entering an already-drawn cell retracts the path to that cell (drag-back / arrow-key-into-tail),
  rather than erroring or duplicating.
- Undo removes exactly one cell; clear empties the path entirely; both leave `elapsed` untouched.
- **Full coverage that doesn't end on the highest checkpoint is not a win.** This can happen if a
  player fills the grid but wanders past the last checkpoint earlier and finishes elsewhere — only
  checked by combining "all cells visited" with "last cell == final checkpoint", not either alone.
- State round-trips through `JSON.parse(JSON.stringify(...))` byte-identical (path is a plain array
  of `{row, col}`, elapsed a plain number).
- `buildSummary` never contains the solution or the drawn path — only the puzzle number and the
  elapsed time — tested by asserting none of the puzzle's actual cell coordinates or wall data
  appear as substrings of the summary.
- Generator: `countSolutions` is tested against a hand-built tiny grid with a known second solution
  (returns 2, capped) and a hand-built grid with only one valid path (returns 1).
- Generator: every one of the `SCHEDULE_DAYS` generated days is re-checked with `countSolutions` and
  must come back exactly 1 (the generator's own acceptance test, re-run as a Vitest assertion over
  the written content files is too slow for CI, so this is instead asserted while generating and
  reported in `scripts/out/zip-samples.md`; `hamiltonian.test.ts` re-proves uniqueness for a handful
  of freshly-generated boards per size as a regression test).

## Deliberately left out
- **No "lose" state.** The original game has no move limit, lives, or timer-based failure — you
  either haven't finished or you have. `finish()` is only ever called with `won: true`; there is no
  path that calls it with `false`. `AlreadyPlayed`'s `lost` message is simply unreachable for this
  game, which CLAUDE.md's shared-component contract allows (components take `PlayStatus` generically;
  nothing requires every game to produce every status).
- **No pencil marks / notes.** The GMPuzzles comment thread confirms LinkedIn's own app has none
  either; out of scope.
- **No hint system.** LinkedIn's has one; reproducing it (which cell to reveal next, how many hints)
  isn't specified by the task prompt and would need its own design pass, so it's left out. Noted in
  HANDOFF.md as a possible shared/UX follow-up, not a shared-component gap.
- **Reserve puzzle**: not requested by the prompt (`"reserve": null` per CLAUDE.md), so no "seen
  this before? skip" affordance — Zip isn't an archive-sourced game like Connections/Mini.

## Build plan
1. `src/games/zip/logic.ts` + `logic.test.ts` — pure rule engine, edge cases above.
2. `scripts/zip/hamiltonian.ts` + `hamiltonian.test.ts` — path builder and uniqueness solver.
3. `scripts/zip/generate.ts` — walks `LAUNCH_DATE … LAUNCH_DATE+SCHEDULE_DAYS-1`, writes
   `content/puzzles/zip/<date>.json` and `scripts/out/zip-samples.md`.
4. Run the generator, read the samples file critically, tune checkpoint/wall density if puzzles look
   too easy/hard/samey.
5. `meta.ts`, `theme.css` (light grid, orange→purple gradient path, Nunito).
6. `components/Grid.tsx` (rendering + pointer drag), `index.tsx` (contract wiring, timer, arrow keys,
   undo/clear, HelpModal/ResultModal).
7. Screenshots, keyboard pass, `web-design-guidelines` review, HANDOFF.md.
