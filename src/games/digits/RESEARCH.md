# digits — RESEARCH

## 1. Original game rules

NYT ran "Digits" as a beta math game from spring 2023 until it was shut down on 2023-08-08. It
never shipped with an official rules page, so the rules below are reconstructed from contemporary
coverage and a solver write-up:

- [Tom's Guide — "I tried the daily numbers game..."](https://tomsguide.com/news/digits-is-the-daily-numbers-game-hoping-to-become-the-new-worldle) —
  six starting numbers + one target per puzzle; combine with + − × ÷; each number usable once;
  you don't have to use all six; fractions and negative intermediate results are rejected; scoring
  is distance-based, not all-or-nothing; an undo button exists; the beta ran **five puzzles a day**.
- [InsideHook — "Digits Is Basically the Math Version of Wordle"](https://www.insidehook.com/culture/digits-game-new-york-times) —
  confirms the ⭐⭐⭐ exact / ⭐⭐ within 10 / ⭐ within 25 scoring tiers.
- [Alexander Ellis — "Brute-forcing the NYT Digits game"](https://alexanderell.is/posts/digits/) —
  a solver write-up with five real captured puzzles, e.g. `[1,2,4,5,10,25] → 94`,
  `[3,13,19,20,23,25] → 456`, `[5,7,11,19,23,25] → 438`. Confirms starting numbers are positive
  integers roughly in **1–25**, and targets land roughly in the **40–750** range. This is also the
  source for the difficulty proxy (solution count) discussed below.

Net rules, matching the task prompt exactly: 6 numbers, 1 target, binary ops `+ − × ÷` combine any
two *currently available* numbers into one (consuming both), every intermediate and final result
must be a positive integer (no fractions, no zero, no negatives), each of the 6 starting numbers
is usable at most once, and you never have to use all of them. Stars: exact = 3, within 10 = 2,
within 25 = 1, otherwise 0.

## 2–3. Prior art — solvers for Countdown-style number puzzles

Digits is a daily-puzzle wrapper around the classic "Countdown numbers round" problem (same rules,
different number ranges/UI). Comparison of solver approaches found:

| Source | Approach | Strengths | Known gaps | Licence |
|---|---|---|---|---|
| [Graham Hutton, "The Countdown Problem" (functional pearl)](https://www.cs.nott.ac.uk/~pszgmh/countdown.pdf) | Generate-and-test over all sub-multisets of the inputs, recursively combining partitions; proved correct, then fused into one pass for speed. Canonical reference algorithm for this exact problem. | Rigorous, well-known, directly matches our rules (no fractions/negatives, numbers used at most once). | Academic pearl, no code to run as-is; doesn't rank by difficulty. | Academic paper, no licence (algorithm only, not copied). |
| [`countdown-numbers-game` (Hackage/Stackage, Henning Thielemann)](https://hackage.haskell.org/package/countdown-numbers-game) | Same brute-force generate/combine, but keeps expressions canonical up to commutativity/associativity to avoid listing `2+3` and `3+2` separately. | Practical, avoids duplicate-solution noise. | Haskell, not reusable in our TS stack. | BSD-3-Clause — permissive, but we don't need to copy any code for logic this small. |
| [`mfbx9da4/countdown-solver` (GitHub)](https://github.com/mfbx9da4/countdown-solver) | Full permutation brute force, run in a web worker, streaming solutions into a tree as it finds them. | Shows a practical web/JS architecture (worker so the UI doesn't block). | No licence file; no pruning, so slower than it needs to be. | Unspecified — not copied. |
| [Alexander Ellis's Digits solver write-up](https://alexanderell.is/posts/digits/) | Recursive DFS pairing two numbers + an operator at a time, replacing them with the result; prunes negative subtraction, inexact division, ×1/÷1, and duplicate commutative pairs. Counts *all* solutions per puzzle and buckets by step count as a difficulty signal (more total solutions ⇒ easier). | Directly validated against real NYT Digits puzzles; the difficulty-by-solution-count idea is useful context even though we don't use it directly. | Author calls it "throwaway blog code," ~30s per puzzle, no pruning for symmetric ops beyond what's listed. | Unspecified ("use at your own risk") — not copied. |

**Chosen approach:** our own small TypeScript solver (`logic.ts`'s `solve()`), modeled on Hutton's
generate-and-test recursion since it is the cleanest correct algorithm for *exactly* our rules
(canonical reference, not copied code — this problem is tiny enough that writing it directly is
clearer than adapting someone else's). For 6 starting numbers, the recursion explores at most
`2^6 = 64` subset splits at the top level with further recursion inside each half, which is fast
(our generator's own test times every round at well under 50ms).

Differences from the write-ups above and why:
- We need **minimum steps to an exact solution**, not a full solution count or a single arbitrary
  shortest solution — so `solve()` tracks the minimum step count seen across *every* exact subset
  match, not just the first one found, and exposes it as `minSteps`.
- We additionally need a cheap **"reachable in exactly one step?"** check (any single
  op on any two of the 6 raw numbers hitting the target exactly) to reject too-easy rounds, which
  none of the write-ups needed since Countdown/Digits don't filter for difficulty this way.
- Pruning rules adopted directly from the write-ups above (all are just restatements of the stated
  rules, not literary expression worth attributing as "copied code"): skip `a - b` when `a <= b`;
  skip `a / b` unless `b` divides `a` evenly; skip `a * b` / `a / b` when either operand is 1 (no-op
  moves that only inflate step count without changing reachability); skip commutative duplicates
  (`a op b` only tried once per unordered pair for `+`/`×`).

## 4. Chosen approach — generator

- **Number/target ranges**, following the captured real puzzles above: 6 numbers drawn from 1–25,
  target drawn from a range that scales with round index (round 1 easiest, round 5 hardest) so the
  day has a difficulty ramp, similar to how Wordle-adjacent dailies often order puzzles by
  difficulty. Concretely: round *i*'s target is sampled from `[40 + 60·i, 150 + 160·i]` (≈ 40–190 for
  round 1 up to ≈ 280–790 for round 5).
- **Deterministic seed 21**, per the task prompt: `mulberry32(21 + dayIndex*1009 + round*97)` — a
  distinct, deterministic sub-seed per (day, round) so every member gets the same 5 rounds and the
  schedule never collides across days or rounds without needing a single giant shared RNG stream.
- **Validity filter**, applied per candidate round before accepting it:
  1. `solve()` must find an exact solution (`minSteps` defined) — "exactly reachable," as required.
  2. `minSteps >= 2` — rejects "reachable in one step" (too trivial — the prompt explicitly asks to
     exclude this).
  3. Reject targets reachable via a single number already equal to the target (also trivial;
     covered by the same `minSteps >= 2` check, since a 0-step "solution" isn't a step at all —
     `solve()` never returns `minSteps = 0`, but we also explicitly exclude `target` being in the
     starting numbers for clarity/robustness).
  If a candidate fails, redraw numbers+target with the next RNG state (still deterministic, since
  the RNG is a single evolving stream) and retry, up to a generous cap; throw if a day can't
  produce 5 valid rounds (per CLAUDE.md "Generators" — throw rather than silently skip).
- **Day file**: `{ "payload": { "rounds": [{ "numbers": number[6], "target": number, "minSteps":
  number }] x5 }, "reserve": null }` — matches the task's payload shape with `"reserve": null`
  (reserve puzzles are only for Connections/Mini, per CLAUDE.md "Archive data").

## Game design

- **Interaction**: tap a number tile to select it as operand A, tap an operator, tap a second
  number tile → the three are combined into one `Step` and animated as a merge (the two tiles
  slide together and are replaced by the result tile, via `motion`). Tapping the same tile twice
  deselects it; tapping a different number tile while one is already selected re-targets the
  selection (no modal, no confirm step — matches the "tap-tap-tap" feel of the original).
  Division/subtraction that would be illegal for the *tapped order* (e.g. `3 − 10`) is rejected
  with a shake animation instead of silently swapping the operands, since silently reordering would
  be surprising; the player can simply tap the two numbers in the other order.
- **Per-round state** `{ steps: Step[], submitted: boolean }` where `Step = { a, b, op, result }`
  (plain values, not tile ids) is enough to deterministically replay the pool of numbers remaining
  in a round at any point (`poolAfterSteps`), which is what both the UI (for rendering/undo) and
  the scorer (closest-to-target number currently on the board) need. Storing values rather than
  tile identities keeps the JSON minimal and matches the task's state shape exactly; identity for
  animation purposes is assigned fresh on every render from a stable replay, which is enough since
  live tap interaction state (which tile is currently selected) is ordinary React state, not
  persisted play state.
- **Scoring**: after any steps, the "closest" number currently on the board (by `|n - target|`)
  determines the round's stars (3/2/1/0 per the task's thresholds). A round can be submitted with
  any number of steps (0 included — the original board already has a "closest" number).
  **Undo** pops the last step (round must not be submitted). **Reset round** clears all its steps.
  **Submit** locks the round (`submitted = true`); the local adapter's `savePlay` already forbids
  changing `state` on a finished play, but *within* a single multi-round play we also gate further
  edits to a round client-side via `isOver`-style checks in `logic.ts`.
- **Finishing the whole game**: `finish()` fires once every one of the 5 rounds has been submitted.
  `won` = true iff every round scored ≥ 1 star. `score` = total stars across all 5 rounds (0–15),
  used for `ResultModal`'s stats row the same way a guess count is for Wordle. The spoiler-free
  `summary` renders a row of star emoji per round (e.g. `⭐⭐⭐ ⭐⭐ ⭐ ⬛ ⭐⭐⭐`) — it reveals how well
  the player did, never the numbers, target, or any solution steps, so nothing is spoiled for a
  friend who hasn't played yet.

## Edge cases (each is a test in logic.test.ts)

- `solve()` finds `minSteps` for a genuinely solvable set, and reports "not solvable" (`undefined`)
  for an impossible target (verified against the generator's own output, which always has a
  solution, plus a hand-built unsolvable case).
- `solve()`'s one-step reachability check correctly flags/rejects trivial pairs.
- Subtraction/division reject illegal orderings (`a < b` for `−`, non-exact or `a < b` for `÷`)
  without crashing, and `applyStep` rejects any op whose computed result isn't a positive integer.
- `applyStep` rejects operands not currently present in the pool (guards against stale taps after
  an undo/reset race).
- `poolAfterSteps` correctly collapses duplicate-valued tiles (removes *one* matching instance per
  operand, not both) — covered with a round that has two equal starting numbers.
- `scoreRound` boundary values: exactly on target (3⭐), exactly 10 away and exactly 11 away (2⭐ vs
  1⭐ boundary), exactly 25 away and 26 away (1⭐ vs 0⭐ boundary), and the zero-steps case (score
  comes from the original 6 numbers alone).
- `undo`/`resetRound` are no-ops (or rejected) on a submitted round.
- Whole-game `isWon`: true only when every round's score ≥ 1; false if any round is unsubmitted or
  scored 0.
- State round-trips through `JSON.parse(JSON.stringify(...))` to an identical game (steps array of
  plain objects, no `Map`/`Set`/class instances).
- `buildSummary` never contains any of the 6 numbers, the target, or any operator symbol for any
  round — only star/blank glyphs, the puzzle number and title.
- Generator: every one of `SCHEDULE_DAYS` days produces exactly 5 rounds, each with `minSteps >= 2`
  and a genuinely exact solution (re-verified by feeding the generator's own output back through
  `solve()` in the generator's test file) — this is the "brute-force solver confirms each target is
  exactly reachable and not reachable in one step" requirement from the task prompt, checked twice:
  once inside the generator while it searches, and once more as an independent test assertion.

## Deliberately left out

- No partial credit for a round that mixes some used/unused numbers beyond the closest-number
  rule above — matches the original rules (you don't have to use every number, and only the
  closest number currently on the board matters).
- No "hint" feature or solution reveal — out of scope for a daily puzzle whose fun is figuring it
  out; HelpModal only explains the rules and controls.
- No alternate operand-order auto-correction for subtraction/division (see "Game design" above) —
  a deliberate UX choice over silently reinterpreting the player's tap order.
- No server-side scoring — per CLAUDE.md, the puzzle (including its answer-shape data) is already
  fully visible client-side; we don't add any secret-checking infrastructure beyond what every
  other game skips.

## Skills used

- `motion-framer`: the tile merge animation (two tiles sliding together and fading into the result
  tile), the shake on an illegal move, and the per-round reveal when a round is submitted. All
  durations come from the brand token scale (`--brand-duration-*`) and everything is gated by
  `prefers-reduced-motion` (handled globally in `brand.css`, plus an explicit check before firing
  any one-off animation that isn't a CSS transition).
- `ui-ux-pro-max`: picking the pastel palette (circles, one hue per round) with enough contrast
  between tile text and tile fill at WCAG AA, and sizing tap targets (≥44px) for the number/operator
  circles on mobile.
- `playwright-cli`: screenshots at 375px and 1280px (`src/games/digits/screenshots/`), plus a
  keyboard-only run (Tab to a tile, Enter/Space to select, same for operator and the second tile).
- `web-design-guidelines`: final self-review pass before HANDOFF.md (focus states, contrast,
  touch target size, reduced motion, aria labels on icon-only buttons).

## Build plan

1. `logic.ts` — types, `solve()`, `applyStep`/`poolAfterSteps`, `scoreRound`, whole-game
   `isWon`/`totalStars`, `buildSummary`. Pure, no React/DOM.
2. `logic.test.ts` — every edge case above.
3. `scripts/digits/generate.ts` (+ its own test) — seed 21, writes `content/puzzles/digits/`,
   validates every round through `solve()`, writes `scripts/out/digits-samples.md`.
4. `meta.ts`, `theme.css` — pastel circle palette, Libre Franklin.
5. `index.tsx` + `components/` (`NumberTile`, `OperatorPad`, `RoundBoard`) — wires `usePuzzle`/
   `usePlay` per the contract, round navigation, undo/reset/submit, merge animation.
6. Screenshots, `web-design-guidelines` self-review, `HANDOFF.md`.
