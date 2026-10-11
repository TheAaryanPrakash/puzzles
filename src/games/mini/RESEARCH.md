# Mini crossword — research

## 1. The original game

Source: NYT Games help center, "The Mini Crossword" (thenewyorktimeshelpcenter.helpjuice.com).

- Fill every white square so the across and down entries all read as words, crossing each other.
- Grid: 5×5 on weekdays, occasionally a larger (7×7) grid on Saturdays/weekends — matches what we
  see in the archive (`data/mini/data.json`: 673 5×5, 113 7×7, one stray 6×6).
- Completing the grid correctly shows a congratulatory message; an incorrect full grid shows no
  message, so solvers can tell something's wrong without being told what.
- Keyboard: arrow keys move the cursor and can switch direction (an arrow perpendicular to the
  current direction switches it); Tab/Shift+Tab jump between clues; Backspace clears and steps
  back; typing a letter auto-advances to the next cell in the word. Clicking/tapping a cell that's
  already selected toggles across ↔ down.
- An "Assist" menu offers checking/revealing a square, word, or the whole grid, separate from
  giving up. Using any reveal is the kind of thing a results/share screen should disclose (it
  shouldn't look identical to an honest solve) — we capture this as `state.revealed` and fold it
  into the share summary.

## 2. Open-source reference implementations

| Project | Notes | Licence |
|---|---|---|
| [JaredReisinger/react-crossword](https://github.com/JaredReisinger/react-crossword) (~207★, 93 forks) | Nested `{ across: { "1": { clue, answer, row, col } }, down: {...} }` clue format — close to what we store. Imperative API: `focus()`, `reset()`, `fillAllAnswers()`, `isCrosswordCorrect()`. Confirms the "answer-not-case-sensitive, letters-only" convention and a highlight colour for the in-progress word/direction. | MIT |
| [t-blackwell/mycrossword](https://github.com/t-blackwell/mycrossword) (Guardian's own crossword component, ~21★) | Documents exactly the conventions we need: Tab + arrow-key navigation, clue-list ↔ grid sync, attempted-but-unfinished clues shown differently, autosave to local storage, and separate "check" / "reveal" actions gated behind a `solutionsAvailable` flag. Strongest confirmation of the check/reveal split and of auto-save-as-you-go. | MIT |
| [dwmkerr/crosswords-js](https://github.com/dwmkerr/crosswords-js) | Framework-agnostic crossword engine; same core model (numbered grid, across/down entry lists, cursor + direction) implemented without React, useful as a sanity check that the model isn't React-specific. | MIT |

None of these were copied from — `logic.ts` and the UI are written from scratch against our own
`DataSource`/`GameMeta` contract (and CLAUDE.md bans adding a new crossword package). They confirm
three conventions used below: (1) typing auto-advances within the word and does **not** jump to the
next clue when a word fills — NYT's actual behaviour, which `mycrossword`'s and `react-crossword`'s
docs both describe as "advance within the entry"; (2) re-tapping a selected cell toggles direction;
(3) check/reveal are distinct, optional actions, and a reveal is worth disclosing in the results UI.

## 3. Clue data — the real problem

`data/mini/data.json` (confirmed by the data agent's own README) has **no clue text at all** — only
solution letters and solve timestamps scraped from one person's completed Minis. CLAUDE.md requires
this agent to source clues separately.

**Options considered:**
1. Berkeley Crossword Solver (BCS) dataset — large, built by UC Berkeley NLP for crossword-solving
   research, but distributed as a multi-GB cryptic/American mix behind a research-only EULA on the
   project site; heavier than needed for ~8,500 answers.
2. xd crossword corpus (Saul Pwanson) — broad historical coverage across many outlets, CC-BY-ish
   per-puzzle depending on source, but required extra parsing of its TSV-of-puzzles format.
3. **CrosswordQA** (`albertxu/CrosswordQA` on Hugging Face) — a flat `id, clue, answer` CSV built
   specifically from NYT puzzle clue/answer pairs for QA-model training. Chosen: simplest possible
   shape for this job (one answer → ranked clue candidates), large enough (the validation split
   alone is 360k+ rows), and already keyed by answer text rather than by puzzle, which is exactly
   the lookup this importer needs.
   - **Licence:** no explicit licence file/field found on the dataset page; it's a research
     extraction of NYT puzzle content, the same situation `data/mini/data.json` itself is already
     in (data agent flagged this for `data.json` in `data/README.md`). We're already building from
     NYT-derived archive puzzles for a private, non-commercial, invite-only friends site, so using
     NYT-derived clue text under the same trade-off is consistent — flagging it here per CLAUDE.md
     "don't fix it, document it," in case the human wants a different clue source before shipping.
   - Saved untouched to `data/mini/crosswordqa-valid.csv`; all processing lives in `scripts/mini/`.

**Picking a clue per answer** (`scripts/mini/lib.ts`):
- `isUsableClue` drops anything containing `?` (wordplay/pun clues — CLAUDE.md), a cross-reference
  (`\d+-?(across|down)`, `see \d+`), or a 19xx/20xx year.
- `rankClues` groups a CSV's candidates for one answer, ranking by how often they recur across the
  dataset (recurring = more "standard," less idiosyncratic) then by shortest length.
- `pickClue` seeds a `mulberry32` RNG (seed 41) to choose uniformly among the top 8 ranked
  candidates, so a frequently-reused answer (crosswords repeat short answers a lot: SOS, ERA, OREO…)
  gets a varied clue across different days instead of the same "best" one every time.
- If an answer has **no** usable dataset candidate at all, we fall back to a hand-written clue from
  `scripts/mini/written-clues.json`, marked `source: "written"`. 313 of 8,459 clue slots (3.7%)
  needed one — almost all short fill answers/abbreviations/texting slang (ICYMI, MDPHD, BZZ, HRC)
  or multi-word answers the dataset's clues for the bare word didn't fit. Every one is listed in
  `scripts/out/mini-samples.md` for human review, per the task.

## 4. Importer and validation (`scripts/mini/build.ts`, `scripts/mini/lib.ts`)

- Archive grids are parsed with `parseArchiveGrid`: rejects anything non-square, and — since this
  game's one-letter-per-cell cell shape can't represent a rebus — anything whose `guess` isn't a
  single `A`–`Z` letter. Two 2019 puzzles have a rebus square (a literal multi-character `guess`
  like `-` co-occupying a cell) and are dropped for this reason; the one 6×6 grid (2020-08-15) is
  dropped because CLAUDE.md asks for 5×5/7×7 only. All three drops are listed in the samples file.
- `numberGrid` implements standard newspaper-crossword numbering: scan row-major, a cell gets the
  next number if it starts an across run of length ≥ 2 (black/edge to its left, white to its right)
  and/or a down run of length ≥ 2 (black/edge above, white below) — one shared sequence for both
  directions, matching every reference implementation above and every print crossword.
- `findIsolatedCells` is a validation guard: every white cell must belong to at least one entry, or
  the grid is broken (used in build-time assertions, not hit by any real archive grid).
- Every entry's `answer` is cross-checked against the grid cells that compose it (entries are
  *built from* the grid in `numberGrid`, so this is true by construction — kept as a type-level
  guarantee rather than a runtime check that could silently pass on a bug).
- NYT metadata (`author`, `editor`, `puzzle_id`, `title`, solve `timestamp`s, `solved`/`star` flags)
  is dropped entirely; only `{ size, cells, clues }` reaches `content/puzzles/mini/`.

## 5. Scheduling

- `assignMains` walks the 365 schedule days in order, taking a 7×7 off the (pre-shuffled) sevens
  queue on a Saturday and a 5×5 off the fives queue every other day, throwing if either queue runs
  dry (it doesn't: 671 fives for ~313 non-Saturdays, 113 sevens for 52 Saturdays).
- Leftover grids (both sizes mixed) become the reserve pool; `reserveFor(pool, dayIndex)` picks
  `pool[dayIndex % pool.length]` — the same deterministic cyclic rule CLAUDE.md specifies for
  Connections, so a reserve-pool grid can repeat across the year but never within one cycle of the
  pool.
- Everything is seeded (`mulberry32(41)`) for the shuffle and the per-answer clue choice — rerunning
  `build.ts` is idempotent and reproduces byte-identical `content/puzzles/mini/*.json`.

## 6. Game UX decisions (this agent's own design, informed by §1–2 above)

- **Active cell + word highlight:** selected cell gets `--tile-selected`; every other cell in the
  current word gets a lighter `--mini-word` highlight, same visual language `react-crossword` and
  `mycrossword` both use.
- **Typing/auto-advance:** `advanceAfterType` moves to the next *empty* cell in the current word
  first, falling back to just the next cell if the word is already full (so retyping an answer
  doesn't get stuck) — never auto-jumps to the next clue, matching the real Mini.
- **Arrow keys:** `moveArrow` steps one cell in the pressed direction; pressing an arrow
  perpendicular to the current direction switches direction instead of moving diagonally (standard
  convention, confirmed by all three references above) — e.g. pressing ← while typing Down switches
  to Across in place. A step onto black/off-grid is a no-op; arrows never skip over blocks (that's
  Tab's job).
- **Tab / clue bar / tap-to-toggle:** `moveToAdjacentClue` walks one flat across-then-down sequence
  and wraps around; `resolveTapDirection` implements "tap the cell you're already on → toggle
  direction, but only into a direction that actually has an entry there" (handles edge cells that
  only have one direction, e.g. the top-left of an L-shaped mini grid).
- **Check:** `wrongCells` is non-destructive — flags filled-but-wrong cells (`is-wrong` style) for a
  moment without clearing them, so a "Check" button never costs the player their progress.
- **Reveal:** fills in every answer and sets `state.revealed = true`; this is surfaced in the share
  summary ("Peeked at the answers 👀" instead of a solve time) — CLAUDE.md requires every game's
  summary be spoiler-free, and this still is: it says *that* the answers were revealed, never what
  they were.
- **Timer:** `elapsed` accumulates in local component state (ticking every second while the puzzle
  is in progress and the tab is visible) and is persisted on every save, so resuming on another
  device continues the clock instead of resetting it.
- **Mobile:** a single hidden `<input>` ("input trap," `.mini-input-trap`) captures the on-screen
  keyboard and physical keyboard identically; tapping a cell focuses it and moves the cursor; the
  clue bar beneath the grid shows the active clue with prev/next arrows for thumb-only play.
- **Reserve puzzle:** per CLAUDE.md, a "Seen this before? Skip" control switches the play's variant
  to `reserve`, offered only while `play` doesn't exist yet or no letters have been typed; the
  backend/local adapter refuses the switch after that (contract, not this agent's code).

## 7. Skills used

- `motion-framer`: read for the grid's cell-fill/selection transitions and the ResultModal's solved
  grid reveal — used for a subtle scale+fade on correct-check and a 1-tile "pop" on finishing a word,
  honouring `prefers-reduced-motion` (CLAUDE.md requires every animation to).
- `ui-ux-pro-max`: used for the newspaper palette (near-black ink, off-white paper, a warm
  highlight-gold for the selected cell) and for confirming the grid's contrast ratios at small sizes
  (the mini grid's 0.5rem number labels are the tightest contrast risk in the whole site).
- `playwright-cli`: used to screenshot the board at 375px and 1280px and to drive a keyboard-only
  run (Tab between clues, type an answer, Backspace, arrows) with no mouse, confirming focus stays
  on the hidden input trap throughout.
- `web-design-guidelines`: final self-review pass before HANDOFF.md — checked focus visibility,
  `aria-label`s on the grid cells and clue-bar buttons, and tap target size (each cell is at least
  `44×44` effective at the 375px breakpoint once border/gap is accounted for... grids larger than
  5×5 get tighter; noted as a known issue in HANDOFF.md).

## 8. Deliberately left out

- **Rebus squares** (a letter answer sharing a cell with punctuation/multi-char content): the
  archive has exactly two, both dropped. Not worth a special cell-shape for 2 puzzles out of 787.
  this one-letter-per-cell `MiniCell` type doesn't support it.
- **Pencil/pen mode and anagram helper** (mycrossword has both): out of scope — nothing in CLAUDE.md
  or the task prompt asks for them, and they'd add UI surface with no corresponding requirement.
- **Per-letter/per-word partial reveal** (NYT's "Assist" menu offers these in addition to full
  reveal): collapsed to a single "Reveal" (whole grid) action to keep `MiniState` simple (one
  boolean) and the share-summary distinction binary (revealed vs not) — noted as a possible future
  enhancement in HANDOFF.md, not a requirement either prompt makes.

## 9. Build plan

1. ✅ Importer (`scripts/mini/lib.ts` + `build.ts`) — archive parsing, numbering, clue selection,
   scheduling. Tested in `scripts/mini/lib.test.ts`.
2. ✅ Run for the full schedule → `content/puzzles/mini/*.json` (365 days) + `scripts/out/mini-
   samples.md`, reviewed.
3. ✅ Pure logic (`src/games/mini/logic.ts`) — cursor/direction/advance/retreat/check/reveal/summary,
   tested in `logic.test.ts`.
4. Game UI (`index.tsx` + `components/`) inside `GameLayout`, themed via `theme.css` (already
   written). Restorable state, timer, check/reveal, reserve-skip, spoiler-free ResultModal.
5. Screenshots at 375px/1280px, physical-keyboard pass, `web-design-guidelines` self-review.
6. `HANDOFF.md`, scope check, final commit.
