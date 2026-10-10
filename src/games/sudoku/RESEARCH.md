# Sudoku & Mini Sudoku — RESEARCH

One agent, two games (`sudoku` 9×9/3×3 boxes, `mini-sudoku` 6×6/2×3 boxes). They share a generation
engine (`scripts/sudoku/core.ts`, `scripts/sudoku/grading.ts`) and a board engine + UI
(`src/games/sudoku/shared/`), per CLAUDE.md's explicit allowance for this agent.

## 1. Official rules

- A 9×9 grid split into nine 3×3 boxes. Every row, column and box must contain each digit 1–9
  exactly once. The grid starts partially filled; a well-posed puzzle has exactly one solution
  reachable by logic alone.
- Mini Sudoku (6×6) is the same rule scaled down with 1–6 and six **2×3 boxes** (2 rows tall, 3
  columns wide — 3 box-rows × 2 box-columns), confirmed across several rule pages, e.g. the
  LinkedIn Mini Sudoku write-ups and 6×6-specific solver pages.

Sources:
- [Sudoku Rules](https://sudoku9x9.com/rules) — row/column/box constraint statement.
- [Free 6x6 Sudoku](https://logic-puzzles-online-vas3p.kinsta.page/mini-sudoku/) and
  [LinkedIn Mini Sudoku Hints](https://www.thewordfinder.com/linkedin-games-hub/mini-sudoku-hints/) —
  2×3 box orientation, unique-solution-by-logic claim.

## 2–3. Prior art: generators, solvers, difficulty, comparison

| Project | Approach | Strengths | Weaknesses / bugs | Licence |
|---|---|---|---|---|
| **tdons/dlx** (`sudgen`/`sudslv`) | Dancing Links (Algorithm X / exact cover) generator + solver. Generates puzzles that are unique **and minimal** (no given can be removed without breaking uniqueness). | Very fast exact-cover search; minimality guarantee is a nice property for "hard" puzzles. | Minimality isn't something we need (we target a clue-count *range* per difficulty, not minimal puzzles); DLX is a meaningfully bigger piece of machinery to implement correctly than backtracking for a grid this small. | Reviewed for approach only; no code copied. |
| **Leptonica `sudoku.c`** (`sudokuTestUniqueness`, `sudokuGenerate`) | Backtracking solver; **uniqueness via a rotation heuristic** (solve the puzzle and its 180°-rotated form, compare results) rather than an exhaustive count. | Simple, fast. | The rotation check is explicitly a heuristic in its own comments, not a proof — it can accept non-unique puzzles. We rejected this approach for exactly that reason. | Apache-2.0; reviewed only, no code copied. |
| **robatron/sudoku.js and its npm forks** (`sudoku.utils`, `sudoku-umd`) | Backtracking generator; "difficulty" = raw **given-count** bands (easy 62, …, insane 17 givens), no technique grading. | Simple, widely cloned, proves clue-count alone is a workable *first* difficulty signal. | Clue-count alone is a weak difficulty proxy — a puzzle can have few givens but still be solvable with singles only, or vice versa. We use clue-count as a *starting budget* for digging holes, then re-grade by technique, rather than trusting it alone. | Licence unconfirmed from search; reviewed for approach only, no code copied. |
| **dokusan** (PyPI) + academic write-ups (Pelánek, *Difficulty Rating of Sudoku Puzzles: An Overview and Evaluation*) | **Technique-based** rating: puzzles solvable by naked/hidden singles alone are the easiest band; naked/hidden pairs, pointing pairs and locked candidates mark the next band; anything needing more (or backtracking/guessing) is hardest. Pelánek's model (0.95 correlation with human solve time) confirms technique *mix*, not just count, drives perceived difficulty. | Matches how people actually experience difficulty; "simple Sudoku" (singles-only) is a well-established term for the easy band. | Full academic models (step dependency graphs, etc.) are overkill for 3 difficulty bands on a birthday site. | dokusan: MIT (PyPI listing); Pelánek paper: read for the technique-tier idea only, no code. |

**Chosen approach** — backtracking, not dancing links:
- Puzzles are only 9×9 / 6×6. A backtracking solver with a **minimum-remaining-values (MRV)**
  heuristic (always branch on the empty cell with the fewest legal candidates) solves/counts
  solutions for grids this size in well under a millisecond in the overwhelming majority of cases,
  and generation is an **offline build step**, not a runtime path. DLX's performance edge matters at
  much larger scale (deep solution mining, 17-clue search) than "generate 365 days of puzzles in a
  script." Implementing DLX correctly is also a real source of bugs for comparatively little upside
  here, so MRV-backtracking was the pragmatic choice.
- **Uniqueness**: unlike Leptonica's rotation heuristic, `countSolutions(grid, limit)` does an actual
  exhaustive MRV-backtracking count, stopping as soon as it finds a 2nd solution. "Dig holes" (start
  from a full solved grid, remove cells in a seeded-random order, keep a removal only if the puzzle
  is still uniquely solvable) re-runs this exact check after every removal — slower than the
  alternate-value trick some generators use, but simpler to reason about and fast enough for 36–81
  cells.
- **Difficulty**: clue-count range picks a *target* per tier (informed by the sudoku.js bands, scaled
  down for mini); a technique-based grader (`grading.ts`) then re-derives the *real* tier from which
  techniques are actually needed to finish the puzzle (naked singles → hidden singles → locked
  candidates (pointing pairs / box-line reduction) → naked/hidden pairs → naked triples → anything
  left needs backtracking/guessing). If the graded tier doesn't match the target, the generator keeps
  digging (fewer clues) or retries with the next seeded attempt — see `generate.ts`.

## Mobile input UX: cell-first vs. number-first, notes mode

- [Sommervold, *A Comparative Study of Three Sudoku Input Methods for Touch Displays*](https://oda.oslomet.no/oda-xmlui/handle/10642/9608)
  (Oslo Metropolitan University, 2020, N=18): participants were both **faster and happier** selecting
  the **cell first, then the digit**, versus digit-first or other orders tested.
- Commercial apps that support both usually default to cell-first and offer digit-first as an
  advanced setting; notes/pencil-marks are consistently a **separate toggle/mode**, not a
  always-on third input channel.

**Chosen approach**: cell-first only (no number-first mode — the prompt doesn't ask for it, and
research shows it's a secondary option, not the default). Tap/click a cell to select it (or move
selection with arrow keys), then either tap a digit on the on-screen pad or type it on a physical
keyboard — both write to the same selected cell, so desktop and phone share one mental model. A
"Notes" toggle switches whether digit input writes a final entry or toggles a pencil-mark; it's a
plain on/off button + the `N` key, not a mode you have to hold.

## Chosen design (deviations explained)

- **Shared engine, not shared difficulty table.** `scripts/sudoku/core.ts` (grid ops, MRV solver,
  hole-digging) and `grading.ts` (technique grader) take a `BoardConfig {size, boxH, boxW}` and work
  for both 9×9 and 6×6. `src/games/sudoku/shared/engine.ts` does the same for in-game board state
  (set/erase/note/conflict/highlight). Both games' own `logic.ts` stay tiny: they fix the config,
  define their own `Puzzle`/`State` types (per the contract — each game owns its types even when
  the shapes are structurally close), and add `buildSummary`.
- **`defaultState` is a function of the puzzle, not a constant.** The contract's `DEFAULT_STATE`
  pattern assumes a fixed shape; here the grid dimensions depend on which puzzle loaded (9×9 vs 6×6,
  and the given clues themselves). `defaultState(puzzle)` returns `{ entries: clone(puzzle.puzzle),
  notes: emptyNotes(size), elapsed: 0 }`, and `{ ...defaultState(puzzle), ...play?.state }` is used at
  the same call site the `{}` gotcha warns about — same guarantee, just parameterized.
- **No lose state.** Sudoku isn't timed-out or mistake-limited in the brief ("win detection" is listed,
  "lose" is not). A play stays `in_progress` until `entries` fully match `solution`, then `finish({won:
  true, ...})`. This matches how the physical/paper game and most clones behave — you can always keep
  going until it's right. "Optional mistake check" is a view-only highlight (conflicting cells in
  red), not a fail condition.
- **`score` = elapsed seconds.** Not required by the prompt but accepted by `ResultModalProps`/
  `FriendsBoard`; lets "solved in 3:42" show up in the friends board instead of just ✅/❌.
- **Undo is in-memory, not persisted.** `state` is exactly `{ entries, notes, elapsed }` per the
  prompt — a history stack doesn't belong in that shape. Undo only reaches back to the last reload.
  Documented as a known limitation in HANDOFF.md.
- **Notes rendering is generic.** A cell's pencil marks render in a `ceil(sqrt(size))`-column mini
  grid — exactly 3 columns for both 9×9 (1–9) and 6×6 (1–6), so one component serves both games.

## Edge cases (each becomes a test)

- `countSolutions` correctly reports 1 for a uniquely-solvable grid and >1 for an under-constrained
  one (e.g. an empty 6×6 grid), for both configs.
- `digHoles` output always has exactly one solution (verified for every generated day, both games).
- `gradeDifficulty`: a singles-only puzzle grades "easy"; one needing locked candidates/pairs grades
  "medium"; one needing backtracking grades "hard".
- Given cells can never be edited, noted, or erased.
- Setting an entry clears any notes in that cell; noting a filled cell is a no-op.
- `findConflicts` flags a repeated digit in a row, column and box, and clears once resolved.
- A cell fully matching `solution` for every cell (and only then) is a win; partially-full boards are
  never a win.
- State round-trips through `JSON.parse(JSON.stringify(...))` to an identical game (entries + notes +
  elapsed).
- `buildSummary` never embeds the puzzle or solution grid (it only takes puzzle number, difficulty,
  elapsed seconds — no grid data is ever in scope to leak).
- Weekday → difficulty mapping matches the table in CLAUDE.md/prompt exactly, both games.
- Every generated day file (both games, full `SCHEDULE_DAYS` schedule) has a unique solution and a
  difficulty tag; the generator throws rather than writing an invalid day.

## Deliberately left out

- **Dancing Links.** See "Chosen approach" above — not worth the implementation risk at this scale.
- **Number-first input mode.** Research favors cell-first as the default; not adding a second mode
  keeps the UI simpler and avoids a setting nobody asked for.
- **Mistake limits / lives.** Not in the brief; sudoku has no natural "lose".
- **Advanced techniques (X-wing, swordfish, chains) in the grader.** Singles → locked
  candidates/pairs → "needs backtracking" is enough to split 3 (sudoku) or 2 (mini) bands; finer
  technique bands would only matter if we needed more than 3 tiers.
- **Persisted undo history.** See "Chosen design" above.

## Skills used

- `motion-framer`: cell-select pulse, number-pad press feedback, a cell "flip/pop" when a value is
  placed, a board-wide shimmer on win — all gated behind `useReducedMotion`.
- `ui-ux-pro-max`: touch-target sizing (≥44×44px number pad buttons, ≥8px gaps — confirmed via the
  skill's own `ux` search for "number grid puzzle game accessible touch targets"), semantic color
  tokens instead of raw hex, no icon-only controls without `aria-label`.
- `playwright-cli` / `pnpm shot`: 375px and 1280px screenshots of both games, keyboard-only pass
  (Tab to the board, arrow keys to move, digits to fill, `N` for notes, Backspace to erase).
- `web-design-guidelines`: final self-review pass against the fetched Web Interface Guidelines before
  calling the games done.

## Build plan

1. `scripts/sudoku/core.ts` — grid ops, MRV backtracking solver/filler, `countSolutions`, `digHoles`,
   seeded per-day RNG. `scripts/sudoku/grading.ts` — technique-based difficulty grader.
2. `scripts/sudoku/core.test.ts` + `grading.test.ts` — the generation edge cases above, parameterized
   over both configs.
3. `scripts/sudoku/generate.ts` (seed 11) and `scripts/mini-sudoku/generate.ts` (seed 12, imports the
   shared core) — write `content/puzzles/<id>/<date>.json` for the full schedule + samples files.
4. `src/games/sudoku/shared/engine.ts` (+ `.test.ts`) — board-state pure functions shared by both
   games.
5. `src/games/sudoku/shared/components/{Board,NumberPad}.tsx` — shared UI.
6. `src/games/sudoku/{logic.ts,logic.test.ts,index.tsx,theme.css}` and the same for `mini-sudoku`,
   wired to the contract.
7. Screenshots, HANDOFF.md, scope check.
