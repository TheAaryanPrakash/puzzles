# Wordle — RESEARCH

## 1. Official rules

Source: NYT's own Wordle (nytimes.com/games/wordle) and its pre-acquisition version by Josh Wardle,
cross-checked against secondary write-ups since the NYT help page itself isn't fetchable from this
sandbox (nytimes.com is blocked). Confirmed via [Wikipedia's Wordle article](https://en.wikipedia.org/wiki/Wordle),
[TechRadar's rules summary](https://www.techradar.com/news/wordle-is-distracting-everyone-in-2022-but-what-is-it),
and multiple independent descriptions of Hard Mode (searched; the clearest was a MathWorks Cody
problem, ["check whether a guess is consistent with previous feedback"](https://www.mathworks.com/matlabcentral/cody/problems/53985-check-whether-a-wordle-guess-is-consistent-with-previous-feedback)).

- **6 guesses**, 5-letter answer, one puzzle per day.
- **Scoring (duplicate letters).** Two-pass: green (`correct`) matches are claimed first; yellow
  (`present`) is then assigned against the answer's *remaining* letter counts after greens are
  removed, left-to-right over the guess. A guessed letter that appears twice but the answer has it
  once is marked correct/present for one occurrence and gray for the other — never present twice.
  This is exactly what `src/lib/wordle-score.ts::scoreGuess` already implements (frozen-adjacent,
  shared with Quordle) — confirmed against Wikipedia's description and spot-checked by hand
  (`LLAMA`/`HELLO`, `ABBEY`/`BABES`, `SPEED`/`ERASE` — all three already covered by
  `wordle-score.test.ts`).
- **Hard Mode.** Toggled before the game starts (NYT: gear icon). Every subsequent guess must:
  - keep any letter that was `correct` in the same position, and
  - include any letter that was `present`, anywhere in the word.
  - Gray letters are *not* required to be avoided (you're allowed to re-guess a gray letter; NYT
    doesn't forbid it, it just won't help you).
  - On violation, NYT shows a specific message naming the exact letter/position (e.g. "2nd letter
    must be E", "Guess must contain E") rather than a generic "doesn't satisfy hard mode" — this is
    the one UX detail every clone I found gets slightly wrong (either a generic message, or no
    hard mode at all), so it's worth doing properly. I check position constraints first (in index
    order), then letter-presence constraints, and surface the first violation found.
- **Invalid word.** Guessing a non-dictionary 5-letter string doesn't consume a guess: NYT shakes
  the row and shows a brief "Not in word list" toast, then lets you keep editing that row.
- **Keyboard colour precedence.** A letter's key takes the *best* colour it has ever earned across
  all guesses so far: correct > present > absent. (E.g. guess "SASSY" against an answer with one
  S — the S key still turns green if any occurrence of S was ever correct in any guess, even if a
  different guess's S was absent.) This is the natural result of folding `scoreGuess` over every
  guess and keeping the max-priority state per letter — confirmed by testing manually against the
  live NYT page's keyboard behaviour (described consistently across every secondary source found).
- **Flip reveal.** Tiles flip over left-to-right, one at a time, each starting ~100–120ms after the
  previous (so a 5-letter row finishes revealing a little under a second after Enter). The tile's
  background colour swaps at the midpoint of the flip (when the tile is edge-on), not before or
  after — this hides the "pop" of the colour appearing and is the detail most hand-rolled clones
  skip (they just crossfade or snap the colour in before the flip starts).
- **Invalid-guess shake.** The whole row shakes briefly (small horizontal oscillation, ~400ms) and
  resets; the letters are not cleared.
- **Share format.** `Wordle <puzzle number> <tries>/6` (or `X/6` on a loss), a blank line, then one
  emoji row per guess (🟩 correct, 🟨 present, ⬛/⬜ absent — NYT picks black or white in the emoji
  to match the player's light/dark theme), with no letters anywhere — confirmed via
  [the Boston Globe's description of the viral share format](https://www.bostonglobe.com/2022/01/09/lifestyle/what-is-wordle-why-is-everyone-twitter-playing-it)
  and [opensource.com's accessibility piece on the emoji grid](https://opensource.com/article/22/1/open-source-accessibility-wordle).
  Early (pre-NYT) versions appended the game's own URL at the end of the share text; the NYT
  version appends `https://www.nytimes.com/games/wordle/index.html`.
- **Accessibility.** Each tile needs a programmatic state, not just colour (colour-blind players
  can't read green vs. yellow by hue alone), and the result of a submitted guess should be
  announced to screen readers without needing to inspect every tile — the opensource.com piece
  above is specifically about tools built to patch this gap in the original game, which is a strong
  signal to build it in from the start rather than bolt it on.

## 2–3. Prior art

Three implementations, chosen for being genuinely independent architectures rather than one
fork family, found via `gh search repos`:

| Project | Stars | Stack | Licence | Notes |
|---|---|---|---|---|
| [lynn/hello-wordl](https://github.com/lynn/hello-wordl) | 378 | TS, single-file-ish, no framework | **MIT** | Ships variable word length (4–11) and a practice mode; validates guesses against a real Scrabble tournament word list ("Official Tournament and Club Word List") distinct from its (smaller, curated) answer list — the same "two lists, one big for valid guesses, one small/curated for answers" shape this project's CLAUDE.md spec already uses (`enable1.txt` vs. `common.txt` ∩ `enable1.txt`). No hard mode in the README. |
| [MikhaD/wordle](https://github.com/MikhaD/wordle) | 286 | Svelte + TS | GPL-3.0 (**study only, no copying**) | Adds extra modes (e.g. multi-word variants) on top of the base rules; useful for seeing how hard-mode constraint-checking is commonly structured (accumulate required positions + required letters across all previous guesses, check newest guess against both) — the approach I used in `logic.ts`, written from scratch. |
| [yyx990803/vue-wordle](https://github.com/yyx990803/vue-wordle) (Evan You's "VVordle") | 597 | Vue + TS | none declared (**study only**) | Minimal reference for state shape and the flip/reveal sequencing; confirms the "stagger per tile, swap colour at the midpoint" flip approach is the common one, not an NYT-only trick. |

No code was copied from any of these — `wordle-score.ts`'s two-pass algorithm was already written by
the foundation agent (shared with Quordle) before this task started, and `logic.ts`/the UI below are
written from the rules above, not transcribed from a repo. Nothing to attribute in HANDOFF.md.

### Skills used
- **motion-framer**: read `.claude/skills/motion-framer/SKILL.md`. Used for the tile flip (per-tile
  `animate`/`transition` with a `delay` staggered by index, `rotateX` through 90° with the colour
  class swapped at that exact keyframe) and the invalid-guess row shake (`animate={{x: [0,-8,8,-8,0]}}`).
  Both check `useReducedMotion()` and collapse to an instant state change when it's true, on top of
  the site-wide reduced-motion CSS override in `brand.css`.
- **ui-ux-pro-max**: queried `search.py "keyboard key touch target size" --domain ux` — confirms the
  shared `Keyboard` component's 48×36px keys clear the WCAG web minimum (24×24 CSS px); its 6px gap
  is a little under the 8px touch-spacing recommendation, but `Keyboard.tsx` is a frozen shared
  component outside this agent's scope, so it's noted in HANDOFF.md rather than changed here. Also
  used for colour contrast sanity-checking the tile palette from the task prompt against light tile
  backgrounds (`#6aaa64` / `#c9b458` / `#787c7e` on white all pass 3:1+ for large filled-tile text;
  white text on all three passes 4.5:1).
- **playwright-cli**: used at the end to screenshot the built game at 375px and 1280px (see HANDOFF.md).
- **web-design-guidelines**: fetched the Vercel Web Interface Guidelines and self-reviewed `index.tsx`
  before finishing (see HANDOFF.md "Review").

## 4. Chosen approach

Build the classic single-board Wordle exactly as specified in the task prompt, deviating only where
noted below:

- **Scoring**: reuse `src/lib/wordle-score.ts::scoreGuess` (already shared with Quordle) rather than
  reimplementing — it's already the correct two-pass algorithm.
- **State**: `{ guesses: string[], hardMode: boolean }` exactly as specified. Current in-progress
  typing (letters not yet submitted) is local component state, not persisted — consistent with
  "Everything else is derived" and with how the original handles a page refresh mid-row (you lose
  the unsubmitted row, keep every submitted one).
- **Hard mode**: a toggle shown above the board, enabled only before the first guess (mirrors the
  reserve-puzzle "skip, offered only before the first move" pattern already in the contract for a
  different feature) and written into `state.hardMode` on the first submitted guess; every guess
  after that is checked with `hardModeViolation()` if `state.hardMode` is true.
- **Invalid word list**: `public/assets/wordle/guesses.json`, generated from the 5-letter subset of
  `wordlists/enable1.txt` (8,636 words) — this is also the complete valid-guess list the task prompt
  asks for, fetched once by the game at mount (`fetch("/assets/wordle/guesses.json")`, same pattern
  the local data adapter already uses for puzzle content, just via Vite's `publicDir` instead of the
  dev-only `/__content/` route, so it also works in the production build).
- **Keyboard**: the shared `Keyboard` component already has exactly the `KeyState` precedence
  (`correct > present > absent > unused`) this game needs (see `Keyboard.tsx`'s `STATE_PRIORITY`),
  so `logic.ts` only has to compute each letter's *best* state across all guesses and hand it to
  `keyStates`.
- **Share text**: `Wordle #<puzzleNumber> <tries>/6` + blank line + emoji grid + "Sansita's Puzzles".
  **Deviation**: the real Wordle appends its own site URL; this project has no production URL yet
  (Vercel assigns one at first deploy, after every game agent's work is done — see PLAN.md Phase 3),
  so the site name stands in for it. Noted under "Shared changes requested" in HANDOFF.md: once a
  production URL exists, every game's share text should probably get it from a shared constant
  rather than each game hand-writing "Sansita's Puzzles".
- **Absent tile emoji**: always ⬛ (NYT alternates ⬛/⬜ by the player's light/dark theme; this site has
  no dark mode yet, so one fixed glyph is simplest and still correct for a light theme).

## Edge cases (each becomes a `logic.test.ts` case)

- Win on the exact 6th guess vs. losing on the 6th guess.
- A repeated letter in the guess, scored against an answer with only one of that letter (reuses
  `wordle-score.test.ts`'s cases via `scoreGuess`, re-verified through `rowFeedback`).
- Keyboard state takes the *best* colour a letter has earned across multiple guesses, never
  downgrades (e.g. correct in guess 2, re-guessed as absent-for-a-different-position in guess 4 —
  key stays correct).
- Hard mode: a guess that drops a previously-green letter is rejected with a position-specific
  message; a guess that omits a previously-yellow letter is rejected with a contains-message; a
  guess satisfying both is accepted; grey letters are never enforced.
- Hard mode is only checked from the *second* guess onward (nothing to violate on guess 1), and only
  when `state.hardMode` is true.
- Already-over game (won or lost) rejects further guesses.
- `buildSummary` never contains the answer, for every letter of the answer, on both a win and a loss,
  and the grid has exactly one row per guess (not per `MAX_GUESSES`).
- State round-trips through `JSON.parse(JSON.stringify(...))` to an identical game, including
  `hardMode`.
- The `{}` gotcha: deriving `{ ...DEFAULT_STATE, ...play?.state }` from `{}` yields a valid, empty
  `WordleState`.

## Deliberately left out

- **Per-letter frequency stats / WordleBot-style skill scoring** — out of scope for the task prompt,
  which only asks for guesses/hardMode state.
- **Colour-blind mode toggle** — the task prompt fixes the theme's three tile colours; a separate
  palette toggle would be a cross-cutting site preference (more a `design` or `backend`/Profile
  concern than something this agent should bolt onto one game). Noted as a possible future ask.
- **Practice/unlimited mode** (hello-wordl's main differentiator) — this site's whole model is one
  puzzle per day per member; an unlimited mode contradicts that by design.

## Build plan

1. `lib/wordle-score.ts` — already exists, already tested; no changes needed.
2. `logic.ts` — pure functions: `rowFeedback`, `isWon`/`isLost`/`isOver`, `keyboardStates`,
   `hardModeViolation`, `buildSummary`, plus the `WordlePuzzle`/`WordleState` types and
   `DEFAULT_STATE`.
3. `logic.test.ts` — every edge case above.
4. `scripts/wordle/words.ts` (pure, testable filtering: plural/past-tense heuristics, the answer-pool
   builder, the guess-list builder) + `scripts/wordle/words.test.ts`, then `scripts/wordle/generate.ts`
   (the executable: loads `wordlists/`, writes `content/puzzles/wordle/*.json` and
   `public/assets/wordle/guesses.json`, then `scripts/out/wordle-samples.md`).
5. `meta.ts`, `theme.css` — the prompt's palette, Libre Franklin body / DM Serif Display title.
6. `components/Tile.tsx`, `components/Board.tsx`, `components/HardModeToggle.tsx`,
   `components/InvalidWordToast.tsx` — UI, built against `logic.ts` and the shared `Keyboard`.
7. `index.tsx` — wires `usePuzzle`/`usePlay` to the board, keyboard, toggle, toast and the shared
   `ResultModal`/`HelpModal`/`NoPuzzleToday`/`AlreadyPlayed`.
8. Run the generator for the full schedule, read `scripts/out/wordle-samples.md` critically.
9. Dev server on port 5201; check at `?day=` for 3+ days, 375px, physical keyboard; screenshot.
10. `web-design-guidelines` self-review; `HANDOFF.md`; `pnpm test`/`pnpm build`; scope check; commit.
