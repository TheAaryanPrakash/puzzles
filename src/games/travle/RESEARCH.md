# travle — RESEARCH

## 1. Original rules

Primary source: [travle.earth/extra_info](https://travle.earth/extra_info) (official FAQ), cross-checked
against [capitalle.app's "how to play travle"](https://www.capitalle.app/blog/how-to-play-travle) and
["travle strategy"](https://www.capitalle.app/blog/travle-strategy) posts.

- **Core loop.** You're shown a start and an end country. You guess the countries you'd travel through
  by land to get from one to the other, one at a time, in order.
- **Guess allowance** scales with the shortest route's length (number of *intermediate* countries, i.e.
  not counting start/end):

  | Shortest solution (intermediate countries) | Extra guesses allowed | Total guesses |
  |---|---|---|
  | 3 | +4 | 7 |
  | 4–6 | +5 | 9–11 |
  | 7–9 | +6 | 13–15 |
  | 10–12 | +7 | 17–19 |
  | 13+ | +8 | 21+ |

  Our generator only ever produces `shortestLength` 3–7 (per the task prompt), so only the first two
  rows matter here, but `allowedGuessesFor()` in `logic.ts` implements the full table so it stays
  correct if the range is ever widened.
- **Colour meanings (official, 4-tier).** 🟩 green: the guess lowers the number of guesses still needed
  to finish. ✅ check: a green guess that's *also* connected to the start through previously-guessed
  countries. 🟧 orange: within one extra guess of the shortest remaining path. 🟥 red: longer than that,
  or no path at all.
- **Win condition.** Start and end end up connected through a chain of correctly-guessed, mutually
  land-adjacent countries, within the guess allowance.
- **Exclaves.** You can start or end a route inside an exclave, but you must still name every country
  you'd pass through to get there.
- **Border rules.** Bridges and tunnels count as connections. Two regions touching at even a single
  corner count as adjacent. Water crossings only count within a single country's own territory, and
  only in specific cases (see below) — not as a general rule.

### Island / exclave handling (travle's own rulings)
- **Water-hop allowed:** Indonesia and Malaysia's own islands; Northern Ireland to the rest of the UK;
  Greenland ↔ Canada (the 2022 Hans Island border agreement — the first literal land border between
  the two).
- **Not allowed / treated as disjoint:** Angola's Cabinda exclave, Azerbaijan's Nakhchivan exclave,
  Gaza ↔ West Bank, Kaliningrad ↔ the rest of Russia, Ceuta/Melilla ↔ mainland Spain. Travle's own FAQ
  explicitly states **Spain and Morocco are not treated as adjacent**, even though Ceuta and Melilla
  physically touch Moroccan territory — their small size means most country datasets (ours included,
  at 50m resolution) don't render that border at all, so this "ruling" and our data happen to agree
  with no extra work.
- **Known adjacency edge cases from the FAQ:** France–UK (Channel Tunnel), Denmark–Sweden (Øresund
  Bridge + Drogden Tunnel), Russia–North Korea (a real, if short, land border), Morocco–Mauritania
  **not** connected (Western Sahara sits between them).

## 2–3. Prior art

No public open-source clone of Travle itself turned up in searches (GitHub search for "travle" returns
unrelated "travlr"/"TRVLR" trip-tracker apps; Travle is attributed to Teuteuf Games and is closed
source). Closest comparable projects, used for structure/architecture ideas rather than mechanics:

| Project | Approach | Strengths | Known issues | Licence |
|---|---|---|---|---|
| [the-abe-train/globle](https://github.com/the-abe-train/globle) | Daily geo-guessing game, CRA + TypeScript, distance-based feedback | Clean seeded-daily-puzzle pattern, 193★, decent a11y | Different mechanic (distance, not adjacency); no border graph | MIT |
| [amckenna41/flagle](https://github.com/amckenna41/flagle) | Daily flag-guessing game, React | Simple daily-puzzle state machine, good reference for localStorage-based play state | Not adjacency-based either | MIT |
| [mledoze/countries](https://github.com/mledoze/countries) | Static per-country JSON incl. a `borders` (land-border) field per ISO alpha-3 code | Widely used, 8k★+, actively maintained, exactly the kind of reference-quality border list Travle itself would need | A few entries are asymmetric/wrong (see "Border data quality" below) | MIT |

Because there's no mechanical prior art, the generation algorithm (BFS over a land-border adjacency
graph, picking start/end pairs at a target distance) is designed from first principles rather than
adapted from an existing implementation. No code was copied from any of the above — `mledoze/countries`
was used only as a **one-time, dev-time diffing reference** (see below) to sanity-check our own
adjacency graph; its data never ships in the product and isn't vendored into the repo.

## Border-adjacency data quality (the task's specific research focus)

`public/assets/shared/countries.json` is already on `main`: a topojson built by the data agent from
`world-atlas`'s `countries-50m.json`, trimmed to `{ name, iso_a2 }` per feature
(`scripts/_data/build_countries.py`). Running `topojson-client`'s `neighbors()` over its `countries`
object's geometries gives a land-border graph "for free" — but at 50m resolution, a few real borders
are too thin to survive simplification, and a few more are land connections created by bridges/tunnels
that no polygon-boundary approach can ever capture.

To find the gaps methodically rather than guessing, I diffed our computed adjacency against
`mledoze/countries`' `borders` field (fetched once, used only in this research session — see
`scripts/travle/borders.ts`'s doc comment for the full list, there's no vendored copy of that dataset
in the repo). Results:

**Missing from our 50m-derived graph, confirmed as real:**
- `DJ↔SO` (Djibouti–Somalia): a genuine land border along the Gulf of Aden coast; lost to polygon
  simplification at 50m.
- `BW↔ZM` (Botswana–Zambia): the Kazungula Bridge (opened 2021) creates a direct land connection over
  the Zambezi at the Botswana/Zambia/Namibia/Zimbabwe quadripoint — often cited as the world's shortest
  international border.

**Missing from our graph, but only because of a bridge/tunnel/political border (travle counts these):**
- `FR↔GB` — Channel Tunnel.
- `DK↔SE` — Øresund Bridge + Drogden Tunnel.
- `GL↔CA` — the 2022 Canada–Denmark treaty splitting Hans Island, which created the first literal
  Canada–Greenland land border.
- `MY↔SG` — the Johor–Singapore Causeway (road + rail, since 1923).
- `BH↔SA` — the King Fahd Causeway (since 1986).

**Present in `mledoze/countries` but deliberately *not* added, because it's a reference-data error, not
a real border:** `LK↔IN` (Sri Lanka lists India as a border; India's own entry does *not* list Sri Lanka
back — asymmetric, and geographically wrong: the Palk Strait and Adam's Bridge are water/unnavigable
shoals, no usable land route exists). Confirmed by checking the raw `mledoze` records for both
countries directly.

**Present in our graph but absent from `mledoze`, correctly kept (reference's limitation, not our
error):** `FR↔SR`, `FR↔BR` (France, via French Guiana, genuinely borders Suriname and Brazil by land;
`mledoze`'s `borders` field tracks only mainland-France-style borders for many overseas-department
cases and omits these — this is a known limitation of ISO-sovereign-state-level border lists, not a
flaw in our topojson-derived graph).

**Checked and deliberately left unconnected (matches both the real world and travle's own FAQ
rulings):** `ES↔MA` (Ceuta/Melilla; too small to render at 50m, and travle's FAQ explicitly rules this
unconnected anyway), `MA↔MR` (Western Sahara sits between them, and *is* correctly adjacent to both in
our data).

**Spot-checked and already correct with no fix needed:** `RU↔KP`, `GB↔IE`, `HR↔ME`, `AO↔CD`, `AO↔CG`
(Cabinda exclave correctly bridges to its real land neighbours even though it's disjoint from mainland
Angola — exactly how travle treats an exclave), `ID↔MY`/`ID↔PG`/`ID↔TL` (shared-island borders),
`KP↔KR` (the DMZ is heavily fortified but is still a real, touching land border).

All of this — the 7 additions and the reasoning for each — lives as a documented, commented array in
`scripts/travle/borders.ts`, which both the generator and the live game import, so there's exactly one
border graph in the codebase, not two that could drift apart.

## 4. Chosen approach

- **One shared adjacency module** (`src/games/travle/borders.ts`): a pure `buildAdjacencyFromTopology()`
  that takes a parsed topojson object in and returns `Record<iso_a2, iso_a2[]>` out, plus the documented
  `BORDER_FIXES` list above. No `fetch`/`fs` inside it, so it's usable from both the browser (which
  fetches `/assets/shared/countries.json` at runtime) and from the Node generator (which reads the same
  file from disk) — one graph, two callers, matching CLAUDE.md's "games never import Supabase"-style
  separation of data access from logic.
- **Win condition, reinterpreted as a graph problem.** Rather than track travle's full 4-colour
  feedback model (which the task prompt itself simplifies to 3 states: on-path / adjacent /
  unconnected), I model it as: take the induced subgraph on `{start, end, ...guesses}` (an edge exists
  between two of these nodes iff they're really adjacent); a guess is
  - **on-path** if it's in the same connected component as `start` or as `end` in that subgraph (i.e.
    it's part of a contiguous chain anchored to one of the two ends — exactly travle's "✅ connected to
    start" idea, generalised to either direction since a solved route can be built from both ends and
    meet in the middle);
  - **adjacent** if it borders some other guess but its little island isn't (yet) anchored to either
    end — useful progress that just hasn't linked up yet;
  - **unconnected** if it borders nothing guessed so far.

  **Win** = `start` and `end` are in the same component of that induced subgraph (not just within some
  distance — a literal, gapless chain), achieved within `allowedGuesses`. This is simpler to reason
  about and test than travle's live "does this guess reduce remaining distance" heuristic, and it's
  exactly what the task prompt asks for ("won when start and end are connected within the allowance").
- **Guess allowance**: `allowedGuessesFor(shortestLength)` implements the full official bracket table
  (even though the generator only produces 3–7), so the mapping is correct and testable in isolation.
- **Score**: guesses used (lower is better, matching travle's own "golf" scoring description — "a
  perfect score means you found the shortest possible path"). On a win, `score = guesses.length`; the
  summary separately reports `guesses.length - shortestLength` as "+N" or "Perfect route!".
- **Generator**: seed **91** (per the task prompt) feeds `mulberry32(91 + dayIndex)` once per day — a
  fresh, deterministic stream per day, re-derivable without needing the previous day's draws. For each
  day: shuffle the non-isolated countries (`shuffle()` from `lib/daily.ts`) as start candidates; for the
  first candidate with any BFS-reachable country at edge-distance 4–8 (`shortestLength` 3–7
  intermediate countries), shuffle *those* end candidates too and take the first, skipping any
  `(start, end)` pair (in either order) already used earlier in the 365-day schedule so the same puzzle
  never repeats.
- **Country input**: a plain text combobox (ARIA `role="combobox"` + `listbox`, per
  `ui-ux-pro-max`'s "show predictions as user types, debounced" + "icon-only buttons need
  `aria-label`" guidance), matching on `country-names.json`'s `name` and `aliases` (already built by the
  data agent for exactly this purpose), fully usable with arrow keys/Enter/Escape and the physical
  keyboard, no mouse required.
- **Map**: `d3-geo`'s `geoNaturalEarth1` projection + `topojson-client`'s `feature()`, fit to the
  container with `fitSize`, rendered as an inline `<svg>` of `<path>`s coloured by each country's
  current category via CSS custom properties (never raw hex in the component, per `ui-ux-pro-max`'s
  "semantic color tokens" rule) — consistent with "Game pages evoke their original game" (travle's own
  UI is a full interactive map) without forking any shared component.
- **Palette**: muted sea-blue background, warm beige land (ran `ui-ux-pro-max`'s `search.py --domain
  color "map geography game color palette"`; its "Road Trip Planner" result's warm-orange/deep-cyan
  pairing suggested the accent colours: a terracotta for the start pin, a deep teal for the end flag,
  sage-green for on-path, amber for adjacent — distinct from the site's own `--brand-accent` orange so
  the game still feels like "its own place").
- **Motion** (`motion-framer` skill): `layout` + `AnimatePresence` for countries entering the "solved
  chain" (a short scale/opacity pop, per the skill's "Hover/Tap" and "Layout Animations" patterns),
  `staggerChildren` for the guess list, and `useReducedMotion()` (the package installed here is
  `motion`, so `import { useReducedMotion } from "motion/react"`, not `framer-motion`) gating every
  non-essential transition's duration to `0`.

## Edge cases (each is a test)

- Win by chaining purely from `start` outward, purely from `end` inward, and by two floating islands
  that merge into one connected start↔end component on the final guess.
- A guess equal to `start` or `end` is rejected (they're already revealed, not guessable).
- A duplicate guess is rejected.
- An unrecognised country name resolves to `null` (handled in the UI as "no match", never added to
  state).
- A name resolved via an alias (`"UK"` → `GB`) behaves identically to the canonical name.
- Losing at exactly `allowedGuesses` with the chain still incomplete.
- `allowedGuessesFor` covers every bracket boundary (3, 4, 6, 7, 9, 10, 12, 13).
- Classifying a guess as on-path / adjacent / unconnected in a graph with: a direct chain, two
  disconnected islands, and a fully isolated guess.
- State round-trips through `JSON.parse(JSON.stringify(...))` to an identical game.
- `buildSummary` never contains any guessed-country name or code — not even on a win — only a coloured
  emoji grid, the puzzle number, and the (already-visible, non-spoiler) start/end flags.
- `buildAdjacencyFromTopology` is symmetric for every edge, has no self-loops, and reproduces every
  documented fix pair (and only those additions) on top of the raw topojson-derived graph.
- Generator: the same `(seed, dayIndex)` always produces the same day's puzzle (determinism); no two
  days in one schedule share the same `(start, end)` pair; every generated day's `shortestLength` is
  3–7 and its `allowedGuesses` matches the bracket table.

## Deliberately left out

- The official 4-tier colour scheme (green/check/orange/red) and its "does this guess reduce the
  *live* remaining distance" heuristic — replaced with the simpler, task-specified 3-tier
  on-path/adjacent/unconnected model described above. It's easier to reason about, test, and explain to
  a new player, and still rewards exactly the same "build a contiguous chain" behaviour.
- A practice mode / arbitrary start-end picker — out of scope; every member gets the same daily puzzle
  per CLAUDE.md.
- A "weekly challenge" (longer routes) — not in the task prompt.
- Country *shapes* as a hint (e.g. highlighting a country's silhouette before it's named) — travle
  doesn't do this either; the map only reveals colour, never the name, until guessed.

## Build plan

1. `src/games/travle/borders.ts` + `borders.test.ts` — adjacency graph + documented fixes.
2. `src/games/travle/logic.ts` + `logic.test.ts` — pure game logic (classify/win/lose/score/summary,
   guess-name resolution, `allowedGuessesFor`).
3. `scripts/travle/generate.ts` + `generate.test.ts` — BFS day-pair picker, writes
   `content/puzzles/travle/*.json` + `scripts/out/travle-samples.md`.
4. `meta.ts`, `theme.css` — atlas palette, Inter.
5. `components/Map.tsx`, `components/CountryCombobox.tsx`, `components/GuessList.tsx`.
6. `index.tsx` — wires everything into `usePuzzle`/`usePlay` per the contract.
7. Screenshots, `web-design-guidelines` pass, `HANDOFF.md`.
