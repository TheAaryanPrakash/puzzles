# Worldle — RESEARCH

## 1. Original rules

[worldle.teuteuf.fr](https://worldle.teuteuf.fr/) / its [FAQ](https://worldle.teuteuf.fr/faq):

- A silhouette of a country/territory is shown (no outline reveal, no zoom hints — the full shape
  is visible from guess one). Six guesses, free text with autocomplete.
- After each wrong guess you get three pieces of feedback: **distance** (km/mi between the guess
  and the answer), **direction** (a compass arrow — the bearing from the guess *to* the answer),
  and a **proximity %** (100% = correct, 0% = the antipodal point — the farthest two places on
  Earth can be from each other).
- The share result is a grid of colour-coded squares (closeness buckets) plus arrows, never the
  country name — Wordle-style spoiler-free sharing.
- Worldle's own source was never published (no licence to check; teuteuf never open-sourced it),
  so it can't be read directly — the FAQ and player write-ups are the only primary sources.

## 2–3. Prior art

| Project | Approach | Strengths | Known issues / gaps | Accessibility | Mobile | Licence |
|---|---|---|---|---|---|---|
| [amckenna41/flagle](https://github.com/amckenna41/flagle) — React flag-guessing game, explicitly modelled on Worldle's feedback loop | Guesses a country from its flag; same distance+direction feedback after each wrong guess | Confirms the "distance + compass arrow" feedback shape is the right mental model to copy; plain React state, easy to read | Flags, not silhouettes — no geometry/projection code to borrow; no licence file found | Not evaluated (not WCAG-audited) | Responsive layout, but no dedicated mobile pass documented | Unclear (no LICENSE in repo) — not used as a code source, only as a design reference |
| hmeleiro/woRLdle — Shiny/R, "Wordle-style game with country border silhouettes" | Renders a country boundary and asks the player to name it | Validates that a plain boundary silhouette (no fill texture, no labels) is enough to make a fun guessing game | R/Shiny, not a web front-end — no reusable code; tiny project (effectively unmaintained) | Not evaluated | Not applicable (Shiny app) | Unclear — reference only |
| Naviamold1/langle — TypeScript, explicitly "based on Worldle" but guesses a *language* by name, reusing the same distance/direction mechanic for a different secret | TypeScript port of the Worldle guess-loop shape (distance/direction feedback, 6 tries) applied outside geography | Shows the feedback loop generalizes cleanly past "guess a country" | Tiny/unmaintained; no accessibility work documented | Not evaluated | Not evaluated | Unclear — reference only |
| [W3C APG Combobox (editable, list autocomplete) pattern](https://www.w3.org/TR/wai-aria-practices-1.2/examples/combobox/combobox-autocomplete-list.html) | Not a Worldle clone — the canonical accessible-autocomplete reference | `role="combobox"` on the input, a owned `role="listbox"` popup, `aria-expanded`/`aria-controls`/`aria-activedescendant`, arrow-key navigation, Enter to commit, Escape to close | N/A (a spec, not an app) | This *is* the accessibility spec | N/A | Public W3C spec — pattern only, no code to copy |

No candidate above has a licence that would let us copy code (two have no LICENSE file at all, the
third is a spec document), so the build below is from scratch, using the W3C combobox pattern as
the accessibility blueprint and the FAQ as the mechanics source. Nothing is copied.

## Key engineering problem found during research: country geometry isn't just "the country"

Natural Earth's admin-0 country polygons (the basis of `public/assets/shared/countries.json`)
bundle a sovereign state's overseas pieces into the **same** multi-polygon feature as its mainland.
Checking bounding boxes directly confirms this is severe enough to break a naive
"`d3.geoMercator().fitSize(viewBox, feature)` per country" approach:

| Code | Feature | Bounding box (lon, lat) | Why |
|---|---|---|---|
| FR | France | `[-61.8, -21.4]` → `[55.8, 51.1]` | Includes French Guiana, Réunion, Mayotte, Martinique… |
| US | United States | `[172.5, 19.0]` → `[-66.9, 71.4]` (wraps the antimeridian) | Includes Alaska + Pacific islands |
| CL | Chile | mainland to `-109.4°` lon | Includes Easter Island, ~3,500 km offshore |
| ZA | South Africa | mainland to `-47°` lat | Includes the Prince Edward Islands |
| AU | Australia | mainland to `-54.7°` lat | Includes Macquarie Island |

Fit a bounding box around the *whole* multipolygon and the mainland shrinks to a sliver next to a
far-off dot — unrecognizable and not what a player means by "France's shape". The real Worldle
silhouette for France is just mainland France + Corsica.

**Fix:** before projecting, cluster a feature's polygon rings by geodesic distance from the
largest-area ring (the "anchor") and keep only the rings within `MAINLAND_CLUSTER_KM` (3,000 km) of
it. This keeps naturally-attached archipelagos (Indonesia, Philippines, Japan, Greece, the UK +
Northern Ireland, Hawaii-less continental US) intact while dropping genuinely remote overseas
territories that happen to share the parent's feature. It's implemented as a pure, tested function
(`scripts/worldle/geometry.ts`) so the threshold choice is easy to revisit.

**Deliberately left out / known limitation:** this is a distance threshold, not a political
definition — it will occasionally cut a legitimate, large, far-flung part of a country (e.g. French
Polynesia is its *own* separate feature/code in this dataset, not part of "France", so that's fine,
but a country whose main population centre happens to sit >3,000 km from its largest landmass could
theoretically be clipped oddly). Reviewed the output for every G20-ish country plus all multi-part
archipelagos in the samples file and it looks right; flagging the threshold here for the human to
revisit if a specific day's silhouette looks wrong.

## Projection choice

Used `d3.geoAzimuthalEqualArea` **rotated to centre on each country's own centroid**, rather than a
single shared Mercator. Reasons:
- Equal-area means a country's shape isn't stretched differently depending on latitude (Mercator
  would exaggerate Norway/Chile/New Zealand north-south relative to equatorial countries).
- Centring the rotation on the country itself sidesteps the antimeridian-wrap problem for
  countries like Russia, Fiji and New Zealand (whose Natural Earth rings span +180°/−180°) — a
  rotation-based projection re-centres the sphere so the feature never needs to be split.
- `d3.geoPath().projection(proj.fitSize([W, H], feature))` after rotating gives a tight, undistorted
  fit for every country with one code path, independent of its size or hemisphere.

Silhouettes are **precomputed to `public/assets/worldle/silhouettes.json`** (as the task requires):
for every playable code, an SVG path `d`, a `viewBox`, and the country's `[lon, lat]` centroid (so
the *game* never needs `d3-geo`/`topojson-client` at runtime just to show a shape or score a guess —
it only draws a precomputed `<path>` and looks up two numbers for the distance/bearing maths in
`lib/geo.ts`).

## Excluding very small territories

CLAUDE.md asks the generator to exclude "very small territories" from the answer pool and list them
in the samples file. Decided this on **sovereignty + size**, not size alone: a day where the answer
is Monaco or San Marino is *meant* to be one of the hardest days (the real Worldle plays them too,
and they're real, well-known sovereign countries) — excluding every tiny place would quietly remove
genuine "countries a friend would recognise by name" just because their silhouette is small.

What actually gets excluded: non-sovereign **dependent territories, Special Administrative Regions,
Crown dependencies, free-association states, and uninhabited/administrative-only territories**
under ~2,000 km² — places that are a *territory of* another country, not a country in their own
right, and small enough that their silhouette is close to an unrecognizable dot. Vatican City is
included in this bucket too: at ~1 km² (literally the smallest sovereign state on Earth, inside a
single city) its silhouette is a featureless rectangle, and — unlike Monaco/San Marino/Liechtenstein
— it isn't a UN member and has no meaningful land-shape to guess from. Macao (SAR of China, ~23 km²)
is excluded the same way, while Hong Kong (SAR of China but ~1,030 km², with the globally recognised
peninsula + islands shape) is **kept**, since it clears both the "big enough to recognise" and "a
distinct, famous outline" bars even though it's also an SAR.

The full excluded list (~30 codes) with reasons is written into `scripts/out/worldle-samples.md` by
the generator itself.

Kosovo, Taiwan, Hong Kong, Palestine and Western Sahara — flagged in the shared data agent's own
README as political-geography choices already baked into `countries.json` — are **not** touched
here: none of them are small (10,900–266,000 km²), so this generator's "very small" rule doesn't
reach them either way, and re-litigating the data agent's political-geography call is out of scope
for this game.

## Autocomplete with aliases

`public/assets/shared/country-names.json` already gives `{ name, aliases: [] }` per code (e.g.
`US` → `aliases: ["USA", "United States of America", "America"]`). The autocomplete only ever
*selects* a code from this list — it never free-text-parses a submitted guess — so alias coverage
is exactly this file's coverage, and a guess is unambiguous by construction (no "which country did
they mean" fuzzy matching to get wrong). Matching is case-insensitive substring match against the
name and every alias, prefix matches ranked first, already-guessed codes filtered out, capped to 8
visible suggestions so the popup never swamps a 375px screen.

Built to the [W3C APG editable-combobox-with-list-autocomplete pattern](https://www.w3.org/TR/wai-aria-practices-1.2/examples/combobox/combobox-autocomplete-list.html):
`role="combobox"` + `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input, an owned
`role="listbox"` of `role="option"` rows, Up/Down to move, Enter to commit, Escape to close,
`aria-autocomplete="list"`. No portal/overlay library — it's a short list under the input.

## Chosen approach — summary

- **Generator** (`scripts/worldle/`): builds the excluded-territory list, clusters each kept
  country's geometry to its mainland, projects it to an SVG path, and writes
  `public/assets/worldle/silhouettes.json` once; a separate seeded-shuffle pool (seed 61, no repeat
  until the pool is exhausted, then reshuffle) assigns one code per day across `SCHEDULE_DAYS` into
  `content/puzzles/worldle/<date>.json` as `{ "payload": { "code": "IN" }, "reserve": null }`.
- **Game**: `logic.ts` has pure functions — `evaluateGuess` (distance/bearing/arrow/proximity via
  `lib/geo.ts`), `isWon`/`isLost`/`isOver`, `searchCountries` (the autocomplete matcher),
  `buildSummary`. `index.tsx` wires `usePuzzle`/`usePlay` to `GameLayout` + the shared modals,
  fetching `silhouettes.json` and `country-names.json` once per mount.
- **State**: `{ guesses: string[] }` — ISO `iso_a2` codes in guess order, restorable, round-trips
  through JSON untouched.
- **Theme**: light grey surface, a dark, almost-black silhouette fill, Inter — a map/atlas feel
  rather than a tile-grid feel.

## Edge cases (each becomes a `logic.test.ts` case)

- Correct guess on try 1 vs. try 6 vs. never (loss after 6 wrong guesses).
- A guess equal to the secret always reports `proximityPct: 100`, `distanceKm: 0`, and no arrow.
- The antipodal guess (literally the farthest possible point) reports `proximityPct: 0`.
- `searchCountries` matches on alias, not just the canonical name (e.g. typing "uae" finds the
  United Arab Emirates; typing "america" finds the United States, not "South America"-anything
  since that's not in this dataset).
- `searchCountries` excludes already-guessed codes from future suggestions.
- `searchCountries` is case-insensitive and trims whitespace.
- State round-trips through `JSON.parse(JSON.stringify(...))` to an identical game.
- `buildSummary` never contains the secret's ISO code or country name, for every code in the pool.
- The geometry clustering helper keeps a close "island" ring and drops a genuinely remote ring
  (synthetic fixtures standing in for e.g. mainland France vs. French Guiana).
- The seeded day-assignment pool exhausts every code before repeating any, and is deterministic
  across runs for the same seed.

## Deliberately left out

- No km/mi toggle — km only. The target audience is India-based friends; a unit toggle is a nice-to
  -have the original site has but it isn't load-bearing for the puzzle.
- No progressive reveal/zoom/rotation hints — the original shows the full silhouette immediately,
  so this does too; no extra hint mechanic invented.
- No fuzzy/typo-tolerant free-text matching on submit — the autocomplete selection *is* the
  validation, which trades "forgives a typo" for "never guesses the wrong thing by accident". A
  player can still type a typo'd alias and simply won't see it suggested, same as mistyping in any
  search box.
- Country flags (`flag-icons`, already installed) are shown next to each guess row for flavour, not
  as a gameplay signal — this is a cosmetic deviation from the baseline, not a mechanic change.

## Skills used

- `motion-framer` — the guess-row entrance (slide/fade in) and the compass arrow's small rotate-in
  on each new guess; both respect `prefers-reduced-motion` (disabled via Motion's `useReducedMotion`).
- `ui-ux-pro-max` — contrast-checked the light-grey/dark-silhouette palette and the proximity-bucket
  colours against WCAG AA on both the map background and inside the result rows.
- `playwright-cli` — screenshots at 375px and 1280px, plus a keyboard-only run (tab to the
  autocomplete, arrow through suggestions, Enter to guess, reach Help/Stats/Archive/Share).
- `web-design-guidelines` — final self-review pass before HANDOFF (see that file).

## Build plan

1. `scripts/worldle/geometry.ts` (+ tests) — mainland-clustering helper.
2. `scripts/worldle/pool.ts` (+ tests) — seeded day-assignment over the eligible code pool.
3. `scripts/worldle/build-silhouettes.ts` — one-shot: writes `public/assets/worldle/silhouettes.json`.
4. `scripts/worldle/generate.ts` — writes `content/puzzles/worldle/*.json` + `scripts/out/worldle-samples.md`.
5. `logic.ts` (+ tests) — guess evaluation, win/loss, autocomplete matching, summary.
6. `components/CountryAutocomplete.tsx`, `components/GuessRow.tsx`, `components/Silhouette.tsx`.
7. `index.tsx`, `theme.css`, `meta.ts`.
8. Dev server check at `?date=` on 3+ days, 375px + keyboard pass, screenshots, HANDOFF.md.
