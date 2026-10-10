# Flagle — RESEARCH

## 1. Original rules

Flagle (flagle.io / flagle.app) is a Wordle-inspired daily flag game. The read-only "how to play"
text on the site and in app-store listings for its clones agrees on this shape: one secret country
a day, **6 guesses**, typed through an autocomplete. The classic version shows the flag **zoomed in
and heavily cropped**, zooming out a little after each wrong guess, and gives **distance + compass
direction** to the correct country after each guess (no official page documents a numeric
"proximity %", but the direction-and-distance pairing is consistent everywhere, including in a
reference guide for the game — [powerupgaming.co.uk's Flagle guide](https://powerupgaming.co.uk/2026/10/03/flagle-answer-today/),
the clearest free-text description of the rules found; treated with caution since it's an
unofficial fan guide and even contradicts itself on a given day's answer, but its mechanical
description — 6 guesses, progressive flag reveal, distance hint, miss-all-six reveals the answer —
matches every clone below and the task prompt). Our task prompt deliberately swaps the zoom-crop
reveal for a **2×3 grid of opaque tiles over the full flag**, one tile lifted per wrong guess — see
"Chosen approach" for why that's a better fit here and not just a rules shortcut.

## 2–3. Prior art

| Project | Approach | Strengths | Known issues / edge cases | A11y & mobile | Licence |
|---|---|---|---|---|---|
| [amckenna41/flagle](https://github.com/amckenna41/flagle) | React + TS + Tailwind. Direction + distance hint per guess using country lat/lon centroids (Google public dataset) and `flag-icons` for flag art; subdivision flags added from Wikipedia for territories. | Closest architecture to ours: React, `flag-icons`, geo-distance feedback, autocomplete. Confirms `flag-icons` is the right source for crisp small flags (vector SVG, not a fixed-resolution PNG sprite sheet, so it stays sharp at tile size). | Mixes full countries and subnational flags in one pool without clearly documenting how autocomplete disambiguates them. | CRA-based, no stated a11y audit. | **MIT** |
| [khui0/flaggle](https://codeberg.org/ju4b... / github mirror) | Svelte/SvelteKit + TS. Three modes (Classic/Lightning/Daily); feedback is a **similarity score** against the target's flag *attributes* (colours, emblem, etc.) rather than geography. Fuzzy-search autocomplete, Tab-to-accept-first-match, search by ISO code. | The fuzzy-match + "search by ISO code" autocomplete UX is worth copying: typing "fr" should surface France even before the user finishes typing the full name. Visual-similarity feedback is a neat idea for a *flag* game specifically (more on-theme than geography), but it needs a hand-built per-flag attribute table we don't have time to build and verify for 231 countries — noted under "deliberately left out". | Not React/Tailwind (Svelte), so no code reuse, only UX ideas. | Repo page didn't surface a licence string — nothing copied from it regardless. |
| [eddmann — "Building a Flag Guessing Game using React Hooks"](https://eddmann.com/posts/building-a-flag-guessing-game-using-react-hooks/) | Tutorial-grade CRA + Hooks walk-through of a simple (non-daily, non-Wordle) flag quiz: show a flag, pick the right name from 4 options. | Clean example of keeping all quiz state in a single reducer/hook and treating "what's revealed so far" as pure derived state — the same pattern this game's `logic.ts` uses for `hiddenTiles`. | No daily puzzle, no streak, no autocomplete — a multiple-choice quiz, not a Wordle clone. | N/A (tutorial, not a finished app). | Blog post, no licence; nothing copied verbatim. |

Also checked **[janschupke/flags](https://github.com/janschupke/flags)** (Svelte quiz, not a daily
Wordle-style game — skipped as a close comparator) and the task's own sibling, `worldle` (shares this
repo's `lib/geo.ts` distance/bearing/proximity formulas and `public/assets/shared/countries.json`
centroid data — see "Shared changes requested" for why Flagle precomputes its own small centroid
table instead of importing Worldle's).

**Rendering flags small — the research focus.** `flag-icons` ships each flag as a hand-vectorized
SVG (not a cropped PNG sprite sheet like some older flag kits), sized via `.fi`'s `1.333333em` ×
`1em` box (a 4:3 box, matching real-world flag proportions for the vast majority of countries).
Because it's vector, a flag dropped into our 2×3 tile grid — where each visible sliver can be as
small as ~90×75px on a 375px-wide phone — stays crisp with no JPEG-block or scaling artefacts, which
a fixed-resolution PNG set would show at that size. The one real risk at small size is **detail-heavy
flags** (coats of arms with fine text/line work: Mexico, Belize, many Caribbean flags) becoming
unreadable when 5 of 6 tiles still cover them — not a bug to fix, just a reason the game is
genuinely hard early and gets easier as tiles lift, matching the source game's difficulty curve.

## 4. Chosen approach

- **Reveal mechanic — tile grid, not zoom-crop (deviation, per the task prompt).** The task
  explicitly asks for "the flag under a 2×3 grid of tiles; each wrong guess reveals one tile", which
  is a different (and for a small 4:3 flag, more legible) mechanic than the original's zoom-crop.
  Zoom-crop needs a dynamically positioned/scaled viewport clipped to the flag's bounding box, which
  gets fiddly for flags with important detail near the edges (e.g. UK's canton). A fixed 2×3 tile
  grid is simpler, fully deterministic, and still builds suspense the same way. Built in
  `components/FlagTiles.tsx`.
- **Reveal order is derived from the puzzle `date`, not stored in the day file.** The task's day
  file is `{ code }` only. Rather than smuggling a 7th field in for "which tile falls in which
  order", `logic.ts`'s `revealOrder(date)` seeds `mulberry32` from a hash of the date string (same
  PRNG `lib/daily.ts` already exports) and Fisher–Yates shuffles `[0..5]`. Same date → same order for
  every player, every device, with zero extra puzzle-file surface area.
- **One tile never auto-reveals.** 6 guesses, 6 tiles, one tile lifted per *guess made* (right or
  wrong — though a correct guess always ends the game immediately, so in practice it's always a
  wrong guess doing the lifting). Capping reveals at `TOTAL_TILES - 1` means the last tile is still
  covering something right up until the game ends — the 6th guess is made with 5 of 6 tiles gone, not
  a fully-exposed flag, which keeps the final guess meaningful. `ResultModal`'s `extraContent` shows
  the fully uncovered flag + name once the round is over (database/local-adapter already enforces
  "no play again", so there's no risk of that reveal leaking into an active round).
- **Geo feedback reuses `lib/geo.ts`** (`distanceKm`, `bearing`, `bearingArrow`, `proximityPct`) —
  exactly Worldle's formulas, which is intentional: a friend who's played Worldle already knows how
  to read "↗️ 1,240 km · 78% close" without a new mental model.
- **Autocomplete** matches on country `name` **and** `aliases` from
  `public/assets/shared/country-names.json` (prefix-insensitive, case-insensitive, substring match —
  not full fuzzy edit-distance; 231 entries is small enough that a simple substring filter stays fast
  and predictable), filters out already-guessed countries, and is a proper ARIA combobox (role,
  `aria-expanded`, `aria-activedescendant`, arrow-key + Enter + Escape) per `ui-ux-pro-max`'s
  Accessibility (critical) and `web-design-guidelines` keyboard-navigation rules. Lets a player type
  an ISO code too (`khui0/flaggle`'s idea) since friends who know their geography will want the
  shortcut.
- **Centroids precomputed, not fetched from the full topology at runtime.** `countries.json` carries
  full polygon arcs (needed to *draw* a map, which Flagle never does) — pulling that into the browser
  just to compute one centroid per guess would ship far more data than the game needs. The generator
  precomputes `public/assets/flagle/centroids.json` (`{ code: [lon, lat] }`, ~4 KB) once, offline,
  exactly the "public/assets/<id>/ non-secret runtime files" pattern in CLAUDE.md.
- **Pool size vs. schedule length — a necessary deviation.** The task says "seed 71, no repeats",
  but the full country pool with both a `flag-icons` flag *and* an entry in `country-names.json` is
  **236**, while `SCHEDULE_DAYS` is 365. Strict "no repeats" is impossible for more days than the
  pool has countries, and CLAUDE.md separately requires generators to **throw** if there aren't
  enough valid puzzles for every day rather than silently reuse one. Reconciling both rules the same
  way the `worldle` prompt spells out explicitly ("no repeats *until the pool is used up*"): shuffle
  the pool with `mulberry32(71)`, use it in order, and once exhausted reshuffle
  (`mulberry32(71 + cycle)`) and continue — with a boundary check that swaps the new shuffle's first
  country if it would otherwise repeat the just-used last one. Documented here and in `HANDOFF.md`
  per CLAUDE.md's "Deviations... are welcome when the research supports them".
- **Five uninhabited territories dropped after reading the generator's own output.** The first
  generator run's `scripts/out/flagle-samples.md` happened to sample "French Southern and Antarctic
  Lands" (`TF`) as one of 5 random days — not a fair or fun flag for a friend to recognise, since
  nobody lives there. Checking the rest of `country-names.json` by hand for the same problem turned
  up four more scientific-station-only/no-permanent-population entries: `AQ` Antarctica, `GS` South
  Georgia & the South Sandwich Islands, `HM` Heard Island & McDonald Islands, and `IO` British Indian
  Ocean Territory. All five are excluded (`scripts/flagle/pool.ts`'s `EXCLUDED_UNINHABITED`),
  bringing the real, playable pool to **231** countries — population size alone isn't disqualifying
  (Niue, Pitcairn, Vatican City all stay), only having zero residents is.
- **Theme.** Neutral background, `Inter` throughout (per the task), a cool slate palette (checked
  against `ui-ux-pro-max`'s `color` domain for a puzzle-game palette, then simplified to a true
  neutral: flags are the colour; the UI shouldn't compete) with a single blue accent for focus states
  and the "guess" button, and the shared `--tile-correct` / `--tile-absent` tokens repurposed for the
  geo-feedback rows (green when a guess is correct, muted grey text for distance/direction otherwise
  — no amber "present" state exists in a one-target geo game).
- **Motion** (via `motion-framer`): each tile lift is a 3D flip (`rotateY` + `opacity`, driven by
  Motion's `AnimatePresence`/`exit`, with a `perspective` wrapper), each new guess row slides/fades
  in, and a wrong guess gives the input a short shake (`x: [0, -8, 8, -8, 0]`). All of it is gated by
  `useReducedMotion()` (duration → 0, no transform) rather than relying only on the shared CSS
  `prefers-reduced-motion` override in `brand.css`, since Motion drives these with JS, not CSS
  transitions.

## Edge cases (each is a test in `logic.ts`'s or the generator's test file)

- Win on the very first guess (0 tiles ever lifted) vs. win on the 6th/last guess (5 tiles lifted).
- Loss after 6 wrong guesses: `isLost` true, `hiddenTiles` still has exactly 1 entry (the cap), the
  flag is still not 100% tile-revealed by the mechanic alone — `ResultModal` does the final reveal.
- `revealOrder(date)` is always a permutation of `[0..5]` (no duplicate/missing index), is stable for
  the same date across repeated calls, and differs across at least a sample of different dates.
- `hiddenTiles` length is monotonically non-increasing as guesses accumulate, and never negative.
- Geo feedback for a correct guess: `distanceKm === 0`, `proximityPct === 100`, no divide-by-zero in
  `bearing` (guard: same point → bearing defined as 0, arrow "🎯" not a compass glyph).
- Geo feedback for a guess/target pair missing from the centroid table returns `null` rather than
  throwing (defensive — every pool country has a centroid by construction, but a hand-typed ISO code
  from a test shouldn't crash the page).
- `buildSummary` never contains the target's ISO code or, transitively, its name (tested against the
  whole 231-country pool, not a handful of samples, since the emoji-grid summary only ever encodes
  right/wrong per guess — there's no numeric index into the pool to accidentally leak).
- State round-trips through `JSON.parse(JSON.stringify(...))` to an identical game (guesses array of
  plain strings — no Date/Map/Set objects that don't survive JSON).
- Generator: every one of the 365 scheduled days gets a puzzle; the 237th day (first day of the 2nd
  shuffle cycle) never repeats the 231st day's country; every written code exists in both
  `country-names.json` and has a `flag-icons` 4×3 SVG.

## Deliberately left out

- **No visual-similarity hint** (`khui0/flaggle`'s idea) — would need a hand-built per-flag colour/
  emblem attribute table for all 231 countries, unverifiable in the time available, and the task
  explicitly asks for geo feedback instead.
- **No zoom-crop reveal** — superseded by the task's tile-grid requirement (see "Chosen approach").
- **No "give up" button** — none of the clones offer one in daily mode, and `isOver` already blocks
  input once `MAX_GUESSES` is reached; a loss is always reachable by just guessing badly.
- **No guess-distribution chart in `ResultModal`'s `statsExtraContent`** — `usePlays`' `score` field
  (guesses-to-win) is there for a future pass to build one, but a single-country-per-day game doesn't
  get much value from one versus the shared played/win%/streak row already in `ResultModal`.

## Build plan

1. `logic.ts` + `logic.test.ts` — pure functions: `revealOrder`, `hiddenTiles`, `isWon`/`isLost`/
   `isOver`, `feedbackFor` (geo), `buildSummary`.
2. `scripts/flagle/generate.ts` + test — pool-building, cycle-safe shuffle, centroid precompute,
   writes `content/puzzles/flagle/*.json`, `public/assets/flagle/centroids.json`,
   `scripts/out/flagle-samples.md`.
3. `meta.ts`, `theme.css` — neutral/slate palette, Inter.
4. `components/FlagTiles.tsx`, `components/CountryAutocomplete.tsx`, `components/GuessHistory.tsx`.
5. `index.tsx` — wires `usePuzzle`/`usePlay` to the components per the contract.
6. Screenshots at 375px/1280px, keyboard-only pass, `web-design-guidelines` self-review.
