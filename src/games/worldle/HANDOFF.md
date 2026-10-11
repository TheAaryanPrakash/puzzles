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

## Shared changes requested

None.

## Licences

None — no code copied from any prior-art project (see RESEARCH.md §2–3: none of the
candidate repos had a licence that would allow copying; the W3C APG combobox pattern
used for the autocomplete is a public spec, not code).

## Known issues

- None found. `pnpm test` (108 tests, 10 files) and `pnpm build` pass; `dist/` was
  checked for no puzzle-content leakage (only non-secret silhouette/name assets).
