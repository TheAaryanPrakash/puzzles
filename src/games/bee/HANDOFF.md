# Spelling Bee — handoff

## Built
- Generator (`scripts/bee/generate.ts`): pangram-first bitmask/submask enumeration over
  ENABLE1 ∩ common.txt[:40000], minus blocklist, minus any word containing S. 365 unique
  7-letter sets (seed 7), 20–60 answers each, ≥1 pangram, no two days share a mask. Every
  day file is `{ payload, reserve: null }` (Bee has no reserve — see RESEARCH.md §8).
- Game logic (`logic.ts`): scoring (`length`, 1 for exactly 4 letters, +7 pangram bonus),
  the 10-rank ladder as % of `maxScore` (rounded up like the real game), validation in the
  order the hive should report feedback, deterministic per-day starting hex order, and a
  spoiler-free `buildSummary` (rank/score/word count/pangram count only — never which words).
- UI: hand-rolled CSS hexagon hive (`theme.css`, no new dependency), tap-or-type input with
  its own `keydown` listener (Bee has no QWERTY layout, so it doesn't reuse `<Keyboard>`),
  shake-on-reject / pop-on-accept via `motion`, alphabetical found-words list, segmented
  rank progress bar, shared `ResultModal`/`HelpModal`/`AlreadyPlayed`/`NoPuzzleToday`.
- Completion matches the prompt exactly: stays `in_progress` across sessions (saved after
  every word), finishes on "Finish for today", auto-finishes the instant every answer is
  found (Queen Bee), and auto-finishes on load if an earlier day's play is still
  `in_progress` when reopened. Won = reached Genius at finish.
- 43 Vitest tests (`scripts/bee/generate.test.ts` + `src/games/bee/logic.test.ts`), covering
  every edge case listed in RESEARCH.md: short/invalid/missing-center/unknown/duplicate
  words, pangram scoring, 4-letter scoring, case-insensitivity, Queen Bee auto-finish,
  0-word finish, JSON round-trip of `{ found }`, the `{}` gotcha, summary spoiler-freedom,
  rank boundary rounding, and generator invariants (answer-count range, pangram presence,
  mask uniqueness, no S).
- No deviations from the task prompt beyond what RESEARCH.md already notes (rank % table
  sourced from cross-checked fan sites since NYT doesn't publish one; no "spill the bee"
  hint feature, no site URL in the share text — neither exists elsewhere in `src/`).

## Review
1. Rank thresholds (`RANKS` in `logic.ts`): the % table is triangulated from secondary
   sources (no official NYT page found) — worth a sanity check against anyone's memory of
   the real game.
2. Hive layout at 375px (`screenshots/mobile.png`) — check touch-target comfort on a real
   phone, not just the emulated viewport.
3. `buildSummary`'s wording/emoji — purely a taste call, easy to tweak.
4. The auto-finish-on-reopen behavior (`index.tsx`'s second `useEffect`) — manually verified
   via local-adapter puzzle data, not covered by an automated integration test (unit tests
   cover the pure logic it depends on, per RESEARCH.md edge case 15).
5. Generator's 20–60 answer-count range picks the center "closest to 40" when a mask has
   several valid centers — an invented heuristic (NYT's own rule for this isn't public).

## Shared changes requested
None.

## Licences
None — no code copied. See RESEARCH.md for the open-source projects consulted (read for
approach only, not copied from).

## Known issues
- None found. `pnpm test` (43/43 bee tests) and `pnpm build` pass; `node scripts/check-scope.mjs bee`
  passes after removing accidentally-committed `.playwright-cli/` debug artifacts from an
  earlier session (cleanup commit).
- Manually verified in a real browser against the local adapter: tap/type input, shuffle,
  delete, accept/reject feedback, found-words list, rank bar, "Finish for today" →
  ResultModal with stats/share/friends board.
