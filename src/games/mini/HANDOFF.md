# Mini crossword — handoff

## Built

- **Importer** (`scripts/mini/lib.ts` + `build.ts`): parses the 787-puzzle archive, drops the one
  6×6 grid and two rebus-square puzzles, numbers every grid with standard crossword numbering,
  sources clues from the CrosswordQA dataset (`data/mini/crosswordqa-valid.csv`) with a seeded
  fallback to 313 hand-written clues (`scripts/mini/written-clues.json`) for answers the dataset
  had no usable clue for, and schedules 365 unique daily grids (7×7 on Saturdays, 5×5 otherwise)
  plus a 419-grid reserve pool. `content/puzzles/mini/*.json` and `scripts/out/mini-samples.md`
  are generated and reviewed — see `RESEARCH.md` §3–5 for the full reasoning.
- **Game logic** (`logic.ts`, 36 tests): cursor movement, direction toggling, auto-advance,
  backspace retreat, Tab-between-clues, check (non-destructive), reveal, win detection, and the
  spoiler-free share summary (tested to never contain an answer letter).
- **UI** (`index.tsx`, `components/MiniGrid.tsx`, `components/ClueBar.tsx`, `theme.css`): a plain
  CSS grid board (no canvas), active-cell and in-word highlighting, a mobile clue bar with
  prev/next and tap-to-toggle-direction, a visually-hidden input that captures both the physical
  and on-screen keyboard, a running timer, Check/Reveal, the reserve-puzzle "Skip" offered only
  before the first move, and the shared `GameLayout`/`HelpModal`/`ResultModal`/`AlreadyPlayed`
  components wired up per the game contract (restorable state, finished plays render read-only).
- **State** is `{ letters, elapsed, revealed }` exactly as specified. A mid-game state round-trips
  through JSON and restores identically (`logic.test.ts`'s `normalizeLetters`/`DEFAULT_STATE`
  coverage plus the `{}`-gotcha pattern from CLAUDE.md).
- Win celebrates via the shared `completeGame` → `celebrate()` — no per-game confetti code.
- Verified manually in the browser (Chrome, via Playwright-style automation): typing with
  auto-advance, direction toggling by re-tapping a cell, arrow-key movement (including the
  axis-switch-on-perpendicular-key rule), Tab between clues, Backspace retreat-and-clear, Check
  (flags wrong letters without clearing them), Reveal (fills the grid, ends the puzzle, shows
  "Peeked at the answers 👀" in the result instead of a time), a full correct solve (confetti +
  "Nice!" + updated stats), and the finished/read-only view with the "You already played this
  one." banner on a repeat visit.

## Review

1. **The reserve "Skip" reloads the page.** `usePuzzle` resolves the reserve puzzle from the
   play's `variant` only once, at mount — it isn't reactive to a `start("reserve")` call that
   happens later in the same session. Skipping therefore calls `start("reserve")` then
   `window.location.reload()` so the next mount picks up the reserve puzzle correctly. This works
   (verified), but a full reload is more jarring than ideal for a single click. See "Shared
   changes requested" below for the real fix.
2. **The `window.confirm()` on Reveal.** Revealing ends the puzzle for good (no "play again" per
   the game contract), so I added a native confirm dialog before it commits. I could not exercise
   this specific path live in this session (browser automation is told never to trigger native
   dialogs, since they block the session), though it type-checks and is a one-line gate around
   already-tested logic. Worth a manual click-through.
3. **Timer starts ticking on page load, not on the first move.** Matches "open the puzzle and the
   clock is running" (how the real Mini feels), but it does mean a member who opens the page and
   steps away for a minute before typing will see that minute counted. `elapsed` is only persisted
   alongside an actual letter change, so nothing is saved until the first real move either way.
4. **Mobile screenshot.** `screenshots/mobile.png` was captured at 606px wide, not 375px — the
   browser-automation tool's `resize_window` had a hard floor around 600px CSS width in this
   remote session (confirmed via `window.innerWidth`/`outerWidth` after several resize attempts),
   so a true 375px capture wasn't possible here. The CSS itself is width-agnostic (`.mini-board`
   is `width: min(100%, 420px)`, cell/number font sizes use `clamp()`, the clue bar and buttons are
   flex/wrap-friendly) and nothing in the 606px screenshot suggested a narrower width would break,
   but please double-check at an exact 375px DevTools viewport.
5. **Grid accessibility.** Cells use `role="grid"`/`role="gridcell"` with `aria-rowindex`/
   `aria-colindex` rather than literal `role="row"` wrapper elements (those would break the CSS
   Grid's flat child layout). This is a reasonable ARIA pattern but hasn't been tested with a real
   screen reader — worth a VoiceOver/NVDA pass before launch.

## Shared changes requested

- **`src/lib/hooks.ts` — `usePuzzle` doesn't react to a play's `variant` changing after mount.**
  Right now it resolves `main` vs. `reserve` once, from whatever `play` existed when its effect
  first ran. A game that offers "skip to reserve" (this one, and per CLAUDE.md, Connections too)
  has no way to show the reserve puzzle immediately after `start("reserve")` without a full page
  reload. A fix: either make the effect also depend on `play?.variant` (re-fetching
  `getPuzzle`/resolving the right one when it changes), or have `usePuzzle` return both `main` and
  `reserve` and let the game pick — either removes the reload workaround here.
- Otherwise: no changes needed to any frozen file, shared component, or the data-layer contract.

## Licences

None. `logic.ts`, `scripts/mini/`, and the UI are all original code against this project's own
contract. The three open-source crossword implementations in `RESEARCH.md` §2 (react-crossword,
mycrossword, crosswords-js) were read for UX conventions only — nothing was copied from them.

## Known issues

- Rebus squares aren't supported (two archive puzzles dropped for this — see RESEARCH.md §8).
- No partial reveal (single letter/word) — only "reveal everything," to keep `MiniState` and the
  share-summary distinction (revealed vs. not) simple. The real NYT Mini offers finer-grained
  reveal options.
- No pencil/anagram-helper mode (out of scope — not requested by CLAUDE.md or the task prompt).
- See "Review" #4 above: the mobile screenshot is at 606px, not the requested 375px, due to a
  browser-automation tooling limitation in this session, not a layout issue found in testing.

## Redesign pass (2026-10, phase 2)

Per `prompts/redesign/mini.md`: this game's `theme.css` was already redesigned and frozen before
this pass (active-cell/active-word swatches, `hubAccent`) — left untouched, per the prompt. This
was a verification + polish pass, not a rebuild.

**Verified via `playwright-cli` (headed, local adapter, `?devUser=amal`), at 375px and 393px
(iPhone 15) width, plus a 7×7 Saturday grid (`?date=` a Saturday):** typing with auto-advance,
across/down toggle (tap-to-toggle and Space), arrow-key movement, Tab between clues (confirmed the
input trap keeps focus so Tab does not leave the page), Backspace retreat, Check's wrong-letter
flash (`--mini-wrong` reads clearly against both the selected and in-word tints), Reveal's
`window.confirm()` gate (fires and completes correctly — the original HANDOFF.md could not verify
this live; now confirmed), and the finished/read-only board. Nothing reads as assuming the old
light "crossword paper" background — block squares, grid lines, the active-cell/active-word tints,
and the clue bar all read clearly against the new near-black base at both widths and both grid
sizes. `meta.ts`'s `howTo` was re-read with fresh eyes: three steps covering typing/advance,
movement, and Check/Reveal already read clearly through the shared `HowToPlayModal` — left as is.

**Bug found and fixed: the post-game result-modal preview grid was rendering with no block
squares, no grid-line gaps, and no outer border** — a flat rectangle of letters with zero crossword
structure (confirmed via pixel sampling: the gap color never appeared anywhere in the rendered
grid). Root cause: `ResultModal`'s `extraContent` (this game's own `<MiniGrid readOnly />`) renders
through `Modal.tsx`'s `createPortal(..., document.body)`, landing outside `GameLayout`'s
`[data-game="mini"] ` wrapper. Mini's own CSS custom properties (`--mini-black`, `--mini-word`,
`--mini-wrong`, `--mini-number`) are declared only inside that `[data-game="mini"]` scope, so they
were undefined wherever the modal portalled to, and since `background`/`border` are not inherited
CSS properties, the unresolved `var()` computed to fully transparent rather than any visible color
— letters were still visible only because `color` is inherited, so the clue numbers happened to
pick up a usable value from an ancestor. Fixed in `theme.css` by adding a static fallback to every
`var(--mini-*, ...)` reference at its use site, so each resolves correctly with or without the
`[data-game="mini"]` ancestor. A first attempt (a second, unscoped `:root { }` block declaring the
same tokens) looked like the more idiomatic CSS fix but does not work in this project: this
project's Tailwind v4 pipeline only keeps the custom properties declared in the one `:root` block in
`src/styles/brand.css`, and silently drops an equivalent block added from a per-game `theme.css` —
confirmed by inspecting the served CSS and the resulting computed styles directly (worth knowing
for any other game agent who hits the same "works inside `[data-game]`, breaks inside the portalled
result modal" symptom for their own game-only tokens).

### Shared changes requested (redesign pass)

- None required to ship this fix — it is fully contained in `src/games/mini/theme.css` (in scope).
  Flagging for awareness: **any other game whose `theme.css` defines game-only custom properties
  (not just the frozen `--game-*`/`--tile-*` names) and whose result-modal `extraContent` reads
  them for `background`/`border` is likely to hit the exact same silent-transparent bug**, since it
  is a structural consequence of `ResultModal` always portalling outside `[data-game]` combined
  with this project's Tailwind v4 pipeline dropping a second `:root` block — not something specific
  to Mini. Worth a note in `prompts/redesign/_game.md` or a shared lint/test if more than one game
  agent reports it independently.

### Review (redesign pass)

1. The result-modal preview fix above is the main thing to eyeball by hand: open a finished Mini
   puzzle result card and confirm the 5×5/7×7 grid still shows its block-square shape and thin grid
   lines, not just letters on a flat background.
2. Dev-server note for whoever reviews this worktree: in this sandboxed environment, Vite file
   watching did not pick up edits to this file reliably — a fresh `pnpm dev` (not just saving the
   file) was needed twice before changes actually served. If a change here is not showing up live,
   restart the dev server before assuming the CSS is wrong.
