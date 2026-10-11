# Quordle — research

## Rules (confirmed from the live game and secondary guides)
- Four 5-letter Wordle boards are solved **at once**. [Wikipedia: Quordle](https://en.wikipedia.org/wiki/Quordle)
  confirms: four grids, nine total guesses, green/yellow/gray feedback per board, same daily puzzle
  for everyone, new puzzle each day.
- **One shared guess list.** Every submitted word is scored against all four answers simultaneously —
  there is no "9 guesses per board", it's 9 guesses *total*, shared. A board that's already solved
  keeps receiving (and ignoring, visually) the remaining shared guesses.
- **Guess budget = boards + 5.** Every multi-board Wordle variant I found uses this formula (4+5=9 for
  Quordle, 32+5=37 for Duotrigordle's "normal" mode) — enough slack to solve 4 words when you're
  not purely optimal, not so much it's trivial.
- The game ends the instant all 4 are solved (win) or the shared guess count hits the cap with at
  least one board unsolved (loss). Several third-party recap/strategy pages agree on this; no
  official rules page was reachable, so I corroborated against the implementations below rather than
  trust any single blog.

## Prior implementations studied
| Project | Stars | License | What I took from it |
|---|---|---|---|
| [thesilican/duotrigordle](https://github.com/thesilican/duotrigordle) | ~60 | MIT | Generalizes this exact mechanic to N boards. `funcs.ts`'s `getGuessColors`/`getCompletedBoards` confirm "solved = guesses.includes(target)" and the shared-list model; `NUM_GUESSES = boards + 5` for every mode; `Keyboard.tsx`'s per-key **background-split-into-N-cells** technique is exactly a "quadrant keyboard" generalized to N boards — I adapted the 4-board case of this for our shared `Keyboard`'s `renderKey`. |
| [SymphonyIceAttack/quordle](https://github.com/SymphonyIceAttack/quordle) | — | MIT | An actual Quordle-named clone (Next.js). `lib/wordle-multi.ts` hard-codes the 9-guess cap and the "lose when `guesses.length >= 9` and not all won" check, confirming the loss condition against a second independent source. `WordleMultiGame.tsx` lays the 4 boards out as `grid-cols-2` (2×2) with each board itself a tight `grid-cols-5` — the layout I used for 375px. |
| [yyx990803/vue-wordle](https://github.com/yyx990803/vue-wordle) (Evan You) | ~600 | none declared — **read only, no code copied** | Canonical single-board tile choreography: flip transition staggered `index * 300ms` per tile, a `0.5s` shake on an invalid/rejected guess, a `0.2s` pop on typing a letter, and a `0.5s` "jump" staggered `index * 100ms` across the solved row. I reused these durations/stagger shapes (not the code) when building our `motion`-based animations, scaled down since our tiles are smaller. |

Also read several secondary "how to play Quordle" recap pages; they agree with the above and added
nothing not already confirmed by the implementations, so they aren't cited individually.

## Comparison / decisions
- **State shape.** Every implementation stores one `guesses: string[]` shared across boards, scoring
  each guess against each answer independently with the classic two-pass Wordle algorithm. We already
  have that algorithm shared at `src/lib/wordle-score.ts` (`scoreGuess`) — reused verbatim rather than
  reimplemented, so Quordle and Wordle agree bit-for-bit on scoring even though the generators are
  built independently per CLAUDE.md.
- **Per-board solved check.** Duotrigordle checks `guesses.includes(target)`; since our generator
  guarantees 4 **distinct** answers (CLAUDE.md requirement), this is safe, but logic.ts checks by board
  **index** (`guesses.some(g => g === answers[i])`) rather than global `includes`, so a future bug that
  let two boards share an answer wouldn't crosslink their solved status.
- **Keyboard.** The shared `Keyboard` component's `keyStates` prop already accepts `KeyState[]` and a
  `renderKey` render prop (see `src/components/types.ts`) — this type exists *specifically* for a
  multi-board game. We pass one `KeyState` per board (in board order) and `renderKey` draws a small
  2×2 swatch inside each key, each quadrant tinted to match its board's accent color so the keyboard
  visually mirrors the board grid above it.
- **Share text.** Spoiler-free and numeric, matching the real game's own convention (no letters, no
  emoji letter-grid): one digit-emoji per board for the guess number that solved it, arranged in the
  same 2×2 order as the boards, 🟥 for an unsolved board. Never contains any answer. Follows the
  `_example` game's convention of no site URL in the summary (this site is invite-only, not meant to
  be advertised).
- **Guess budget deviation considered and rejected:** I considered Quordle's optional "Chill mode"
  (12 guesses) mentioned on secondary sites, but CLAUDE.md's requirements call for a single daily
  puzzle with one fixed ruleset per game, matching the "classic" 9-guess mode every implementation
  treats as the default. Not implemented.

## Generator design
- Fair-answer pool: ENABLE1 ∩ `common.txt`, 5-letter alpha-only, minus `blocklist.txt` → **3,646**
  candidates (computed directly from the wordlists). Comfortably covers `SCHEDULE_DAYS × 4 = 1,460`
  answers with room to spare for `--exclude` replacements.
- Valid guesses: **all** 8,636 five-letter ENABLE1 words, written to
  `public/assets/quordle/guesses.json` (uppercase), per the task's explicit instruction. Blocklist is
  *not* applied to guesses — CLAUDE.md scopes the blocklist rule to answers only, and Wordle itself
  accepts blocklisted words as valid-but-never-the-answer guesses.
- Determinism: the whole fair-answer pool is shuffled **once** with `mulberry32(2)` (seed 2, per the
  task). Days are assigned by walking a single cursor forward through that shuffled pool, 4 words at a
  time — this guarantees **no answer repeats anywhere in the whole schedule** (pool ≫ needed) without
  any extra bookkeeping, and is idempotent (same seed + same wordlists ⇒ same output every run).
- `--exclude <dir>`: for each day, if the cursor's next candidate equals that day's Wordle answer
  (read from `<dir>/<date>.json`, case-insensitively), the generator skips it (leaving it for a later
  day) and pulls the next pool word instead — advancing the shared cursor, so the schedule stays
  deterministic for a given `--exclude` set without perturbing days that have no collision.
- Throws if the fair pool can't cover the full schedule (`pool.length < SCHEDULE_DAYS * 4`, plus the
  cursor running dry while resolving exclusions).
- Output: `content/puzzles/quordle/<date>.json` = `{ "payload": { "answers": [a,b,c,d] }, "reserve": null }`
  for every day from `LAUNCH_DATE` to `LAUNCH_DATE + SCHEDULE_DAYS - 1`, plus
  `scripts/out/quordle-samples.md`.

## Edge cases (each has a test)
1. Duplicate letters in a guess, scored independently per board (reuses `scoreGuess`'s own tested
   two-pass logic — no re-test of that function itself, just that it's wired in per board).
2. A guess that exactly matches one board's answer solves only that board; it's still scored (and
   still counts toward the shared total) against the other three.
3. Winning on exactly the 9th guess.
4. Losing: the 9th shared guess is submitted and at least one board is still unsolved → game over,
   loss, no more input accepted.
5. A solved board doesn't reopen or re-solve from later guesses; its "solved at guess N" is frozen at
   the first match.
6. The shared guess list keeps growing (and keeps being scored against still-unsolved boards) after
   some boards are already solved.
7. Keyboard quadrant coloring never *downgrades* a cell: once a board shows a letter as correct, a
   later guess that shows the same letter as absent elsewhere must not override it back down.
8. Guess validation: wrong length rejected; a 5-letter string not in the valid-guess list rejected;
   accepted guesses are case-insensitive on input but stored/compared uppercase.
9. Share summary contains no board's answer, win or loss, and the digit grid order matches board order.
10. Mid-game state survives a JSON round-trip: solved boards, keyboard states and the share summary
    are identical before and after `JSON.parse(JSON.stringify(state))`.
11. Generator: four distinct answers per day; `--exclude` guarantees no collision with a given Wordle
    folder (tested against a fake folder, per the task); throws if the fair pool is too small for the
    requested schedule.

## Skills used
- **motion-framer** — read for the flip/shake/pop timing vocabulary (durations, stagger patterns,
  spring vs. duration-based transitions) before writing the tile and keyboard animations; every
  animation is wrapped to honor `useReducedMotion()`.
- **ui-ux-pro-max** — used for the board/keyboard palette (tile-correct/present/absent contrast ratios,
  the 4 board-accent tints staying distinguishable under color-blindness, touch target sizing on the
  denser keyboard).
- **playwright-cli** — used to screenshot the built game at 375px and 1280px and to drive a
  keyboard-only playthrough before calling it done.
- **web-design-guidelines** — final self-review pass against the shipped page (see HANDOFF.md for
  what it caught).

## Build plan
1. `scripts/quordle/wordlist.ts` (pure pool-building) + `scripts/quordle/generate.ts` (CLI,
   `--exclude <dir>`) + tests, then run for the full schedule and read the samples file.
2. `logic.ts` (pure: scoring per board, win/loss, keyboard states, summary) + tests for every edge
   case above.
3. `index.tsx` + `components/` (boards grid, quadrant keyboard key renderer) + `theme.css`.
4. Screenshots, `web-design-guidelines` pass, `HANDOFF.md`.
