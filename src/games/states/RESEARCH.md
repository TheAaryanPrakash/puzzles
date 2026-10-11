# states (Indian States) — RESEARCH

## 1. Original rules — Worldle

[Worldle](https://worldle.teuteuf.fr/) ([FAQ](https://worldle.teuteuf.fr/faq)) is the template this game
localizes to India:

- 6 guesses. Each guess is typed into a search box and must resolve to a valid territory.
- Feedback per guess: **distance** (km, between the two territories' centers), a **direction arrow**
  (one of 8 compass glyphs — the game doesn't try to be more precise than that), and a **proximity
  percentage** (100% = correct, 0% = the farthest two points can be from each other).
- The percentage is also shown as 5 squares, the percent **rounded down to the nearest 10**, 1 green
  square per 20%, 1 yellow square for a remaining 10% (e.g. 72% → floor to 70% → 🟩🟩🟩🟨⬛). This
  exact example from the FAQ fixed the rounding rule for `buildSummary` below.
- Share text is a spoiler-free grid of these squares, one row per guess.
- Very small territories are excluded from repeating within 7 days (a sizing rule, not a scoring one).

Worldle itself isn't open source, so its exact proximity formula (distance ÷ some max, scaled to
0–100) is inferred from the FAQ's two anchor points (0% at antipodal, 100% at the target) — which is
exactly what `src/lib/geo.ts`'s `proximityPct(distanceKm, maxDistanceKm)` already implements
(linear in distance, clamped to [0,100]), confirming the foundation agent built it from the same
source. This game reuses it unchanged, just with `maxDistanceKm` scaled to India (see §4) instead of
the whole Earth.

## 2–3. Prior art

| Project | Approach | Strengths | Known issues / gaps | Licence |
|---|---|---|---|---|
| [Worldle](https://worldle.teuteuf.fr/) (teuteuf) | Closed-source SPA; silhouette + search box + distance/direction/%. The reference for feel and the squares-rounding rule. | Extremely well-tuned difficulty curve; squares rule confirmed above. | No source to read; small-territory handling is sizing-only, not scoring. | None (reference only, no code reused) |
| [amckenna41/flagle](https://github.com/amckenna41/flagle) | MIT, React. Same Worldle-style distance/direction feedback, but for flags; ships country+subdivision data and flag SVGs. | Real, readable open-source implementation of the Worldle feedback loop; MIT so reusable. | Docs don't show its autocomplete or small-territory handling in detail (not read past the repo page). | MIT |
| [Fry1997/world](https://github.com/Fry1997/world) ("Nearer") | Open-source Vite app: border-to-border distance per guess, "closer/farther than your last guess," no percentage score. | Simple, confirms a border-distance alternative to centroid distance exists. | No percentage/arrow — a strictly simpler mechanic than Worldle's, not what the task asks for. | Not confirmed in the page fetched; not copied either way. |
| GitVerse "India state guessing game" (Python) | Blank-map, type-all-30-states-you-remember quiz; not daily, not Worldle-style. | Confirms no existing Indian Worldle clone to crib from — this is a genuine localization, not a port. | Different genre entirely (recall quiz, not a silhouette-guess-with-feedback game). | N/A, not used |

No code is copied from any of these — Flagle's distance/direction *idea* (not its code) is the one
genuinely reused concept, and `src/lib/geo.ts` already implements it independently. See HANDOFF.md's
Licences section ("None").

## 4. Chosen approach

**Data.** `public/assets/shared/india-states.json` is a TopoJSON topology, object key
`india-states-full`, 36 features (28 states + 8 UTs, current post-2019 J&K/Ladakh split and
post-2020 Dadra-Nagar-Haveli/Daman-Diu merger — confirmed by counting: no stale or missing
territory). Each feature has `properties.code` (`"IN-KA"` style) and `properties.name`.

**Silhouettes.** `topojson-client`'s `feature()` turns the topology into GeoJSON; for each feature,
`d3-geo`'s `geoMercator().fitExtent(...)` + `geoPath()` produces an SVG path **fitted to its own
320×320 frame**, independent of every other state — exactly how Worldle renders tiny Vatican and
huge Russia at the same comfortable size. The alternative (one shared projection/scale for all 36,
so relative size is "honest") would make Lakshadweep and Chandigarh nearly invisible next to
Rajasthan — worse for a guessing game, which only needs the *shape* to be recognizable. Archipelago
UTs (Andaman & Nicobar, Lakshadweep) and multi-part states (Gujarat, Maharashtra, Tamil Nadu, Uttar
Pradesh, West Bengal, Andhra Pradesh, Kerala, Madhya Pradesh, Puducherry's 4 enclaves, the merged
Dadra-Nagar-Haveli-Daman-Diu) render with real gaps between their parts, same as Worldle does for
Indonesia or the Philippines — left as-is, not "fixed," since it's still the correct shape.

Path coordinates are rounded to 1 decimal place before being written (389 KB → still 389 KB of text,
*raw* paths were 515 KB; the difference is invisible at a 320-unit frame — 0.1 unit is sub-pixel at
every size this ever renders at) to shrink `public/assets/states/silhouettes.json`, which also carries
each state's `name` and `centroid` — the game needs the full roster client-side anyway (for
autocomplete and for computing every guess's own distance to the answer, not just the answer's
distance to itself), so one asset file serves both the "silhouette" requirement and the "name +
geo" lookup a guess needs, instead of two nearly-identical files.

**Distance scaled to India, not Earth.** The generator computes the **maximum pairwise centroid
distance among all 36 territories** (≈ Gujarat ↔ Arunachal Pradesh corner, in practice) and writes
it as `maxDistanceKm` in the same file. `proximityPct(distanceKm, maxDistanceKm)` (already generic
in `lib/geo.ts`) is called with this instead of the antipodal default — so the worst possible guess
inside India still reads as 0%, instead of the mid-90s% every guess would show if scaled to the
whole planet (India is small compared to Earth's antipodal distance; without this, the percentage
column would be nearly useless — always 85–100%).

**Aliases.** India has renamed several states/UTs since independence, and a friend might type the
name they grew up with. `STATE_ALIASES` in `logic.ts` maps old/short names to the current code:

| Typed | Resolves to | Why |
|---|---|---|
| Orissa | Odisha (`IN-OD`) | Renamed 2011 |
| Mysore | Karnataka (`IN-KA`) | Renamed 1973 |
| Madras | Tamil Nadu (`IN-TN`) | Renamed 1969 (the *state*; the city became Chennai separately in 1996 — not a state alias) |
| Pondicherry / Pondy | Puducherry (`IN-PY`) | Renamed 2006 |
| Uttaranchal | Uttarakhand (`IN-UK`) | Renamed 2007 |
| NCT of Delhi / National Capital Territory of Delhi / New Delhi | Delhi (`IN-DL`) | Official long form / common name people actually type |
| Andaman and Nicobar Islands | Andaman & Nicobar (`IN-AN`) | "Islands" suffix people add that the canonical name drops |
| Daman and Diu | merged UT (`IN-DH`) | Pre-2020 separate UT, now part of "Dadra and Nagar Haveli and Daman and Diu" |
| Dadra and Nagar Haveli | merged UT (`IN-DH`) | Same merge, other half |
| Chattisgarh | Chhattisgarh (`IN-CG`) | Common misspelling |
| UP / MP / AP / TN / WB / HP / MH / KA / GJ / RJ / PB / HR / KL / TG | their states | Short forms Indians actually use day to day |

`normalizeStateName()` also folds `&` → `and`, strips punctuation, lowercases, and collapses
whitespace, so canonical names already spelled with `&` (e.g. "Jammu & Kashmir", "Andaman & Nicobar")
match a guess typed with "and" (or vice versa) with no separate alias entry needed.

**Deliberately left out:**
- **"Bombay"** — the former Bombay State (1950–60) split into today's Maharashtra *and* Gujarat, so
  there's no single correct code to alias it to; aliasing it to either would be wrong half the time.
  A player who types it gets "not found," same as any other invalid guess.
- **"UK" for Uttarakhand** — the common vehicle-registration abbreviation, but far too likely to be
  read as "United Kingdom" by anyone typing fast; omitted to avoid a confusing silent match.
- **"United Provinces" → Uttar Pradesh**, **"Travancore-Cochin" → Kerala**, **NEFA → Arunachal
  Pradesh** — genuine pre-1956 history, but obscure enough that almost nobody would type them; adding
  them risks a false-positive match for someone trying (and failing) to name a *different*,
  similarly-obscure historical unit. Left out; can be added later from HANDOFF.md if a friend asks.
- **Ambiguous 2-letter clashes** (e.g. "KA" could also look like a typo prefix of several names) —
  only unambiguous, commonly-used short forms are aliased; the autocomplete list is the primary path,
  aliases are a convenience for players who skip it.

**State shape.** `{ guesses: string[] }` — a list of state **codes**, in guess order. Codes (not
names) because they're the stable join key into the silhouette/centroid table and are what the day
file's `payload.code` already uses.

**Score.** `guesses.length` on a win (lower is better, same convention a Wordle-style guess
distribution needs), `undefined` on a loss — `ResultModal`'s `statsExtraContent` can later chart a
distribution from `usePlays("states")`'s `score` field without this game inventing its own storage.

**Skills used:**
- `motion-framer` — read for the `useReducedMotion` pattern (every animation here branches on it) and
  spring/variant patterns; used for the guess-row reveal (a short slide+fade stagger across the 4
  feedback cells) and the win/lose silhouette color reveal. Confirmed the installed package exports
  React bindings at `motion/react` (not `framer-motion`) by checking `node_modules/motion/package.json`
  before writing a single import.
- `ui-ux-pro-max` — queried `--domain ux` for combobox/autocomplete and keyboard-navigation guidance
  (predictable tab order, no keyboard traps, visible focus) that shaped `StateCombobox`; queried
  `--domain typography` and `--domain color` for a Poppins-era pairing and a terracotta/indigo/cream
  palette with real hex values and contrast in mind (not inventing colors freehand).
- `playwright-cli` — used via the project's `pnpm shot` wrapper (Playwright Chromium already
  installed by the foundation agent) for 375px and 1280px screenshots, saved under
  `src/games/states/screenshots/`.
- `web-design-guidelines` — fetched the live Vercel Web Interface Guidelines and reviewed `index.tsx`
  and `components/` against them before calling this done (see HANDOFF.md for what that pass found).

## Edge cases (each is a `logic.test.ts` case)

- Win on the 6th (last) guess vs. loss on the 6th guess.
- A correct guess always scores proximity 100% / 5 green squares, regardless of `maxDistanceKm`.
- Alias resolution for every table entry above, both cases ("orissa" and "Orissa") and with `&`/`and`
  interchanged ("Jammu & Kashmir" vs "jammu and kashmir" vs "J&K"-style spacing).
- An unresolvable guess returns `null` from `resolveGuess` and must not be submittable (no wasted
  guess on a typo or nonsense string).
- `isOver` is true the instant a guess matches, even with guesses remaining — no "bonus" extra guess.
- `buildSummary` never contains any state's name or code substring, for every possible answer ×
  every possible guess sequence (exhaustive, not sampled — only 36 states).
- Squares rounding matches the FAQ's own worked example (72% → 🟩🟩🟩🟨⬛) and the boundaries at each
  multiple of 10%.
- State JSON round-trips (`JSON.parse(JSON.stringify(state))`) to an identical game.
- "Bombay" and "UK" resolve to `null` (deliberately not aliased — see above), proving the omission.

## Build plan

1. `scripts/states/silhouette.ts` — pure `buildSilhouette(feature)`, unit-tested on a hand-built
   GeoJSON fixture (not the real 36-state file, so the test doesn't depend on shared data shape
   changing).
2. `scripts/states/pool.ts` — pure `buildScheduleCodes(codes, seed, count)`, unit-tested for the
   "every 36-day window is a permutation, no immediate repeats" invariant.
3. `scripts/states/generate.ts` — wires the topology → silhouettes.json + content/puzzles/states/*.json
   + scripts/out/states-samples.md. Run once for the full `SCHEDULE_DAYS` schedule.
4. `src/games/states/logic.ts` + `logic.test.ts` — aliases, normalization, feedback, win/loss,
   summary — all pure, all the edge cases above.
5. `src/games/states/components/` — `Silhouette` (fetches/renders the SVG), `StateCombobox`
   (autocomplete input), `GuessList` (feedback rows with the signature reveal animation).
6. `index.tsx` wiring `usePuzzle`/`usePlay` per the contract; `theme.css` (terracotta/indigo/cream,
   Poppins); screenshots; `pnpm test` + `pnpm build`; HANDOFF.md.
