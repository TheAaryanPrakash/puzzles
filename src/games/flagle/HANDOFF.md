# Flagle — handoff

## Built

- **Generator** (`scripts/flagle/generate.ts`): 231-country pool (every `flag-icons` country minus
  uninhabited territories — AQ, GS, HM, IO, TF, hand-reviewed after a first run surfaced French
  Southern and Antarctic Lands), seed 71, `mulberry32` + `shuffle`, no repeats within a 231-day
  cycle (schedule is 365 days, so the pool reshuffles and repeats once, from day 232 on — see
  RESEARCH.md "Pool size vs. schedule length"). Writes `content/puzzles/flagle/<date>.json` =
  `{ code }` and precomputed `public/assets/flagle/centroids.json` (code → `[lon, lat]`, reused by
  `feedbackFor` instead of parsing `world-atlas` topology at runtime).
- **Game logic** (`logic.ts`): `revealOrder(date)` — a deterministic per-day permutation of the 6
  tile indices, hashed from the date so the day file stays just `{ code }`; `hiddenTiles` (caps at
  5 auto-lifted tiles — the 6th never lifts from a guess alone, so a final guess is always made
  against a still-partly-covered flag; full reveal is the end-state UI, not this function);
  `feedbackFor` — distance/bearing/proximity via the shared `lib/geo.ts` formulas, same mental model
  as Worldle; `buildSummary` — emoji grid, never the code or name.
- **UI**: `FlagTiles` (3D flip-lift reveal via Motion, `AnimatePresence`), `CountryAutocomplete`
  (accessible combobox: name/alias/ISO-code matching, full arrow-key/Enter/Escape support, shake on
  a no-match submit), `GuessHistory` (past guesses with flag + geo feedback, slide-in). Neutral
  slate theme + one blue accent (`theme.css`) so flags carry the colour story; Inter throughout.
  All motion gated by `useReducedMotion()`.
- Deviation from the task prompt: none — generator, reveal grid, guesses, autocomplete and geo
  feedback all match as specified. The only addition beyond the prompt is excluding the 5
  uninhabited territories from the pool (documented in RESEARCH.md), since none of them would be a
  fair/fun daily puzzle.

## Review

1. The bright solid-colour tiles in the screenshots (e.g. the green square) are just a flag's own
   plain-colour field showing through a lifted corner tile (e.g. Bangladesh's field, cropped away
   from the red disc) — not an app colour. Worth a glance to confirm it still reads as "part of a
   flag" rather than a UI bug.
2. `flagle-*.css` in the production build is ~420 KB (85 KB gzipped) — `flag-icons`' full stylesheet
   inlines every country as a background-image rule. Expected and unavoidable without switching
   libraries (out of scope — no new packages), but worth knowing if bundle size is audited later.
3. Pool size (231) vs. schedule (365 days) means the puzzle repeats a country once per ~231-day
   cycle (first repeat on day 232, 2027-05-07 given LAUNCH_DATE). Confirmed acceptable for a
   year-long calendar of this size in RESEARCH.md; flag if the human wants a strictly no-repeat year.
4. Autocomplete matches on substring anywhere in the name/alias (not just prefix) — e.g. typing
   "land" surfaces every "-land" country. Intentional (matches most Wordle-family clones), but worth
   trying by hand since it changes how the suggestion list feels compared to a prefix-only match.

## Shared changes requested

None.

## Licences

None — no code copied from other projects. `logic.ts`'s geo formulas reuse the project's own shared
`src/lib/geo.ts` (already on `main`, Worldle's mental model), not anything external.

## Known issues

- No visual-similarity hint and no "give up" button — both deliberately left out; see RESEARCH.md
  "Deliberately left out" for why.
