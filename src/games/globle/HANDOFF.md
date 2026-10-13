# Globle — handoff

## Built
- **Distance matrix** (`scripts/globle/distance-matrix.ts` → `public/assets/globle/distances.json`):
  exact land-border neighbours (0 km) via `topojson.neighbors`, decimated-vertex min border distance
  for everyone else. 236×236 symmetric matrix, ~284 KB. Tested on synthetic topologies.
- **Day assignment** (`scripts/globle/generate.ts` → `content/puzzles/globle/*.json`): seeded
  `mulberry32(81)`, 199-country answer pool (37 small territories/dependencies excluded from
  *answers* but still guessable — listed in `scripts/out/globle-samples.md`), no repeats within a
  lap, reshuffled per lap so a new lap's order differs. 365 days generated, idempotent.
- **Game logic** (`logic.ts`): proximity %, warm pale→red color scale (eased so the scale doesn't
  turn red after one guess), closest-so-far sort, spoiler-free emoji-grid summary, no loss condition
  (unlimited guesses per the prompt).
- **UI**: a single-`<canvas>` `d3-geo` orthographic globe (`Globe.tsx`) — drag-to-rotate, wheel/pinch
  zoom, and full keyboard control (arrows rotate, +/- zoom, Home resets) independent of guessing;
  guessing is a keyboard-navigable autocomplete (`GuessInput.tsx`) against the shared country-names
  table, never click-to-guess on the globe (matches the real game). `GuessList.tsx` shows every guess
  closest-first with distance/%/swatch, 🏆 on the current best. Deep navy theme, Space Grotesk,
  `flag-icons` for the reveal flag in `ResultModal`.
- Reduced motion: the one-time intro spin and guess-list enter animation are the only motion;
  verified keyboard-only play works under `reducedMotion: "reduce"` (Playwright).

## Deviations from the prompt
- Pool size (199/236) and the excluded-territory list are a research-backed read of "seed 81, no
  repeats" against the shared topology's full 236 features, since the topology includes several
  non-sovereign dependencies with no meaningful "closest neighbour" story as a daily *answer*; they
  remain fully guessable. Full reasoning in RESEARCH.md §4.
- No direction/bearing arrow, no maritime-border adjacency, no segment-interpolated distance, no
  fixed guess cap — each is a deliberate scope call explained in RESEARCH.md's "What I'm deliberately
  leaving out".

## Review
1. **Color scale feel** — `proximityColor` reuses the site's shared `proximityPct` (linear against
   antipodal distance, same function Worldle uses), so a guess a couple thousand km away can already
   read 85–90%+ and look fairly red. This matches the shared math everyone else uses rather than a
   game-specific curve; flag if Globle should feel more gradual than that.
2. **Decimated-vertex distances** — accurate to "a few tens of km" per RESEARCH.md, not exact
   boundary-to-boundary. Fine for the color bucket and a friends game, but worth a sanity spot-check
   on a few convoluted coastlines (e.g. Norway, Indonesia) if it matters later.
3. **Answer pool exclusions** (37 codes, listed in `scripts/out/globle-samples.md`) — human judgment
   call on which dependencies/territories make sense as daily answers; easy to tweak the list in
   `generate.ts` if any should be included or excluded differently.
4. **Bundle size** — `globle`'s CSS chunk is ~423 KB (86 KB gzip), almost all `flag-icons`'s inlined
   per-country SVGs; same cost any game using that library pays. Not addressed here since it's an
   approved shared library, but worth knowing if total bundle size is reviewed later.
5. Screenshots saved at `src/games/globle/screenshots/{mobile,desktop}.png` show an in-progress game
   (globe + guess list) rather than the win modal — swap if a different state is preferred for review.

## Shared changes requested
None.

## Licences
None copied — `d3-geo`/`topojson-client` (already installed, ISC ⁄ BSD) used via their public API only.

## Known issues
None found. `pnpm test` (112 tests, 10 files) and `pnpm build` pass; `node scripts/check-scope.mjs
globle` passes.

## Redesign phase 2 (2026-10) — `GlideCombobox` wiring

Scope was narrow per `prompts/redesign/globle.md`: the globe's colour fixes and `theme.css`
restyle were already done on main before this worktree started (verified live, untouched here).
The only work here is wiring `src/components/fx/GlideCombobox` into the guess input.

- `GuessInput.tsx` is now a thin wrapper around `GlideCombobox` instead of its own hand-rolled
  listbox/keyboard-nav code. `guessedCodes` maps to `excludeValues`. Colors come from the game's
  own tokens (`--game-accent`/`--game-surface-2`/`--game-fg`), matching how `ArchivePicker`
  already feeds `GlideSelect` CSS-var strings.
- **Alias matching moved, deliberately degraded, by design.** The old hand-rolled input matched a
  typed substring against each country's name *and* aliases (e.g. "uae" live-filtered to "United
  Arab Emirates" as you typed). `GlideCombobox` only filters its live dropdown by each option's own
  `label` — it has no secondary search-key field — so that per-keystroke alias matching is gone.
  What's preserved: typing an alias out in full and pressing Enter still resolves correctly, via
  `GlideCombobox`'s `resolveFreeText` hook (its own doc comment calls this out as the intended use —
  "the way States' `resolveGuess` does"). New `logic.ts` functions `buildCountryNameIndex`/
  `resolveCountryGuess` build that lookup (name + every alias, normalized), mirroring
  `states/logic.ts`'s `resolveGuess`/`nameIndex` pattern. Verified live (`playwright-cli`): typing
  "UAE" and pressing Enter correctly guesses United Arab Emirates even though "UAE" never appears
  in the dropdown while typing. 5 new Vitest cases cover the index (name, alias, case/whitespace,
  no-match, a code missing from the names table).
- No "Guess" button any more — the old side button just submitted the top suggestion, redundant
  with `GlideCombobox`'s own Enter/click-to-commit, and the component has no imperative API a
  separate button could drive.
- Verified live at 375px and desktop width, physical-keyboard only (type → arrow through
  suggestions → Enter commits, focus never drops — confirmed via Playwright snapshots, not just a
  code read) and via mouse/click selection. Globe + guess-list colours untouched, confirmed still
  correct post-fix.

### Shared changes requested
None.
