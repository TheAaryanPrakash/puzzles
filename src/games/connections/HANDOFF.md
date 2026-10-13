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

## Redesign (phase 2, 2026-10)

Per `prompts/redesign/connections.md`, this was a verification + polish pass, not a build — the
4-level pink-on-black palette (`theme.css`) and the contrast/deuteranopia audit were already done in
an earlier session (commit `6dc9567`) and explicitly not to be redone. I played the game live at
375px and desktop, with mouse, keyboard-only, and two different `?date=` days, using `playwright-cli
open --headed` (headless Chromium has no WebGL2, which would make `FluxLines` render blank per
CLAUDE.md "Design").

**What I changed:**
- **Bug found and fixed: `headerActions` overflowed `GameLayout`'s header at 375px.** The "Seen this
  before? Skip" button (shown only before the first move) collided with the title/game-switcher
  column — confirmed live, not just read from the code: first the full phrase visibly overlapped the
  switcher's dropdown chevron, and even after shortening the label to bare "Skip" the "S" was still
  clipped half-behind the switcher pill (zoomed screenshots in this session showed the exact pixel
  overlap each time). `GameLayout.tsx`'s 3-column header grid (`grid-cols-[1fr_auto_1fr]`) has no
  shrink guard on the side columns, so a game's own `headerActions` content can push into the center
  column at narrow widths — see "Shared changes requested" below. Since `src/components/` is outside
  this agent's scope, I worked around it inside `index.tsx` instead: below `sm`, the button is
  icon-only (a small hand-drawn "skip forward" glyph, `aria-label="Seen this before? Skip"`, matching
  the Archive/Help icon-button footprint); from `sm` up there's room, so the full phrase shows as
  before. Verified at both breakpoints after the fix (desktop screenshot still reads "Seen this
  before? Skip" in full; 375px reads a clean single-line header with no overlap).
  - **Implementation gotcha worth flagging for other agents hitting the same pattern**: the
    hidden/visible toggle is on a wrapping `<span>` around each `Button`, not on the `Button` itself.
    `Button`'s own base class already bakes in `inline-flex` unconditionally; Tailwind v4 resolves two
    same-specificity utility classes (`hidden` vs. that baked-in `inline-flex`) by their order in the
    *generated* stylesheet, not by their order in the JSX `className` string — and in this project's
    generated CSS, `.inline-flex` happens to come after `.hidden`, so `.inline-flex` always won and
    the text button never actually hid. I only caught this by reading the served, Tailwind-compiled
    CSS directly (`curl .../src/styles/brand.css`) after a visual check kept showing the "wrong"
    variant at both breakpoints — a code read alone wouldn't have caught it. I also tried the
    Tailwind v3-style `!min-h-11`-leading-bang important syntax first; v4 doesn't support it (it
    silently generated no CSS at all) — v4's important syntax is a trailing bang (`class!`), still
    untested here since the wrapping-span approach made it unnecessary.
  - Also note: dev server HMR did not reliably pick up these edits in this environment — every
    verification pass in this session needed a full `vite` process restart (`lsof -ti:<port> | xargs
    kill -9` then relaunch) to see the real served output, not just a browser reload. Worth knowing
    if another agent's live-verification screenshots look stale after an edit.
- **`meta.ts`'s `howTo`**: lightly polished per the task's "read with fresh eyes" instruction — not
  sparse to begin with, but added the trap of a word looking like it fits more than one category, that
  4 mistakes reveals the rest of the board, and a line about the Shuffle button (previously undocumented).

**What I deliberately left untouched:** `theme.css` colours/contrast ratios, tile layout, and
`SolvedGroupBar`'s visual weight — none of that changed, so (per the task prompt) the existing
deuteranopia check still holds and doesn't need re-running.

**Verified:** `pnpm test` (836 tests, all passing, including this game's own 28), `pnpm build`,
`node scripts/check-scope.mjs connections` (2 files changed, both in scope), live play at 375px and
desktop (select → correct guess → solved bar reveal; select → wrong guess → mistake dot decrements),
keyboard-only play (Tab reaches every control with a visible focus ring, Enter selects/submits), two
different `?date=` puzzles.

### Shared changes requested
- `src/components/GameLayout.tsx`'s header grid (`grid-cols-[1fr_auto_1fr]`, ~line 90): the two side
  columns have no shrink/min-width guard against the center (title + `GlideSelect`) column, so any
  game passing non-trivial `headerActions` content can overflow into the center column on narrow
  viewports — reproduced live with Connections' own "Seen this before? Skip" button at 375px before
  I worked around it on my own side (see above). Might affect other games with `headerActions`
  (Mini's own "Skip" once it's built) at phones narrower than 375px, or with longer locale strings
  later. A `min-width: 0` + truncation/wrap guard on the side columns, or constraining the center
  column's max width, would fix it structurally for every game at once.

### Licences
No change — see the existing section above.
