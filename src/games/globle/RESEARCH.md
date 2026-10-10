# Globle — research

## Sources
- [How to play Globle: rules, tips and gameplay explained](https://nerdschalk.com/how-to-play-globle-rules-tips-and-gameplay-explained/) — basics: one hidden country a day, unlimited guesses, solve in as few as possible.
- [cloudspress.com writeup on Globle's distance rule](https://www.cloudspress.com/?p=428889) — the only source that states the actual rule: Globle measures the **minimum distance between land borders**, not centroids; water/maritime borders and some territories are excluded; the on-globe color is only an approximate visual guide, the real number is shown as text.
- [geographyeducation.org — Globle, the newest online geography game](https://geographyeducation.org/2022/02/04/globle-newest-online-geography-game/) — confirms the globe does not draw political borders, only coastlines; color is the only per-guess feedback on the globe itself, with the distance number given alongside it.
- the-abe-train/globle (surfaced via GitHub search, TypeScript, React) — the commonly-cited original implementation; README/marketing copy confirms "closest border" framing but the repo wasn't read directly (not needed — the mechanic above is simple enough to implement directly against our own data).
- Fry1997/world ("Nearer") — a Globle-style clone; its guess rows report shortest border-to-border distance, closer/farther-than-last-guess, and a closest-so-far list — the same feature set our prompt asks for.
- [earthjs README via unpkg](https://unpkg.com/earthjs@0.7.143/README.md) and the Framer "dotted globe" / "free 3d earth globe" component pages — agree that **SVG gets janky as node count grows** on drag, while a **single `<canvas>`** redraw stays smooth, especially on phones; a common hybrid is canvas for the sphere/countries, SVG/DOM only for a handful of labels. No hard device benchmarks were found; this is directional, not measured.
- `d3-geo` / `topojson-client` docs (already in this repo, MIT/ISC, no new packages) — `geoOrthographic` + `geoPath` for the globe projection and canvas path drawing; `topojson.neighbors()` for exact shared-border adjacency straight from the topology, with no geometry math needed.
- Turf.js docs (`point-to-line-distance`, `distance`) — not installed, not used, but their approach (great-circle point-to-boundary distance, taking the min over the boundary) is the one we reimplement by hand with `d3-geo`'s `geoDistance`.

## Comparison
| Approach | Strengths | Weaknesses | License |
|---|---|---|---|
| Centroid-to-centroid distance (`lib/geo.ts`'s `distanceKm`, used by Worldle) | Already built, trivial | Wrong game: two huge neighbouring countries (e.g. Russia–Kazakhstan) would show as far apart by centroid even though Globle's rule is "neighbours = 0". Doesn't match the original game. | — |
| Exact polygon boundary distance (every vertex pair, full resolution) | Most accurate | 236 countries × up to ~11,500 points (Canada) ⇒ billions of great-circle calls; measured prototype of the naive version would take tens of minutes. Not worth the precision for a puzzle where only the *color bucket* and a rounded km number are shown. | — |
| **Chosen: decimated-vertex min-distance + exact topology-based neighbours** | Fast (~45s one-time precompute, measured), neighbours are exact (not an approximation — they come straight from TopoJSON's shared arcs, so "touches India" is always right), distances are accurate to a few tens of km, which is far tighter than the color bucketing needs. | Decimation (≤25 points/ring) can miss the true closest point on a very convoluted coastline by a small margin; documented, acceptable per cloudspress's own note that the map's visual distance is "only an approximate guide". | — |

## Chosen approach
1. **Neighbours (0 km):** `topojson.neighbors(geometries, topology.arcs)` on `public/assets/shared/countries.json` — two countries that share an arc share a land border. This is exact and doesn't depend on any decimation.
2. **Everyone else:** extract each country's rings with `topojson-client`, drop the closing duplicate point, and decimate every ring to at most 25 points (evenly strided, smallest rings kept whole). For every non-neighbour pair, take the minimum `d3-geo geoDistance(a, b) * 6371` over every (pointA, pointB) combination — i.e. the same "min over boundary points" idea Turf's point-to-line distance uses, just vertex-to-vertex instead of vertex-to-segment (cheaper, and the decimation error already dominates any segment-interpolation gain). An early `return` once a pair is found under 1 km avoids wasted work for close pairs.
3. Matrix is symmetric, so only the upper triangle is computed; written to `public/assets/globle/distances.json` as `{ codes: string[], km: number[][] }` (row/col index = position in `codes`), rounded to the nearest km. 236×236 ≈ 55k cells, ~310 KB.
4. **Answer pool:** 236 features in the shared topology include dependencies/territories Globle-style games don't use as *answers* (Antarctica, Hong Kong/Macau as non-sovereign SARs, and small island territories/dependencies with no meaningful "closest neighbour" story). These are excluded from the **daily answer pool** only — they stay fully guessable (any of the 236 codes can be typed and will be scored, same as the real game lets you guess small islands). The excluded list is written to the samples file for human review, mirroring Worldle's "excluding very small territories (list them in the samples file)".
5. **Day assignment:** `mulberry32(81)` deterministically shuffles the 200-country answer pool, consumed in order for `LAUNCH_DATE … LAUNCH_DATE + SCHEDULE_DAYS − 1`; when the pool runs out mid-schedule it's reshuffled with `mulberry32(81 + cycle)` for the next lap, so the *order* differs each lap but every lap still uses the whole pool before any code repeats — no two of the next 200 days repeat a country, same "no repeats [until the pool is used up]" rule the Worldle prompt spells out explicitly for the same underlying data.
6. **Globe rendering:** `d3-geo geoOrthographic` + `geoPath().context(ctx)` drawn to a single `<canvas>` (devicePixelRatio-scaled), not SVG — per the perf research above. Sphere fill (deep navy), a faint graticule, then every country path filled: unguessed = a barely-visible tint of the navy surface, guessed = the warm proximity color, correct guess = a distinct "solved" color. Drag-to-rotate and wheel/pinch-to-zoom are implemented on raw pointer events (no gesture library needed); rotation and scale are clamped and re-rendered on a `requestAnimationFrame`, not on every pointermove tick, to stay smooth on a phone. Reduced-motion users still get full drag/zoom (it's direct manipulation, not an animation) but the initial "spin in" intro and any guess-highlight pulse are skipped.
7. **Guessing UI:** a text input with keyboard-navigable autocomplete against `public/assets/shared/country-names.json` (name + aliases), exactly like the contract's other country-guessing games — not clicking the globe itself, matching the real Globle (you never need to tap a tiny country to guess it). Already-guessed countries are filtered out of the suggestion list. Unlimited guesses, so the only end state is **won**; there is no loss condition (matches the "no fixed guess limit" reading of the sources — the in-browser game simply has no cap).
8. **Feedback:** each guess shows name, rounded km, a 0–100% proximity bar/badge, and a warm color swatch (pale → deep red as proximity rises to 100, neighbour/0 km and the correct guess get their own distinct colors so they don't collapse visually into "very close but wrong"). A **closest-so-far** list is sorted by proximity, highlighting the best guess at any point — the feature both Nerdschalk and the Nearer clone call out as central to the game.
9. **Spoiler-free summary:** never includes any country name — just the puzzle number, guess count, and a row of colored squares (one per guess, bucketed proximity, with a distinct square for the final correct guess), the same "emoji grid" idea as Wordle's share text. Tested directly (`buildSummary` never contains the secret's code or name, for every code in the pool).

## Edge cases (each becomes a test)
- Two countries that share a land border → distance 0, regardless of centroid distance (Russia–Ukraine, tiny enclaves like Vatican/San Marino inside Italy).
- A country with no land neighbours at all (e.g. an island nation) → neighbour set is empty; that's valid, not a bug.
- Guessing the same country twice → second guess is a no-op (filtered out before it reaches the pure logic), not double-counted in the guess list.
- Guessing the secret itself → distance 0, win, no further guesses accepted.
- `play.state` is `{}` right after `start()` → `{ ...DEFAULT_STATE, ...play?.state }` guards every render.
- Mid-game state → `JSON.stringify`/`parse` round-trip → identical game (guess list, order, and derived "closest so far" are all pure functions of `state.guesses`, so this is automatic as long as `state` only stores primitives/arrays).
- Summary text never contains the secret's ISO code or English name, for the full answer pool.
- Proximity scale is monotonic: a strictly smaller km distance always yields a `>=` proximity score, and both ends are clamped to `[0, 100]`.
- Day-assignment: no two of the first `poolSize` scheduled days repeat an answer code; every scheduled day has a code from the (exclusions-applied) pool; running the generator twice (idempotent) produces byte-identical output.
- Distance matrix is symmetric (`km[i][j] === km[j][i]`) and the diagonal is 0.

## What I'm deliberately leaving out
- No direction/bearing arrow — the real Globle only ever gives color + a km number, never a compass direction (that's Worldle's mechanic, not Globle's); adding one would just be a different game wearing Globle's skin.
- No maritime/EEZ border adjacency — only `topojson`'s land-based shared arcs count as "neighbour", matching cloudspress's note that water borders are excluded from the rule.
- No fixed guess cap / loss state — sources disagree on whether the live game caps guesses at all, and our prompt explicitly says "unlimited guesses", so there is intentionally no `isLost`.
- No segment-interpolated (vertex-to-edge) distance — vertex-to-vertex on a decimated ring is simpler and, given the decimation error already present, not meaningfully less accurate for this game's purposes.
- No hit-testing countries on the globe for input (click-to-guess) — the globe is feedback-only; guessing is through the autocomplete, matching the real game and keeping the globe fully keyboard-independent of guessing.

## Skills used
- `motion-framer` — the guess-row/closest-so-far-list enter animation and the "solved" pulse on the correct country, all gated on `prefers-reduced-motion`.
- `ui-ux-pro-max` — the warm pale→red proximity scale (checked for sufficient contrast against deep navy at every step, not just the extremes) and the autocomplete's accessible listbox pattern (roles, `aria-activedescendant`, arrow-key navigation).
- `playwright-cli` — screenshots at 375px/1280px and a keyboard-only pass (tab to the input, type, arrow through suggestions, Enter to guess; arrow keys also nudge the globe for users who never touch the mouse).
- `web-design-guidelines` — final self-review pass before HANDOFF.md.

## Build plan
1. `scripts/globle/distance-matrix.ts` (pure functions + a `main()`) → `public/assets/globle/distances.json`, with Vitest tests on synthetic tiny topologies.
2. `scripts/globle/generate.ts` (pure `buildSchedule()` + `main()`) → `content/puzzles/globle/*.json` + `scripts/out/globle-samples.md`, with Vitest tests on the pool/no-repeat logic.
3. `src/games/globle/logic.ts` — proximity scale, guess list ops, closest-so-far, spoiler-free summary — pure, fully tested.
4. `src/games/globle/components/Globe.tsx` (canvas globe, drag/zoom/keyboard), `GuessInput.tsx` (autocomplete), `GuessList.tsx` (closest-so-far), `index.tsx` wiring it to the contract, `theme.css` (deep navy, Space Grotesk).
5. Test at 375px/1280px, physical keyboard only, `?date=` on 3+ different days; screenshots; HANDOFF.md.
