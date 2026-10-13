# Travle — HANDOFF

## Built

- **Border-adjacency graph** (`borders.ts` + `borders.test.ts`): `topojson-client`'s `neighbors()` over
  the shared `public/assets/shared/countries.json` topology, re-keyed to `iso_a2`, plus a documented
  `BORDER_FIXES` list (Channel Tunnel, Øresund, Hans Island treaty, Johor–Singapore causeway, King
  Fahd causeway, Kazungula Bridge, Djibouti–Somalia) for real connections the polygon graph misses.
  Deliberately does *not* add ES–MA or LK–IN, matching the original game's own rulings (see
  RESEARCH.md). 11 tests cover symmetry, no self-loops, exclaves (Cabinda, Western Sahara), and every
  fix pair.
- **Generator** (`scripts/travle/generate.ts`): seeded `mulberry32(91 + dayIndex)` BFS over the
  adjacency graph picks a `(start, end)` pair with shortest-route length 3–7 for all 365 scheduled
  days, with no repeated pair. `allowedGuessesFor` implements travle's official bracket table.
  `scripts/out/travle-samples.md` reviewed — distribution looks natural, no repeats, no artificial
  skew.
- **Game logic** (`logic.ts`, 30 tests): win/loss via union-find over the induced subgraph on
  `{start, end, ...guesses}`; three-tier guess classification (on-path / adjacent / unconnected);
  country-name resolution (canonical + aliases, case-insensitive); spoiler-free `buildSummary`
  (puzzle number, start/end flag emoji — already visible on screen — result line, colour-emoji grid;
  never a guessed country's name or code). State round-trips through JSON unchanged.
- **UI**: `Map.tsx` (decorative, `aria-hidden` `<svg>` of `d3-geo`-projected country paths, coloured by
  category via CSS custom properties, CSS-transitioned fills), `CountryCombobox.tsx` (full ARIA
  `combobox`/`listbox` pattern, arrow keys + Enter + Escape, matches by name or alias), `GuessList.tsx`
  (the real accessible record of guesses — screen readers hear this, not the map — animated with
  `motion`/`AnimatePresence`, honouring `prefers-reduced-motion` via `useReducedMotion()`). Muted atlas
  palette (sea blue, land beige, terracotta start / teal end pins) in `theme.css`, Inter font.
- Wired into `usePuzzle`/`usePlay` per the contract: `start()` on first guess, debounced `save()` after
  every guess, `finish()` on win or loss, `{ ...DEFAULT_STATE, ...play?.state }` merge for the `{}`
  gotcha, `AlreadyPlayed`/`NoPuzzleToday`/`HelpModal`/`ResultModal` all used unmodified.

## Review

1. **Map legibility at a glance** — Sierra Leone (the `end` in the 2026-10-17 sample) is a small West
   African country; on the 960×500 Natural Earth projection its teal fill is easy to miss next to the
   Sudan-sized start country. Worth a look at whether tiny-country endpoints need a marker/pulse, not
   just a fill colour — the guess list text is the accessible source of truth either way, so this is
   cosmetic only.
2. **Three-tier vs. travle's own four-tier colour system** — see "Deviations" below; confirm this
   simplification reads clearly to a non-travle-player before launch.
3. **Border fixes list** — I kept it to the 7 I could verify from public travle FAQ/discussion threads
   plus the mledoze/countries diff (see RESEARCH.md). Worth a spot-check against a few countries a
   friend actually knows well (e.g. Balkans, Central Asia) once the real puzzle schedule is in front of
   people.
4. **Combobox "Guess" button enablement** — only enabled when exactly one suggestion remains or one is
   arrow-key-highlighted; typing an exact full name with multiple partial matches still requires
   arrowing to it or pressing Enter (which resolves the same way). Matches the shared `CountryCombobox`
   keyboard contract but worth a real-keyboard pass by someone other than me.
5. Screenshots at `src/games/travle/screenshots/{mobile,desktop}.png` — taken via `pnpm shot` against
   `?date=2026-10-17` (a mid-schedule day) rather than against "today", since the local adapter's
   "today" depends on `PUZZLE_TIMEZONE` and the sample day was easier to keep reproducible.

## Shared changes requested

None. Built entirely against the frozen `DataSource`/component-prop interfaces and the shared geo
files as published.

## Licences

None — no code copied from the researched open-source Travle clones (travle.earth, geogrid, etc.);
only their rules/UX were used as reference.

## Redesign phase 2 (2026-10)

- **`CountryCombobox.tsx`** now wraps the shared `src/components/fx/GlideCombobox.tsx` instead of
  a hand-rolled listbox (`prompts/redesign/travle.md`'s focus item). `excludeCodes` maps straight to
  `excludeValues`. The dropdown narrows by canonical country name only (same tradeoff
  `StateCombobox` already makes) — a typed alias that isn't a substring of the canonical name (e.g.
  "USA" for "United States") doesn't appear in the filtered list, but resolves correctly through
  `resolveFreeText`, wired to `logic.ts`'s existing (previously unused) `resolveCountryName` helper,
  on Enter with nothing highlighted — exactly the "States' `resolveGuess` pattern" the task prompt
  pointed at.
- New optional `onInvalid` prop on `CountryComboboxProps`, wired in `index.tsx` to the existing
  `REJECT_MESSAGE["unknown-country"]` text. This is a real, newly-reachable path: the old combobox's
  `matches()`-based suggestion list silently excluded already-guessed/endpoint countries, so Enter on
  their exact name was a silent no-op; `resolveFreeText` resolves against the *full* country list
  (not the exclusion-filtered one), so typing an already-guessed country's exact name now correctly
  surfaces "Already guessed."/"That's already one of the endpoints." via `rejectReasonFor` instead of
  doing nothing — verified live (typed "Ukraine" after guessing it: guess count stayed put, the
  existing reject message appeared, no state corruption).
- Live-tested via `playwright-cli` at 375px and via keyboard-only (type → arrow → Enter, and
  type-exact-alias → Enter): filtering, exclusion, alias resolution, invalid-input messaging, and
  focus retention after commit all verified working. `Map.tsx`/`GuessList.tsx` untouched.
- `pnpm test` (836 tests, whole suite) and `pnpm build` both pass; `tsc -b` clean;
  `node scripts/check-scope.mjs travle` passes (2 files changed, both in scope).

### Review

6. **Dropdown alias coverage** — like `StateCombobox`, the live suggestion list only matches the
   canonical name, not aliases; alias text only resolves on exact Enter. If someone wants aliases to
   actually *filter* the dropdown (not just resolve a full match), that needs either a controlled
   `GlideCombobox` query (not currently exposed) or per-alias synthetic options with a value→code
   lookup layer — flagged rather than built, since it wasn't asked for and adds real complexity for a
   rarely-hit case (most country aliases are substrings of or close to the canonical name already).

## Known issues

- **`@types/topojson-client`'s own type dependencies** (`geojson`, `topojson-specification`) aren't
  declared dependencies of this package, so `tsc -b` can't resolve direct imports of those two module
  names from `src/` under pnpm's strict linking — even though the packages are physically present
  (pnpm scopes them to `@types/topojson-client`'s own subtree). Worked around by pulling the needed
  types structurally off functions that are already properly resolvable (`Parameters<typeof feature>`,
  `d3-geo`'s own re-exported `ExtendedFeature`/`ExtendedFeatureCollection`/`GeoGeometryObjects`
  aliases) instead of importing `"geojson"`/`"topojson-specification"` directly. No new packages were
  added. If another game agent hits the same `tsc` error for the same reason, this file's imports are
  a working pattern to copy.
- Border-adjacency data is necessarily a judgement call in a few spots (see RESEARCH.md's "deliberately
  not added" list) — flagged for the human review pass rather than silently guessed at.
