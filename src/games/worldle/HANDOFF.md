# Worldle — HANDOFF

## Built

- **Generator** (`scripts/worldle/`): Natural Earth country polygons →
  mainland-clustering (`geometry.ts`, drops remote overseas rings >3,000 km from a
  feature's largest polygon so e.g. France's silhouette is mainland+Corsica, not a
  bounding box stretched to French Guiana) → `d3.geoAzimuthalEqualArea` rotated to
  each country's own centroid → precomputed SVG paths in
  `public/assets/worldle/silhouettes.json` (path `d`, `viewBox`, centroid). A seeded
  (seed 61) shuffle (`pool.ts`) assigns one of 205 playable codes per day across the
  full 365-day schedule, cycling the whole pool before any repeat. Day files are
  `{ "payload": { "code": "XX" }, "reserve": null }`.
- **Excluded territories** (31 codes, listed with reasons in the samples file):
  non-sovereign dependent territories / SARs / Crown dependencies / free-association
  states under ~2,000 km², decided on sovereignty + size rather than size alone —
  small *sovereign* countries (Monaco, San Marino, Liechtenstein) are kept, since a
  hard day guessing a real small country is part of the original game.
- **Game**: silhouette + 6-guess accessible autocomplete (W3C APG editable-combobox
  pattern: `role="combobox"`, owned `listbox`, arrow keys, Enter to commit, Escape to
  close), matching against `public/assets/shared/country-names.json`'s name + aliases
  (case-insensitive, exact → prefix → substring ranking, already-guessed codes
  excluded). Each guess row shows distance (km), a compass arrow, and a 0–100
  proximity % (`lib/geo.ts`'s great-circle distance/bearing, 0% = antipodal ~20,015 km).
  Flags (`flag-icons`) shown next to each guess row for flavour.
- **State**: `{ guesses: string[] }` (ISO codes in guess order) — restorable, JSON
  round-trips, derived with `{ ...DEFAULT_STATE, ...play?.state }` per the `{}` gotcha.
- **Share summary**: `Worldle #N won/X of 6` + one emoji row per guess (proximity
  colour bucket + direction arrow), never the country name or code — tested in
  `logic.test.ts` across every code in the pool.
- **Theme**: light grey surface, near-black silhouette fill, Inter — an atlas feel.
  Guess-row entrance and the compass arrow's rotate-in use `motion`, both honouring
  `prefers-reduced-motion` via `useReducedMotion`.
- **Deviations from the prompt baseline** (explained in full in RESEARCH.md):
  - No km/mi toggle (km only — target audience is India-based).
  - No progressive reveal/zoom/rotation hint mechanic (matches the original: full
    silhouette shown from guess one).
  - No fuzzy/typo-tolerant free-text submit — only autocomplete *selection* submits a
    guess, so a submitted code is always unambiguous by construction.
  - Country flags shown per guess row — cosmetic only, not a gameplay signal.

## Review

1. **Mainland-clustering threshold (3,000 km)** in `scripts/worldle/geometry.ts` — a
   distance heuristic, not a political definition. Spot-checked every G20-ish country
   and all multi-part archipelagos via the samples file and it looked right, but worth
   a second human look if a specific day's silhouette ever looks wrong.
2. **Excluded-territory list** (31 codes) — a judgment call on "very small" +
   sovereignty; see the table in `scripts/out/worldle-samples.md` and the reasoning in
   RESEARCH.md. Flag if any exclusion/inclusion looks off (e.g. Hong Kong kept, Macao
   excluded).
3. **Guess-row name truncation at 375px** — long names (e.g. "United Arab Emirates")
   truncate with `truncate`/ellipsis in the narrow name column; readable but tight on
   very small phones. Didn't widen it further since it fits the 5-column grid without
   wrapping the distance/arrow/% columns.
4. Ran full win and loss playthroughs by hand against the local dev server (ports
   confirmed clean afterward) across 3+ different `?date=` days, confirmed: restorable
   state after reload, confetti + ResultModal + friends board on win, answer reveal +
   streak reset on loss, no console errors.
5. Accessibility fixes made during final review:
   - Added screen-reader-only compass text (`Direction: northeast`, etc.) next to the
     `aria-hidden` arrow glyph in `GuessRow` — the arrow alone had no text alternative
     for the direction feedback.
   - The proximity badges (mid/low/cold) were white text on their background colours,
     measuring 2.4-2.8:1 contrast — well under WCAG AA's 4.5:1 for small bold text.
     Fixed by giving each badge variant its own text colour in `theme.css` (white only
     on the dark-green "high" badge; `--game-fg` on the lighter mid/low/cold ones),
     verified computationally (sRGB relative-luminance contrast ratio) and visually.

## Shared changes requested (phase 1)

None. (See "Redesign (2026-10, phase 2)" below for a phase-2 shared-change request.)

## Licences

None — no code copied from any prior-art project (see RESEARCH.md §2–3: none of the
candidate repos had a licence that would allow copying; the W3C APG combobox pattern
used for the autocomplete is a public spec, not code).

## Known issues

- None found. `pnpm test` (108 tests, 10 files) and `pnpm build` pass; `dist/` was
  checked for no puzzle-content leakage (only non-secret silhouette/name assets).

## Redesign (2026-10, phase 2)

`theme.css` was already redesigned by the time this agent ran (per the task prompt) — the only
work this pass did was wiring `src/games/worldle/components/CountryAutocomplete.tsx` onto the
shared `GlideCombobox` (`src/components/fx/GlideCombobox.tsx`), replacing its own hand-rolled
listbox/arrow-key/Enter-commit logic. Nothing else in the game (silhouette, distance/arrow/%
feedback, `GuessRow`, `index.tsx`, `logic.ts`) was touched.

- **Alias search, preserved.** `GlideCombobox` filters a flat `options` list by a single `label`
  per option and has no custom-matcher hook, so handing it one option per country (canonical name
  only) would have silently broken alias search — and this game's own `howTo` text promises it
  ("nicknames and common aliases work too, e.g. 'UAE', 'America'"), which `logic.test.ts` also
  tests via `searchCountries`. Fix: every alias from `country-names.json` gets its own
  `GlideComboboxOption` alongside the canonical name, each `value` prefixed with its real 2-letter
  ISO code (`"AE"` for the canonical row, `"AE#0"` for alias index 0, etc. — codes are always
  exactly 2 letters per `logic.ts`'s own contract, so `value.slice(0, 2)` recovers the real code
  on submit). Canonical-name options are listed before alias options, so the unfiltered list
  `GlideCombobox` shows on an empty-query focus browses real country names first, not aliases.
  Verified live (`playwright-cli`, headed): typing "uae" surfaces and submits the United Arab
  Emirates; typing "united" after guessing AE and US shows only the United Kingdom's rows, with
  no leftover UAE/United States/USA rows and no duplicate-key console warnings.
- **`excludeCodes` → `excludeValues`**, same mapping the prompt described, done by resolving every
  option (canonical + every alias) that starts with an already-guessed code into the `excludeValues`
  set, rather than passing bare codes — needed because option `value`s are no longer bare codes.
- **`onSubmit`, not `resolveFreeText`.** No free-text fallback was wired in, per the task prompt
  — Enter with nothing highlighted calls `onInvalid`, which triggers the same shake animation
  flagle's (not-yet-redesigned) `CountryAutocomplete.tsx` already uses for invalid submits, so an
  unmatched guess shakes the input and the query text is left in place rather than cleared.
- **Lost in the swap, deliberately**: `GlideCombobox`'s `<li>` only ever renders `option.label` as
  plain text, with no slot for the small `fi fi-<code>` flag icon the old suggestion list showed
  next to each row. Flags are untouched everywhere else (each `GuessRow`, and the reveal in
  `ResultModal`'s `extraContent`) — this is a dropdown-only cosmetic loss, not a gameplay change.
- **Duplicate-looking rows, deliberately**: a query that matches both a country's canonical name
  and one of its aliases (e.g. "unit" matching both "United States" and "United States of America")
  shows both as separate rows, since `GlideCombobox` has no way to dedupe across options that
  share a `value` prefix. Confirmed harmless (no React key collisions — every alias row's `value`
  is unique) and not a correctness bug, just a minor list-density regression from the old
  `searchCountries`-backed suggestion list, which deduped to one row per country.

### Verification

- `pnpm test` (108 tests) and `pnpm build` pass.
- `node scripts/check-scope.mjs worldle` passes.
- Live-tested with `playwright-cli` (headed, for `FluxLines`): typed-alias guess submit, mouse-click
  alias-row submit, Enter-with-no-match shake/reject, exclude-already-guessed across both canonical
  and alias rows, Arrow-key re-navigation, reload-mid-game state restoration, 375px and 1280px
  screenshots, and a full `console` check (0 errors/warnings, no duplicate-key noise).

### Review

1. The duplicate-alias-row cosmetic issue above — acceptable as shipped, but if it reads as
   cluttered in practice, the real fix is a shared-component change (next item), not a per-game one.
2. Long alias rows (e.g. "United Kingdom of Great Britain and Northern Ireland") wrap to two lines
   in the dropdown at 375px — readable, not clipped, didn't adjust `GlideCombobox`'s row height
   since that's a shared component.
3. Flags no longer appear in the suggestion dropdown (see above) — confirm this reads fine without
   them; they're still shown on every guess row and the final reveal.

## Shared changes requested

- `GlideCombobox` (`src/components/fx/GlideCombobox.tsx`): an optional per-option `keywords?:
  string[]` field (matched for filtering, never rendered) would let a consumer offer alias/synonym
  search without needing one row per alias — removing both the duplicate-row cosmetic issue and
  the `value`-prefix-encoding workaround this file uses to get alias matching out of a
  single-`label`-per-option filter. Travle's `CountryCombobox` likely wants the same thing (its
  current component also matches name-or-alias).
