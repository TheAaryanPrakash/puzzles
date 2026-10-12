# Chess vs. Computer — HANDOFF

A 15th Hub card, explicitly **not** a daily puzzle: play anytime, never scored, never synced to
Supabase. See `RESEARCH.md` for sources, the chosen approach, and why each deviation from the task
prompt was made; CLAUDE.md's new "Chess" section records the approved package/licence exceptions.

## Built

**Rules/engine layer** (`src/games/chess/logic.ts`, `lib/engine.ts`, `lib/storage.ts`) — pure
functions over `chess.js` for rules/FEN/PGN/game-end detection (checkmate, stalemate, threefold,
50-move, insufficient material, with the same-vs-opposite-colour-bishop distinction verified
empirically before writing tests against it), a `ChessEngine` Worker wrapper speaking UCI to the
Stockfish "lite, single-threaded" build, and try/catch'd localStorage for the in-progress game,
last-used settings, and personal record — all namespaced
`sansitas-puzzles:chess:{game,settings,record}:<userId>`.

**Difficulty** (final, tuned values — see RESEARCH.md §4 for why):
| Tier | Engine options | Movetime |
|---|---|---|
| Easy | `Skill Level = 1` | 250 ms |
| Medium | `UCI_LimitStrength = true`, `UCI_Elo = 1500` | 700 ms |
| Hard | full strength (`Skill Level = 20`, no limit) | 1200 ms, scaled down (floor 200 ms) when the engine's own clock gets low |

**Move variety** — MultiPV 4 for the engine's first 10 moves, random pick within a cp margin of the
best (Hard 25cp per the task baseline, Medium 45cp, Easy 70cp — all under a pawn's ~100cp value,
which is the actual mechanism that keeps a hanging-piece blunder from ever being picked). **Proven
live**, not just asserted: `scripts/chess/variety-check.mjs` played 8 fresh Hard games with the same
scripted first 3 moves (e4, Nf3, Nc3 — chosen because they're legal regardless of the engine's
replies) and got **7 distinct lines out of 8** (task required ≥4).

**Board** (`src/games/chess/components/Board.tsx`) — hand-written, no board library. Tap-to-move and
drag-to-move both funnel through the same two callbacks the page owns (`onActivateSquare`,
`onAttemptMove`), so there's exactly one place deciding move legality. Legal-move dots, last-move
and check highlighting, flipped orientation when playing Black, coordinates, full keyboard support
(arrow keys move a visual cursor — accounting for board flip — Enter/Space activates it, Esc
clears selection), an `aria-live` region announcing the cursor's square and piece.

**The rest of the UI** (`src/games/chess/components/`) — `Clock` (mm:ss, red under 30s),
`MoveList` (two-column scoresheet), `CapturedPieces` (grouped by colour + material diff),
`PromotionPicker`, `SettingsModal` (difficulty/side/clock, remembers the last choice, used both
before a first game and from the header's "New game" button), `GameResultModal` (chess's own, not
the shared `ResultModal` — see "Deviations" below).

**`index.tsx`** — orchestrates all of the above: commits a move only once (shared by player and
engine moves), triggers the engine's reply only via explicit calls right after a state transition
(never a reactive effect diffing fen/status, which would miss the edge case of two consecutive
fresh games with coincidentally-identical fen+status), a single continuously-running clock interval
(using a ref to avoid stale-closure staleness) that pauses while the tab is hidden and is the sole
place that decrements time (so increments, applied once per move, never double-count against it),
and a mount-only effect that resumes an in-progress restored game if it turns out to be the
engine's move (e.g. the tab closed between the player's move and the engine's reply).

**Themes** (`theme.css`) — pink-family board (`--tile-light`/`--tile-dark`/`--tile-highlight`/
`--tile-check`/`--tile-move-dot`), contrast ratios computed (not eyeballed) and recorded in the
file's own header comment. DM Serif Display heading font + IBM Plex Mono for the clock/move list,
both already-installed `@fontsource` packages — no new font package added.

## Tests

- `logic.test.ts` (45 tests): difficulty mapping, the MultiPV picker's margin behaviour, clock
  tick/increment/flag-vs-insufficient-material, undo (two plies, blocked with a clock or after the
  game ends), the assisted flag, checkmate/stalemate/threefold/50-move/insufficient-material
  (including the bishop-colour distinction), promotion, castling through/into/with check (all
  illegal), en passant, and save/restore round-tripping (including corrupt-storage fallback).
- `lib/storage.test.ts` (15 tests): round-trips, per-user isolation, corrupt-data fallback, and a
  simulated `localStorage` failure on both read and write never throwing.
- `no-datasource.test.ts` (14 tests): scans every file under `src/games/chess` and fails if any of
  them imports `lib/data`/`lib/hooks` or calls `usePlay`/`completeGame`/`dataSource.*` — verified
  this actually catches a violation (temporarily injected one, confirmed the test failed, removed
  it) before trusting it.
- `src/routes.test.ts` (7 tests): `scoredGameMetas` is exactly the 14 daily games, independent of
  `import.meta.env.PROD`; chess is discovered, marked `scored: false`, sits last in order, and still
  appears in `gameMetas` (the Hub's card list).
- `scripts/chess/e2e-check.mjs` and `variety-check.mjs` — see "Finish" below; both run against a
  real dev server with zero console errors.

## Deviations from the prompt (explained further in RESEARCH.md)

- **No `GameLayout`/`ResultModal`/`StatsModal`/`FriendsBoard`/`NextPuzzleCountdown`/
  `AlreadyPlayed`/`SiteHeader`.** Traced each one: they all transitively touch the DataSource
  (`usePlays`, `useStats`, `useFriendsResults`, `GroupSwitcher`) or encode daily-puzzle concepts
  (Archive, "already played today") that don't apply to a game playable anytime. Chess has its own
  small header and result modal instead, built from the DataSource-free shared primitives.
- **No site-wide dark mode exists** (audited `brand.css` and every game's `theme.css` — there's no
  `prefers-color-scheme`/`data-theme` anywhere). The task's "stay clear in light and dark mode" is
  scoped down to "good contrast in the one (light) theme the site actually has"; token names are
  still chosen so a future dark mode could override them without renaming anything.
- **No piece-slide animation at all**, not even a normal-motion one disabled under
  `prefers-reduced-motion`. A true slide (tracking the *same piece* across a position change,
  animating old-square → new-square) needs piece identity to persist across moves, which the board
  currently doesn't track (squares re-render fresh each move, not pieces) — a real architectural
  addition, not a quick follow-up. Pieces currently just snap into place. Noted here rather than
  silently shipped as if it were the intended "no slide animation" — this is "no slide animation,
  full stop," which trivially satisfies the reduced-motion requirement but under-delivers the
  normal-motion case.
- **No two-column desktop layout.** At 1280px the board still sits in a centered single column
  (matching the rest of the site's layout convention) rather than putting the move list/captured
  pieces beside the board. Functional and clean at both sizes (see screenshots), just doesn't use
  the extra width. Flagged as a possible future enhancement, not a defect.
- **`Skill Level`'s Elo isn't shown anywhere in the UI.** No official Stockfish table maps Skill
  Level 0-20 to Elo (checked the engine's own docs) — only inconsistent forum anecdotes — so the UI
  says "Easy/Medium/Hard," not a specific rating, to avoid promising precision the engine doesn't
  document for that option. (Medium's calibrated `UCI_Elo = 1500` *is* a real, documented number if
  the human wants that one surfaced later — that's a one-line change, not a design question.)

## Review — please check by hand

1. **A real promotion and a real checkmate/stalemate/draw end-to-end** — unit-tested thoroughly via
   fixture positions, but not exercised through the live UI by the automated checks (scripting a
   full forced-mate sequence through tap/drag gestures was out of scope for this pass). Worth
   playing one game to an actual checkmate and one pawn promotion by hand.
2. **Board/piece contrast on an actual phone**, not just the screenshot — `theme.css`'s header
   comment has the computed ratios, but a real screen is worth a glance (same note sudoku's
   HANDOFF.md made about its own box dividers).
3. **The "assisted" flag's effect on the personal record** — win a game after using Undo or Hint
   and confirm it lands in the record's "assisted" bucket, not the main one.
4. **Clock flag behaviour at the very end of a close game** — the interval ticks every 250ms, so a
   flag can be noticed up to ~250ms late; this is a UX polish question (not a correctness one — the
   250ms window is far smaller than any increment/clock preset offered), worth a quick look if the
   human cares about split-second precision.

## Shared changes requested

None beyond what's already described in CLAUDE.md's new "Chess" section itself, the
`GameMeta.scored` field, and `routes.tsx`'s `scoredGameMetas` — all already made, since this is a
single agent working directly on `main`, not a scoped worktree agent (CLAUDE.md and the frozen
`src/lib/types.ts`/`routes.tsx` are normally "only the human changes them, on main," which is
exactly what this is). `node scripts/check-scope.mjs chess` reports `CLAUDE.md` and
`scripts/check-scope.mjs` for that same reason (the tooling file touching itself to add a scope
entry is expected for any game's first one), plus `scripts/_check-today-plays.ts`, an untracked
file that predates this work and wasn't touched here.

## Licences

- **`chess.js`** — BSD-2-Clause. Used via its public API only, nothing copied.
- **`stockfish`** (npm package) — engine GPLv3, JS wrapper MIT. Shipped **unmodified** in
  `public/assets/chess/engine/` (the "lite, single-threaded" build: `stockfish-19-lite-single.js`,
  28KB, + `stockfish-19-lite-single.wasm`, 1.8MB — ~1.83MB combined on disk), with its licence file
  alongside. Spoken to only as a `Worker` over UCI — no Stockfish code is imported into `src/`. The
  chess Help modal links "Engine: Stockfish (GPLv3), source."
- **Piece art** — 12 SVGs by [RhosGFX](https://rhosgfx.itch.io/vector-chess-pieces), **CC0 1.0**
  (public domain; no attribution required, credited anyway). Fetched unmodified from lichess's own
  mirror of this exact set (`public/assets/chess/pieces/SOURCE.md` has the full provenance and the
  lila `COPYING.md` citation that confirms the licence).
- No other code was copied from any reviewed project (chesskit, ChessAnalyzer, the eddmann
  Stockfish-Worker tutorial, lichess — see RESEARCH.md §2–3); all were read for approach only.

## Finish

- `pnpm test`: 817/817 passing (the pre-existing 14 games' suites included, confirming nothing
  broke). `pnpm build`: clean. No puzzle-content `dist/` check applies — chess ships no puzzle
  content, nothing to leak.
- **Bundle impact**: the shared/hub bundle grew from 501,937 → 503,080 bytes (~1.1KB, well under
  "a few KB"). Chess's own code is a separate, lazily-loaded ~60KB (20KB gzip) chunk, only fetched
  on `/chess`. The engine (1.8MB) and piece SVGs (~20KB) are static assets under
  `public/assets/chess/`, never bundled into any JS chunk at all.
- `node scripts/check-scope.mjs chess`: only the two expected/unrelated items above.
- **Manually verified against a real running dev server** (`PORT=5215 pnpm dev`), not just
  unit/type-checked: playing as White and as Black (board flip + engine moving first confirmed),
  refresh mid-game restoring exactly, Hint highlighting a square pair, Undo popping a round,
  Resign producing the correct result modal, and a 3+2 clock counting down in real time
  (3:00 → 2:57 after a real 3-second wait) with the active side's clock visibly highlighted and
  Undo correctly disabled while it's running.
- Screenshots in `src/games/chess/screenshots/`: `mobile-375-settings.png`,
  `mobile-375-board.png`, `desktop-1280-board.png` (light theme only — see "Deviations").
