# digits — HANDOFF

## Built

- Full contract: `usePuzzle`/`usePlay`, restorable state (`{ rounds: [{ steps, submitted }] }`),
  start-on-first-move, debounced autosave, spoiler-free `buildSummary`, self-healing `finish()` if
  a tab closes between the last submit and the finish call landing.
- 5 rounds/day, 6 numbers + target each, tap-number → tap-operator → tap-number merge flow with
  undo, reset round, and per-round submit. Closest-to-target number on the board (after any subset
  of merges, not all 6 numbers required) decides stars: exact = 3, within 10 = 2, within 25 = 1.
  Won = ≥1 star in every round.
- Round navigation (`RoundTabs`) is always free — a player can hop between rounds before they're
  all submitted, matching the reconstructed NYT Digits UX (no forced linear order). A submitted
  round opens read-only with its closest number highlighted.
- Generator (`scripts/digits/generate.ts`), seed 21, writes all 365 scheduled days. Every round is
  verified solvable-but-not-1-step by the same `solve()`/`minStepsTo()`/`reachableInOneStep()`
  brute-force solver the game ships with (Hutton's generate-and-test over sub-multisets — see
  RESEARCH.md), checked once during generation and again independently in `generate.test.ts`.
- Theme: pastel circles (one hue per round via `[data-round]`), Libre Franklin, merge/shake
  animations via `motion`, all gated on `useReducedMotion()`.
- Screenshots at 375px and 1280px saved to `src/games/digits/screenshots/`.
- 109 Vitest tests across `logic.test.ts` and `generate.test.ts`: every `evalOp` edge case
  (subtraction/division order, zero, non-integer division), state round-trip through
  `JSON.parse(JSON.stringify())`, summary-never-contains-the-answer, solver correctness on known
  Countdown puzzles, and the full generated schedule re-verified solvable.

**Deviations from the task prompt** (all explained in RESEARCH.md, reconstructed from secondary
sources since NYT never published an official rules page for Digits — it ran as a beta and was
shut down in 2023):
- Round order isn't forced; CLAUDE.md's reserve/variant mechanics don't apply here (no reserve
  puzzles for this game), so there was nothing to deviate on there.
- No partial credit beyond the single closest-number rule, no hint/solution reveal, no alternate
  operand-order auto-correction for `-`/`/` (player must tap the larger number first) — see
  RESEARCH.md "Deliberately left out" for the reasoning on each.

## Review

- **Scoring edge case**: `scoreRound` picks the closest number across *every* number still on the
  board after a round's steps, including untouched original numbers — so a round can score 3
  stars via a number the player never touched if it happens to equal the target. This matches the
  reconstructed rules (closest number on the board, not closest *result*), but is worth a human
  gut-check against how the real game felt.
- **`-`/`/` order UX**: tapping operands in the "wrong" order (e.g. 3 then 7 for `-`) shows a
  shake + inline error rather than silently flipping the order. Confirm this reads as intentional
  friction rather than a bug on first play.
- **Always-free round navigation**: a player can switch rounds mid-round without submitting the
  current one (progress is preserved per round). Confirm this matches the intended feel — an
  alternative would lock navigation until the active round is submitted.
- **Star glyph density** on `RoundTabs` (e.g. `⭐⭐⭐` in a 0.55rem line) — check legibility at 375px
  on an actual device, not just the saved screenshot.
- **Solver performance**: `minStepsTo` is brute force over all subsets × all partitions; fine for a
  366-day batch generation run (seconds total) but would be too slow to run live in the browser —
  it never does; the generator is the only caller.

## Shared changes requested

None.

## Licences

None — no code copied. `solve()`/`allResults()` is an original TypeScript implementation modeled
on the *algorithm* described in Graham Hutton's "The Countdown Problem" functional pearl (academic
paper, algorithm only, nothing to attribute as copied code).

## Known issues

- None found. `pnpm test` (109 tests) and `pnpm build` both pass; `node scripts/check-scope.mjs
  digits` passes.
