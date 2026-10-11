# Connections — HANDOFF

## Built

Full game, following `RESEARCH.md`'s chosen approach:

- **Importer** (`scripts/connections/{lib,import}.ts`): parses `data/connections/Connections_Data.csv`,
  validates each puzzle (16 unique words, 4 groups of 4, levels 0–3 once each, structural "no split
  numbers" check), strips NYT metadata. 628 raw puzzles, **0 rejected**. Seed-31 schedule: 365 unique
  daily mains (LAUNCH_DATE .. LAUNCH_DATE+364), reserve pool of 263 (`pool[n % pool.length]`), no
  reserve is ever also a main on the same day. `scripts/out/connections-samples.md` has pool stats,
  rejection list (empty) and 5 sample days.
- **Logic** (`logic.ts`, 28 tests / `scripts/connections/lib.test.ts`, 8 tests): deterministic initial
  tile order (`mulberry32(hashString(date))`, same pattern as `local.ts`'s friends-board RNG) so every
  member sees the same starting grid; `Math.random`-driven Shuffle for the unsolved tiles only, on
  click; correct/one-away/incorrect/duplicate guess evaluation with loss-takes-priority-over-one-away;
  4-mistake loss revealing remaining groups in ascending level order; spoiler-free `buildSummary`
  (title + puzzle number + per-guess emoji grid, colour = the group each word actually belongs to,
  never the words/labels themselves) — proven never to leak a word or label, both on a fixture and
  across every puzzle in the real generated schedule (`logic.test.ts`'s property-style test reads
  `content/puzzles/connections/*.json` directly).
- **UI** (`index.tsx` + `components/{Tile,SolvedGroupBar,MistakeDots,Toast}.tsx`, `theme.css`): off-white/
  beige board, bold uppercase Libre Franklin, 4 contrast-checked category colours (yellow/green/blue/
  purple, each ≥4.5:1 text contrast — see RESEARCH.md). Select-4-and-submit, shuffle, deselect all,
  shake-on-wrong, "One away…"/"Already guessed!" toast, solved groups collapse into coloured bars via
  `AnimatePresence`/`layout`, loss reveals the rest staggered, win → `finish()` → `completeGame` →
  confetti → `ResultModal`. "Seen this before? Skip" is offered only before the first move (mirrors the
  data layer's own variant-switch guard). Every animation is gated on `useReducedMotion()`.
- State shape exactly as specified: `{ guesses: string[][], order: string[] }`. Round-trips through
  JSON (tested) and restores an identical visible grid on reload/another device, including the `{}`
  window right after `start()` (`{ ...DEFAULT_STATE, ...play?.state }`).

**Deviations from the task prompt** (all explained in more depth in `RESEARCH.md` §4):
- No in-game "hard mode"/colourblind toggle — out of scope per RESEARCH.md; colour is never the only
  signal anyway (solved bars always show the category label as text too).
- Share summary has no site URL — `config.ts` has no `SITE_URL` constant yet and `src/games/_example`
  omits one too; see "Shared changes requested" below.
- "No split numbers" is enforced as a structural check (16 rows/7 cols/integer level), not a naive
  comma-split, since the source CSV already quotes every comma-containing field correctly (verified
  directly) — 0 rejections, reported honestly rather than fabricated.

## Review

The 3–5 things worth checking by hand:
1. **Toast overlapping a solved-bar label** (`components/Toast.tsx`): the "One away…"/"Already
   guessed!" pill is `fixed top-20`, so right after the first group solves it floats directly over the
   top solved bar's text for its ~1.6s lifetime. Checked this against how the real NYT Connections
   behaves (its own toast floats over the top of the board the same way) and judged it intentional/
   authentic rather than a bug — but worth a human glance, screenshot in
   `screenshots/mobile.png` doesn't happen to catch it mid-toast (see step 2 below for a toast capture).
2. Contrast of the 4 level colours (yellow `#dca52e`/dark text 6.94:1, green `#4f7d53`/white 4.78:1,
   blue `#3f6fa0`/white 5.26:1, purple `#7d5486`/white 6.03:1) — computed by hand in RESEARCH.md, worth
   an eyeball check against the actual rendered swatches.
3. Keyboard play: confirmed Tab reaches every tile and all 3 controls (Shuffle/Deselect/Submit) and
   wraps correctly; Enter/Space selects a tile and submits — tested live via `playwright-cli` this
   session, not just assumed from `<button>` semantics.
4. The reserve/"Skip" flow: only tested that the button disappears after the first move (`hasMoved`);
   didn't exercise an actual reserve puzzle end-to-end in the browser (logic for it is covered by
   `logic.test.ts` and the local adapter's own tests).
5. `scripts/out/connections-samples.md`'s 5 sample days — worth a read as a friend would see them (no
   generator fixes were needed; all 628 puzzles validated cleanly).

## Shared changes requested

- `src/config.ts`: a `SITE_URL` constant, for `buildSummary`/share text across every game (not just
  this one) to append once a Vercel domain exists. None of the games built so far have one to use.
  Not blocking — `src/games/_example`'s own summary already omits a URL for the same reason.

## Licences

None. No code was copied — the three clones researched (`and-computers/react-connections-game`
GPL-3.0, `srefsland/nyt-connections-clone` MIT, `dbousamra/connections` unlicensed) were read for
design only; this game's `logic.ts`/state shape looks nothing like any of theirs. See RESEARCH.md §2–3
for what was learned from each and why nothing was transcribed.

## Known issues

- See Review item 1 (Toast position) — believed authentic to the real game, not fixed.
- `scripts/connections/import.ts` requires the raw `data/connections/Connections_Data.csv` to exist
  (read-only, owned by the data agent) — not re-run as part of this handoff since the generated
  `content/puzzles/connections/` is already committed and the samples file shows a clean, unchanged run.
