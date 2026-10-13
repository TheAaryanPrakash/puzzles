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

## Redesign (phase 2, 2026-10)

`theme.css` was already redesigned before this pass (neutral surface by design, so each guessed
flag's own colours stay the strongest colour on the page) — untouched here, per the task prompt.

- **Focus of this pass**: wired `src/components/fx/GlideCombobox.tsx` into
  `CountryAutocomplete.tsx`, replacing its hand-rolled input/listbox/arrow-key logic. `FlagTiles.tsx`
  and `GuessHistory.tsx` are untouched, as instructed — this is purely a swap of the guess input.
- **Matching behaviour preserved exactly as before**, via the two things GlideCombobox exposes for
  this:
  - The visible dropdown now filters by country **name only** (GlideCombobox's own built-in
    start-of-word-then-contains filter) — narrower than before, which also matched on alias and ISO
    code in the visible list.
  - To keep "type an alias or ISO code and press Enter" working even when that text never
    highlights in the dropdown (e.g. "uae" for United Arab Emirates, or "de" would resolve to
    Germany by code if nothing else matches first — see below), the old `matches()` function
    (code-equality / name-includes / alias-includes) is now threaded through GlideCombobox's
    `resolveFreeText` prop instead of building the suggestion list. Verified live
    (`playwright-cli`): typing "uae" shows no dropdown at all, but Enter still submits United Arab
    Emirates.
  - One pre-existing ambiguity carries over unchanged, not introduced by this swap: when a query
    matches several countries (by name-substring or, before, also by code/alias) and nothing is
    arrow-key-highlighted, Enter commits the *first* match in name-alphabetical order — not
    necessarily the one whose code you typed. E.g. "de" today still resolves to "Democratic Republic
    of the Congo", not Germany, because the old component's `suggestions[0]` fallback had exactly
    the same alphabetical-first behaviour. Worth flagging to the human only if this is considered a
    bug in its own right — it is not new here.
- **Dropped**: the explicit "Guess" button next to the input. GlideCombobox is a self-contained,
  uncontrolled component (its own `query`/`highlight` state, no external submit handle), so there's
  no way to wire an outside button to "submit whatever's currently highlighted" without forking the
  component — which the task said not to do. Submission is Enter (keyboard) or a tap/click on a
  dropdown option, consistent with every other GlideCombobox/GlideSelect usage already on the site
  (e.g. `ArchivePicker`). Flagging this removal explicitly since it's a (minor) UI contract change
  the human didn't ask for in writing, even though the prompt's own wording ("replace … internals (or
  the whole component)") anticipated it.
- Colours/sizing: `accentColor`/`highlightColor` → `var(--game-accent)`, `surfaceColor` →
  `var(--game-surface-2)`, `textColor` → `var(--game-fg)` (all inherited game-tier tokens — Flagle's
  `theme.css` doesn't override these, by design), `radius={8}` to match the site's
  `--brand-radius-sm`, `size="lg"` to match the previous input's visual height/font size.
- Verified live via `playwright-cli` (browser extension wasn't connected this session, so used the
  CLI as the procedure's fallback): typed-filter → highlighted option → Enter submit; alias/code
  fallback via `resolveFreeText` (confirmed "uae" → United Arab Emirates with nothing ever
  highlighted); already-guessed countries correctly absent from the dropdown
  (`excludeValues={excludeCodes}`); input stays focused after a selection across several guesses in a
  row; invalid query triggers the shake with no console errors; two different `?date=` values both
  render a working combobox; 375px and 1280px screenshots both look correct (pink focus ring,
  dark-on-dark listbox, good contrast).
- `pnpm test` (flagle's own 19 tests) and `pnpm build` both pass. No new tests added — the swapped
  logic (`resolveFreeText`, option mapping) is thin glue around `GlideCombobox`'s own already-tested
  behaviour and the pre-existing `matches()` function, which wasn't under test before either.

### Shared changes requested (redesign pass)

None.
