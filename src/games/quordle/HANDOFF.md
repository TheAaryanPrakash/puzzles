# Quordle — handoff

## Built
- Generator (`scripts/quordle/`): seeded (mulberry32(2)) walk through ENABLE1 ∩ common.txt minus
  blocklist.txt, 4 distinct answers/day, full `LAUNCH_DATE … LAUNCH_DATE + SCHEDULE_DAYS - 1`
  schedule, `--exclude <dir>` flag (tested against a fake folder) to avoid colliding with a given
  day's Wordle answer. `public/assets/quordle/guesses.json` holds all 8,636 ENABLE1 5-letter words
  as valid guesses (blocklist not applied to guesses, per CLAUDE.md). `scripts/out/quordle-samples.md`
  written; read it — words are common, no repeats across the whole schedule.
- Game: 4 boards, 9 shared guesses (boards + 5, matching every multi-board Wordle variant surveyed —
  see RESEARCH.md), quadrant keyboard (one `KeyState` per board per key, drawn as a 2×2 swatch via
  the shared `Keyboard`'s `renderKey`). Solved boards dim, freeze at the guess that solved them, and
  show "Solved in N". State is `{ guesses: string[] }`, restorable (tested via a JSON round-trip).
  Tile flips, shake-on-invalid, and the solved-board badge all honor `prefers-reduced-motion`.
  Share summary is a spoiler-free digit-emoji 2×2 grid (never a letter), tested to never contain an
  answer.
- Two real bugs found and fixed during final review (not in the original prompt, found while
  manually playing the built game through to a win/loss):
  1. **Win-modal recap was invisible.** `ResultModal` renders through `createPortal` to
     `document.body`, outside `[data-game="quordle"]` — so the recap's `var(--quordle-board-N)`
     lookup resolved to nothing (not an error, just a silently-transparent background with white
     text on white). Fixed by adding `BOARD_COLORS` (plain hex, `logic.ts`) for anything drawn
     inside a portal, keeping the CSS vars in `theme.css` for in-tree usage (`Board.tsx`). Verified
     by reading `getComputedStyle` on the recap rows before/after.
  2. **Insufficient text contrast on 3 of 4 board tints.** The original teal/terracotta/amber board
     colors are used as a white-text badge fill (`Board.tsx`'s "Solved in N", the win recap) as well
     as a border tint — contrast against white measured 3.32 / 2.95 / 2.31 (WCAG needs 4.5 for this
     text size). Darkened all three (keeping indigo, already 5.31) until each cleared 4.5:1; see
     `theme.css`'s comment for the exact values and the computation. Still clearly teal/rust/amber,
     still distinguishable from the green/yellow tile-state colors per the original design intent.
- Deviations from the task prompt: none substantive. The task's requirements (generator shape,
  4 boards/9 guesses, quadrant keyboard, state shape) were followed as written; see RESEARCH.md for
  the guess-budget formula and share-format research that justified the specific numbers chosen.

## Review
1. **The shared `Keyboard` component overflows at 375px — see "Shared changes requested" below.**
   This is the top review item: it affects every game using the stock on-screen keyboard, not just
   Quordle, and blocks CLAUDE.md's 375px mobile requirement.
2. The two bugs fixed above (invisible recap, low-contrast badges) — spot check the win/loss modal
   at `?date=2026-10-17` (or any day) looks right; screenshots in `screenshots/` already reflect the
   fix.
3. `BOARD_COLORS` in `logic.ts` must be kept in sync with `theme.css`'s `--quordle-board-*` values by
   hand (documented in both places) — there's no single source of truth because of the portal issue.
   If a future edit changes one, it must change the other.
4. The generator's fair-answer pool (ENABLE1 ∩ common.txt) includes some obscure-but-valid entries
   (e.g. `WAUGH`, `MISES`) per the exact rule CLAUDE.md specifies; not a Quordle-specific issue, just
   worth knowing the wordlist has a long tail. Read `scripts/out/quordle-samples.md` for a larger
   sample.
5. Score shown in `ResultModal` is guesses-to-win (undefined on a loss, matching the shared
   component's existing convention of hiding the "Score:" line when `score` is undefined).

## Shared changes requested
- **`src/components/Keyboard.tsx`** — the default QWERTY layout's letter keys (`w-9` = 36px) with
  `gap-1.5` (6px) between them need **414px** for the top 10-key row, but every mobile requirement in
  CLAUDE.md targets 375px. Measured directly in a real render at a 404px-wide emulated viewport: the
  keyboard's outer `role="group"` was 414px wide, overflowing −10.5px to +403.5px, i.e. clipped on
  both edges with **no horizontal scroll** (`document.documentElement.scrollWidth` stayed equal to
  the viewport width) — Enter, Backspace, Q and P are simply unreachable by touch at this width. This
  will affect every game that uses the stock on-screen keyboard (Wordle, Quordle, and likely others).
  Needs a narrower key size/gap at small viewports (e.g. a `clamp()`-based width, or a breakpoint that
  switches to a smaller `w-7`/`gap-1`). I didn't patch this myself — CLAUDE.md is explicit that games
  must not style around a shared component's internals — but it should be near the top of the design
  agent's list.
- Same file, lower priority: no `touch-action: manipulation` on the key buttons (slower tap response
  on touch devices — `web-design-guidelines`'s touch/interaction section flags this) and no explicit
  `-webkit-tap-highlight-color`. Worth fixing alongside the width issue since it's the same component.

## Licences
None. No code copied — `src/lib/wordle-score.ts`'s `scoreGuess` is reused in-repo (not external), and
the prior implementations in RESEARCH.md were read for approach/timing, not copied from.

## Redesign phase 2 (2026-10, pink-on-black)
- `theme.css` was already redesigned at Checkpoint 1 (4 board tints synced to the approved
  Connections palette, tile trio matching Wordle's) — spot-checked at 375px with fresh eyes,
  nothing broken, left untouched.
- Wired `useSlotSpring` (`src/components/fx/useSlotSpring.ts`) into the typing animation: letters
  now spring up into their tile as typed and reverse on backspace, across all 4 boards. Quordle
  types one shared `currentGuess` string into every unsolved board at once, so this is **one**
  shared row of 5 slot springs (`index.tsx`'s `typingSlots = useSlotSpring(typingFilled)`, keyed off
  `currentGuess`), not 4 independent ones — each board's `Tile` for the current row binds its
  column's `motion.span style={slotStyle}` to the *same* motion-value instances, so up to 4 DOM
  nodes subscribe to 5 shared springs per keystroke instead of running 20 separate ones. Verified
  with `playwright-cli` (headed, since `FluxLines` needs WebGL2) at 375px: typed letters, a full
  guess, submit (flip-reveal still scores/animates correctly), and backspace all land in lockstep
  across all four boards.
- Removed `Tile.tsx`'s old ad hoc `scale: [0.82, 1.04, 1]` keyframe bounce for the typed/current-row
  case — the slot-spring letter rise replaces it; shake-on-invalid and the per-column flip-reveal
  stagger are untouched.
- No shared changes requested beyond the pre-existing Keyboard-overflow item below (unchanged by
  this pass).

## Known issues
- See "Shared changes requested" — the on-screen keyboard overflows at 375px app-wide; this is the
  main thing standing between Quordle and a clean 375px pass.
- A finished play doesn't auto-reopen `ResultModal` on a fresh page load (you see the read-only board
  + "You already played this one" banner, not the modal) — this matches the shared `AlreadyPlayed`
  component's existing pattern (no "view result again" affordance built into it), so it's consistent
  with how a returning player would experience any other game, not a Quordle-specific gap.
- During testing, the local dev server (`PORT=5202 pnpm dev`) died unexpectedly more than once with a
  bare `SIGTERM` (no related error in its own log) when launched as a detached background shell job;
  it was reliable once launched via the harness's dedicated background-task mechanism instead. Noting
  in case others hit the same instability with a plain `(cmd &)` backgrounding trick in this
  environment.
