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

## Redesign (phase 2, pink-on-black)

Scope per `prompts/redesign/wordle.md`: `theme.css` was already redesigned and approved at
Checkpoint 1 (tile colours, contrast overrides, square tiles) — spot-checked at 375px, still reads
well, left untouched. The only build item was wiring `useSlotSpring` into the board.

- **`components/Tile.tsx`**: added an optional `slotStyle` prop (`useSlotSpring`'s per-slot
  `{ transform, opacity }` motion values). When present, the letter renders inside a `motion.span`
  with that style instead of as a bare text node; when absent (every row except the in-progress
  one), behaviour is unchanged from before this task.
- **`components/Board.tsx`**: calls `useSlotSpring` once, at the top of `Board`, with one `filled`
  boolean per column of `currentGuess` (`i < currentGuess.length`). Only the in-progress row's tiles
  get a `slotStyle`; historical rows and the row currently playing its flip-reveal never receive one,
  so the two animations stay decoupled exactly as the prompt asked — a letter springs up as it's
  typed and resets on backspace, and that's it. No `theme.css` change was needed: the hook's own
  `rise`/`bounce`/`duration` defaults already matched the "flowy" feel.
- Verified live (not just by reading the code): `PORT=5201 pnpm dev`, a dev-only `?devUser=amal`
  session, at 375px. Typed letters settle without layout shift or tile resize, backspace clears the
  right tile, submitting a full guess still runs the existing flip-reveal with no visible fight
  between the two animations (screenshots taken, flip colours and keyboard key-states correct after
  submit). `useReducedMotion` is read inside `useSlotSpring` itself, so reduced-motion is inherited
  for free — not separately re-tested here beyond reading the hook's own handling.
- `pnpm test` (836 tests across the suite) and `pnpm build` pass after these changes;
  `node scripts/check-scope.mjs wordle` reports 2 changed files, both in scope.

**Skills used**: `motion-framer` (reading `useSlotSpring`'s own motion-value pattern before wiring
it in, to avoid fighting the existing flip/shake animations); `playwright-cli` (headed Chrome, a
dedicated `-s=wordle-redesign` session to avoid colliding with other agents' shared `default`
session, 375px screenshots of typing/backspace/submit); `web-design-guidelines` (re-confirmed the
tile's `role="img"` label and reduced-motion handling still hold with the new child span).

**Shared changes requested**: None new. The `Keyboard` 375px overflow logged above was already a
phase-1 finding for the design agent; not re-filed here.
