# Connections — RESEARCH

## 1. Official rules

No official NYT "how to play" page is scrapable directly, so rules were cross-checked across several
independent explainer sites and triangulated against the source code of real clones (below) for the
mechanical details:

- **Grid:** 16 words, secretly belonging to 4 groups of 4. Select exactly 4, submit.
- **Colours = difficulty**, not category type: **yellow (easiest) → green → blue → purple (trickiest)**.
  Confirmed via [Newsweek's Connections coverage](https://www.newsweek.com/entertainment/video-games/connections-new-york-times-october-24-answers-clues-hints-game-501-1973558)
  ("colors... range from yellow to green to blue to purple... purple is the trickiest, yellow the
  easiest") and independently by `dbousamra/connections`'s colour table (`#fbd400/#b5e352/#729eeb/#bc70c4`
  for difficulty 1–4) — two independent sources agree, so this is the mapping used (level 0=yellow ...
  level 3=purple), matching the data agent's CSV `Group Level` column (0–3) directly.
- **"One away":** exactly 3 of the 4 selected words belong to the same (any) group → a toast, tiles
  stay selected, no reveal of *which* word is wrong.
- **Mistakes:** 4 allowed. Every non-correct submission (including a "one away") consumes one, even
  though the two clones below model this two different ways (digit-countdown-from-4 vs tracking the
  wrong-guess count directly) — they're equivalent. Hitting the 4th mistake ends the game immediately;
  if that losing guess also happens to be "one away", the loss takes priority over the toast (see
  `srefsland` below) — confirmed in logic design, not shown as a separate toast.
  ([TechRadar](https://www.tomsguide.com/how-to/how-to-play-nyt-connections),
  [Techi](https://www.techi.com/puzzles/nyt/connections/how-to-play-nyt-connections--rules-tips--strategies/))
- **Shuffle button:** rearranges the remaining (unsolved) tiles only.
- **Solved groups** become a coloured bar in place of the 4 tiles; a loss reveals the remaining,
  unsolved groups.
- **Share result:** title + puzzle number + an emoji grid, one row per *submitted* guess (correct and
  incorrect alike, in submission order), colour-coded per word by the group it actually belongs to —
  confirmed directly from `and-computers/react-connections-game`'s `share-game.js`:
  `` `${GAME_TITLE} #${puzzleIndex}\n\n` + generateEmojiGrid(...) `` — no mistake count or words, just
  the grid. A "perfect" game is 4 solid rows; mistakes show as extra/mixed-colour rows. This never
  reveals the answer since it's just difficulty colours, not words — spoiler-free by construction.

## 2–3. Prior art: 3 open-source clones, read at the source level (via `gh api`, not just descriptions)

| Repo | Stars | Lang / Licence | Approach | Strengths | Known bugs / gaps | Accessibility / mobile |
|---|---|---|---|---|---|---|
| [`and-computers/react-connections-game`](https://github.com/and-computers/react-connections-game) | 61 | JS / **GPL-3.0** | Context-based state (`PuzzleDataContext`/`GameStatusContext`), `isGuessCorrect` returns `isCorrect` + `isGuessOneAway` (min set-difference === 1), full board reshuffle (`shuffleGameData`) after every solve, confetti via `react-confetti-explosion`, Web Share API with UA-sniffed fallback to clipboard. | Clear separation of "is this guess correct/one-away" from UI; share-text format is simple and robust; reshuffle-remaining-on-solve keeps the grid full. | Its emoji-tile-to-difficulty mapping (`difficulty 1→🟩, 2→🟨, 3→🟪, 4→🟦`) **contradicts** the yellow-first convention the Newsweek source and `dbousamra` agree on — looks like an implementation slip, not a real alternative convention. GPL-3.0 means **read-only**, no code reuse. | Reshuffles the *entire* remaining board (not just a position-preserving shuffle) on every solve, which is a bigger visual jump than the real game (tiles don't visibly "collapse" in place). |
| [`srefsland/nyt-connections-clone`](https://github.com/srefsland/nyt-connections-clone) | 13 | TS / **MIT**, pushed 2026-10-03 (actively maintained) | `useGameLogic` hook: `guessHistoryRef` for exact-duplicate detection ("same" result, no mistake charged), `likenessCounts` per category (`filter(...).length`), max-likeness drives correct/one-away/incorrect, **loss check happens before the one-away check** so a losing guess never also shows "one away", staggered reveal of remaining categories on loss (`delay(1000)` between each). `useAnimation` hook bounces each selected tile in sequence (100 ms apart) before resolving a guess, then a distinct ~225 ms shake state for a wrong guess. | Most faithful mistake/one-away priority logic of the three; duplicate-guess guard is a clean, reusable pattern; animation timing (bounce-then-resolve, then shake-if-wrong) is a good reference for pacing. MIT, so directly reusable in principle. | Initial board order and the shuffle button both use a plain `Array.sort(() => Math.random()-0.5)` shuffle — fine for a single-player clone, not acceptable here since every member must see the *same* initial layout (see §4). | Keyboard/ARIA not audited in the slice read; relies on click-based `<button>` cells, which is at least focusable by default. |
| [`dbousamra/connections`](https://github.com/dbousamra/connections) | 7 | TS / none declared | Tiny `useMethods`-based reducer (~90 LOC): `submit()` finds a fully-contained group via `.every()`, else decrements `mistakesRemaining`. Confirms the standard yellow→green→blue→purple colour table independently of the Newsweek source. | Very compact reference for the minimal state shape needed (`complete`, `incomplete`, `items`, `activeItems`, `mistakesRemaining`). | **No "one away" detection at all**, and `mistakesRemaining` starts at **3**, not the official 4 — both clear deviations from the real game, kept here only as a "what not to copy" data point. Unlicensed, so read-only regardless. |

No code was copied from any of the three (GPL-3.0 and "no licence" repos can't be used at all per
CLAUDE.md; the MIT one's logic was read for the *design*, not transcribed — the implementation below
is written from scratch against this project's own `logic.ts`/`DataSource` contract, which looks
nothing like any of the three's state shape).

## 4. Chosen approach vs. the three clones — and deviations from the task prompt

- **Deterministic initial layout, not `Math.random()`.** All three clones shuffle the board with plain
  JS `Math.random()` on mount — fine for a single-player toy, wrong here: CLAUDE.md requires *every
  member gets the same puzzle*, which includes the same initial grid arrangement (otherwise one
  person's board might accidentally cluster a group together while another's doesn't). `logic.ts`
  derives the initial order with `mulberry32(hashString(date))` (same seeding pattern as
  `src/lib/data/local.ts`'s friends-board RNG) — deterministic per puzzle day, identical for every
  device. The interactive **Shuffle button** still reorders randomly per click (`Math.random`-based,
  via `lib/daily.ts`'s `shuffle` helper) since that's a private, per-player UI convenience with no
  fairness requirement — CLAUDE.md's "never `Math.random()` in scripts" is about the *generator*, not
  live client interaction.
- **Shuffle only touches unsolved tiles**, and a solve removes exactly that group's 4 slots rather than
  reshuffling the whole remaining board (unlike `and-computers`) — closer to the real game's "tiles
  collapse in place" feel, and it means `order` only needs to change when the player actually presses
  Shuffle, matching the state contract's own comment ("order, so a shuffle survives a refresh").
- **Loss priority over "one away"**, and a **duplicate-guess guard that doesn't burn a mistake** — both
  adopted from `srefsland` as the most rules-faithful of the three, implemented independently in
  `logic.ts`'s `evaluateGuess`/`isDuplicateGuess`.
- **Colour mapping:** level 0=yellow, 1=green, 2=blue, 3=purple — the Newsweek-sourced, majority
  (2-of-3 clones) convention, also the CSV's own `Group Level` numbering, so no remapping needed on
  import.
- **No site URL in the share summary**, unlike `and-computers`'s `GAME_URL = window.location.href`.
  `config.ts` has no `SITE_URL` constant yet (per `PLAN.md` the Vercel domain doesn't exist until
  deploy), and `src/games/_example`'s own `buildSummary` likewise omits one. Fabricating a URL isn't
  safe to do from a game agent's worktree. Flagged under "Shared changes requested" in HANDOFF.md.
- **"No split numbers" validation:** the CSV (`data/connections/Connections_Data.csv`) already quotes
  every comma-containing field correctly (verified directly: `"20,000"` and `"WAYS TO EXPRESS 1,000"`
  are intact single CSV fields, and an `awk` pass over quote-balance found zero malformed lines) — a
  *naive* comma-split parser is what the task prompt's example describes, not something this clean
  dataset actually contains. The importer still implements the check as a structural validation
  (exactly 16 rows per puzzle, exactly 7 columns per row, `Group Level` parses as an integer 0–3) so
  that a future re-import from a messier source is still caught, and reports `0 rejected` honestly in
  the samples file rather than fabricating a rejection to look thorough.
- **Word order within a group** is kept in the CSV's own encounter order (itself the original NYT grid
  reading order, `Starting Row`/`Starting Column`) — not re-sorted — since the normalised schema has no
  position field to preserve it separately, and it doesn't matter for gameplay (only solved-bar display
  order, which isn't specified either way).

## Edge cases (each is a `logic.test.ts` case)

- Exactly 3-of-4 overlap with a group → `"one-away"`; 2-and-2 split across two different groups →
  `"incorrect"` (no group has 3+, so it must not register as one-away).
- A guess identical (as a set, any order) to an *already-submitted* guess → `"duplicate"`, state
  unchanged, no mistake charged, even across shuffles / re-selecting in a different order.
- The guess that produces the 4th mistake ends the game as a loss even if it was "one away" — loss
  takes priority, no one-away toast on that submission.
- Winning on the 4th (last possible) correct guess after 3 prior mistakes — still a win, not a loss,
  since mistakes and solves are counted independently.
- `order` round-trips through `JSON.stringify`/`parse` and, combined with `guesses`, reconstructs an
  identical visible grid (remaining tiles in the same relative order, solved groups rendered as bars in
  the order they were actually solved — not level order).
- A puzzle where the player's final guess is correct AND happens to be the 4th group — must resolve as
  a win on that same submission, not require an extra render pass.
- `buildSummary` never contains any group label or word from the puzzle, for every puzzle in the
  generated schedule (property-style test over the real imported pool, not just one fixture).
- Reserve/"skip" switch: `savePlay`'s variant-switch guard (enforced by the data layer, not this game)
  is exercised implicitly by never calling `start({variant:"reserve"})` after a non-empty guess exists.

## Deliberately left out

- No per-word hover "preview" of category membership (the real game never gives this either — it's not
  a feature to skip, just confirming it doesn't exist).
- No animated board reshuffle on every solve (see "Chosen approach" above — deliberately *not* copying
  `and-computers`'s full-reshuffle-on-solve, since it's a bigger visual jump than the authentic game).
- No "hard mode"/colourblind palette toggle — out of scope for a 14-game friends site; the 4 level
  colours were chosen to individually pass 4.5:1 text contrast (computed directly, not guessed):
  yellow `#dca52e`/dark text 6.94:1, green `#4f7d53`/white 4.78:1, blue `#3f6fa0`/white 5.26:1, purple
  `#7d5486`/white 6.03:1 — plus the solved-bar label always repeats the category name as text, so
  colour is never the only signal.

## Skills used

- **`motion-framer`**: read for `AnimatePresence`/exit animations (solved group leaving the grid),
  `layout`/`layoutId` (remaining tiles reflowing after a solve or shuffle), `useReducedMotion` (every
  animation here is gated on it, not just relying on `brand.css`'s CSS-only `prefers-reduced-motion`
  block, which doesn't touch Motion's JS-driven `animate` prop).
- **`ui-ux-pro-max`**: used its `color` domain search for an accessible-contrast baseline, then computed
  exact WCAG contrast ratios by hand for the final 4 category colours (see above) since the generic
  SaaS-palette search results didn't fit a 4-colour game-tile system.
- **`playwright-cli`**: used via `pnpm shot` for the 375px/1280px screenshots in
  `src/games/connections/screenshots/`, and for a physical-keyboard-only run.
- **`web-design-guidelines`**: fetched the Vercel Web Interface Guidelines and reviewed `index.tsx`/
  `components/*` against them before calling this done (see HANDOFF.md).

## Build plan

1. `scripts/connections/lib.ts` — pure CSV parsing, puzzle validation, and the seed-31
   main/reserve scheduling, each with Vitest tests in `lib.test.ts`.
2. `scripts/connections/import.ts` — CLI: reads `data/connections/Connections_Data.csv`, calls `lib.ts`,
   writes `content/puzzles/connections/<date>.json` for every schedule day and
   `scripts/out/connections-samples.md`.
3. `src/games/connections/logic.ts` — types, `DEFAULT_STATE`, `initialOrder`, `evaluateGuess`,
   `isDuplicateGuess`, `solvedGroups`, `countMistakes`, `isWon`/`isLost`/`isOver`,
   `remainingGroupsByLevel`, `shuffleOrder`, `buildSummary`. Tests in `logic.test.ts`.
4. `meta.ts`, `theme.css` (off-white/beige, Libre Franklin, 4 category colours).
5. `components/Tile.tsx`, `SolvedGroupBar.tsx`, `MistakeDots.tsx`, `Toast.tsx`.
6. `index.tsx` wiring `usePuzzle`/`usePlay` to the above, following the game contract exactly
   (start-on-first-selection, `{...DEFAULT_STATE, ...play?.state}`, spoiler-free `finish`).
7. Screenshots, `web-design-guidelines` pass, `HANDOFF.md`.
