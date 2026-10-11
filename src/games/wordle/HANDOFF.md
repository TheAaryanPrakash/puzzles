# Wordle — HANDOFF

## Built

Everything in the task prompt, plus the full game contract:

- **Generator** (`scripts/wordle/`): answers = ENABLE ∩ common rank < 15000, minus blocklist,
  plurals and past tenses, seed 1, no repeats across the 365-day schedule. Day file `{ answer }`.
  Guess list at `public/assets/wordle/guesses.json` (full 5-letter ENABLE subset, 8,636 words).
  `scripts/out/wordle-samples.md` written and reviewed.
- **Game**: 6 guesses, shared `Keyboard`, `lib/wordle-score.ts` reused (not reimplemented) for
  scoring. Row shake + toast on an invalid word, staggered flip reveal that swaps colour at the
  flip's midpoint (not before/after), hard mode as a per-play setting locked at the first guess
  with NYT's exact rule (every `correct` position and every `present` letter must recur; `absent`
  never enforced).
- **State**: `{ guesses: string[], hardMode: boolean }`, everything else derived. Round-trips
  through `JSON.parse(JSON.stringify(...))` identically (tested). Handles the `{}` gotcha.
- **Theme**: white/near-black, square tiles (0 radius), #6aaa64/#c9b458/#787c7e, Libre Franklin body,
  DM Serif Display title — exactly the prompt's palette.
- **Accessibility**: every tile is `role="img"` with a full state label ("A, correct"); the invalid
  word/hard-mode toast is `role="alert"`; a submitted guess is also announced via a dedicated
  `aria-live="polite"` region (not just the toast, since a legal-but-losing guess has no toast);
  all tile/shake animation uses `transform`/`opacity` only and fully honours `prefers-reduced-motion`
  (verified by reading `Tile.tsx`/`InvalidWordToast.tsx` against the fetched Web Interface
  Guidelines checklist).
- **No deviations** from the task prompt.

**Skills used**: `motion-framer` for the flip/shake animation approach (`motion/react`,
`useReducedMotion`, transform-only animation); `ui-ux-pro-max` for palette/contrast sanity on the
three tile colours against white/near-black; `playwright-cli` for the 375px/1280px screenshots,
physical-keyboard run and the invalid-word/win/reload checks below; `web-design-guidelines` for the
final self-review (fetched the live checklist and checked every animation, label and alert against
it — see above).

## Review

1. **Shared `Keyboard` overflows at 375px — see "Shared changes requested" below.** This is the one
   thing a human should actually look at; everything else below is confirmation, not a concern.
2. Flip timing: watch one guess submit at 375px — the colour should swap exactly as each tile is
   edge-on, not before (spoiler) or after (colour "pop-in"). Confirmed by reading the code (decoupled
   `displayState` from `state`, swapped at `delay + FLIP_DURATION/2`), not independently re-timed
   by eye — worth a human glance.
3. Hard mode: turn it on before guess 1, get a green/yellow hint, then try a guess that drops it —
   confirm the specific message ("3rd letter must be S" / "Guess must contain E") and that it's
   locked (checkbox disabled) after guess 1.
4. Guess distribution chart in the stats modal (`GuessDistribution` in `index.tsx`) — a small
   bar chart built from `usePlays`' `score`, not part of the task prompt but a natural fit for the
   existing `statsExtraContent` slot on `ResultModal`. Confirm it looks right with a few plays.
5. Share text: confirmed via `logic.test.ts` that `buildSummary` never contains the answer (every
   letter of every test answer checked, win and loss) — a human should still eyeball the real
   format once (`Wordle #N 3/6` + blank line + emoji grid + site name).

## Shared changes requested

**`src/components/Keyboard.tsx` overflows the viewport at 375px.** The top letter row is 10 keys at
`w-9` (36px) with `gap-1.5` (6px) between them: `10×36 + 9×6 = 414px`, inside `GameLayout`'s
`max-w-xl px-4` content area (343px available at a 375px viewport). The bottom row (`Enter` + 7
letters + `Backspace`, two of which are wider) is similar or worse. Screenshot at
`src/games/wordle/screenshots/mobile.png` shows it: the outer letters on every row are clipped by
the viewport edge, and the page can be scrolled horizontally to see them — which breaks CLAUDE.md's
"no horizontal page scroll" rule at 375px. Desktop (`screenshots/desktop.png`) is fine; this is
375px-only. I did not touch `Keyboard.tsx` myself (design agent's scope, and CLAUDE.md says "never
style around a shared component's internals" — a CSS override from my game's `theme.css` would be
exactly that). Likely fix: shrink key width/gap below some breakpoint (e.g. `w-7`/`gap-1` under
`sm:`), or size keys with `flex-1`/`min-width: 0` so the row always fits the available width instead
of a fixed per-key size. Every game that uses the shared `Keyboard` (Wordle, Quordle, and any other
letter-guessing game) will have this same bug, so it's worth fixing once centrally rather than per
game.

## Licences

None — no code copied from external sources. `lib/wordle-score.ts` was already in the repo
(shared with Quordle); `logic.ts` only calls it.

## Known issues

- The shared `Keyboard` overflow above (375px only).
- No other known issues. `pnpm test` (110 tests across the suite, 22 in this game) and `pnpm build`
  both pass; `node scripts/check-scope.mjs wordle` passes.
