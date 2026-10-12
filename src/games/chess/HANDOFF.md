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
| Tier | Engine options | Untimed movetime | Timed movetime |
|---|---|---|---|
| Easy | `Skill Level = 1` | 250 ms | up to 600 ms |
| Medium | `UCI_LimitStrength = true`, `UCI_Elo = 1500` | 700 ms | up to 1200 ms |
| Hard | full strength (`Skill Level = 20`, no limit) | 1200 ms | up to 2000 ms |

With a clock running, movetime scales off the engine's own remaining time (`remainingMs / 20`,
floor 300ms) up to the tier's timed ceiling above, instead of the small untimed defaults — a bug
fix made live during QA: the untimed numbers are tuned for snappy UX with no clock to respect, and
were small enough that the Computer barely touched a 3-10 minute clock over a whole game, and
under the 3+2 preset's 2000ms increment specifically, actually *gained* time each move (correct
Fischer math given a sub-1200ms movetime, but reads as broken). Verified live after the fix: 3+2
now holds roughly flat instead of climbing, and 5+0/10+0 tick down normally, for every tier.

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
entry is expected for any game's first one).

(An untracked file, `scripts/_check-today-plays.ts`, used to sit here too — pre-existing, not part
of this work. It was accidentally deleted by a `git clean` run during the "Play a Friend" pass
below while chasing a bundle-size comparison; flagged to the human immediately when it happened,
who confirmed it's fine to let go. Noted here in case it matters later.)

## Play a Friend

A second chess mode, added after the above: untimed correspondence chess between two site
members, reusing `Board`, `logic.ts`, `theme.css` and (generalized, not forked) `GameResultModal`
rather than duplicating them. Full design rationale (turns/concurrency, draw offers, abandonment,
challenge links, rematch, spectating, Realtime) is in `RESEARCH.md`'s "Multiplayer" section; this
records what was actually built.

### Built

- **`supabase/migrations/0005_chess.sql`** — `chess_challenges` and `chess_games`, RLS (a
  spectator must share a group with **both** players — stricter than the friends-board policy's
  one-sided check), and security-definer RPCs for every mutation (`create_challenge`,
  `create_rematch`, `accept_challenge`, `decline_challenge`, `cancel_challenge`, `make_move`,
  `resign`, `offer_draw`, `respond_draw`, `claim_abandoned`) plus reads (`challenge_preview`,
  `chess_opponents`, `my_chess_games`, `my_chess_badge`, `my_chess_record`). `chess_games` is added
  to the `supabase_realtime` publication, guarded for the PGlite test harness. Challenge expiry (3
  days) and abandonment (7 days) are both computed lazily at read/claim time — no cron job, per the
  task.
- **`src/lib/data/chess.ts`** — the only chess code that talks to a backend for this mode. A
  Supabase adapter (RPC wrappers + a `postgres_changes` Realtime subscription with a reconnect/
  tab-focus refetch fallback) and a local dev adapter (`localStorage` + `BroadcastChannel`,
  enforcing the same cap/turn/expiry/abandonment rules in plain TS). `no-datasource.test.ts` now
  allows exactly this one `lib/data` import from `src/games/chess/friends/`, nothing else.
- **`src/games/chess/friends/`** — `FriendsTab.tsx` (challenge creation/lists, games list sorted
  your-turn-first, the challenge-link preview banner), `GameView.tsx` (the game itself — reuses
  `Board`/`MoveList`/`CapturedPieces`/`PromotionPicker`, optimistic moves with rollback on refusal,
  the draw-offer banner, a "Claim win" button once `isAbandonable` is true, read-only spectator
  view), `NewChallengeModal.tsx` (pick a friend from `chess_opponents()` or make a link),
  `useFriendGame.ts` (the live-game hook). `src/games/chess/components/ChessTabs.tsx` is the
  Computer/Friends switcher — a plain `?tab=` navigation, not lifted state, so the two modes are
  fully independent components and computer mode's own code didn't need to change shape at all.
- **`logic.ts` extended, not forked**: `EndReason` gains `'draw-agreement'`/`'abandoned'`;
  `otherSide`/`isExpired`/`isAbandonable` are new pure helpers (TS mirrors of the SQL); `kingSquare`
  was pulled out of `index.tsx` (where it was a private helper) into `logic.ts` so both game views
  share it instead of duplicating it. `GameResultModal`'s props were generalized (computer-mode
  fields now optional, friend-mode fields added) — computer mode passes the exact same props as
  before and its rendering is unchanged.
- **Dev-only test infrastructure** (`src/lib/auth.tsx`): `?devUser=amal|riya` (two tabs can act as
  two different seeded members — same ids `local.ts`'s `ensureSeedGroup()` already creates) and
  `?devAuth=signed-out|signed-in-not-member` (simulates the states `RequireMember` needs a real
  session for, so the challenge-link sign-in round trip is testable without Supabase/Google). Both
  are inert unless passed explicitly.
- **Challenge-link survival through sign-in**: `saveChallengeToken`/`readChallengeToken`/
  `clearChallengeToken` in `auth.tsx`, threaded through `SignIn.tsx` and `Join.tsx` exactly
  alongside the existing `?invite=` handling.
- **Hub card badge** (`src/pages/Hub.tsx`): "N games waiting" (your-turn count + incoming
  challenges) replaces the "Just for fun · unscored" tag when non-zero. Fetched via a dynamic
  `import("../lib/data/chess")` rather than a static one — see "Finish" below for why.

### Tests

- `supabase/tests/schema.test.mjs`: 26 new assertions (95 total, 0 failing) — non-player/wrong-
  turn/stale-ply move refusal, finished-game freeze, spectator visibility (both/one/none shared
  groups), out-of-group challenge refusal, can't-accept-own-link, expired-challenge refusal, the
  5-game cap, draw-offer clearing on move, abandonment refused-before/allowed-after 7 days,
  rematch colour swap, `my_chess_record` correctness — **and** an explicit check that playing a
  full chess game to completion leaves `my_stats()` and `leaderboard()` byte-identical.
- `logic.test.ts`: new cases for `otherSide`, `isExpired`, `isAbandonable`, `kingSquare`.
- `scripts/chess/friends-e2e-check.mjs` (new, same plain-Node-+-`playwright` pattern as the
  existing `e2e-check.mjs`): two pages in one browser context (shared `localStorage`, independent
  `sessionStorage` via `?devUser=`) — link creation, the signed-out→`/signin`→back round trip via
  `?devAuth=signed-out`, cross-tab accept, a full scripted fool's-mate game with the result showing
  live on both pages (and the correct side losing/winning on each), and a reload restoring the
  finished game exactly. Passed when run against `PORT=5215 pnpm dev`.
- Manually verified in a real browser (two tabs, `?devUser=`): link creation, cross-tab accept,
  live BroadcastChannel sync, board orientation and turn-tracking both directions, and that
  computer mode (including `GameResultModal`'s now-generalized props) still renders and plays
  identically to before this pass.

### Deviations / scoping notes

- **No in-app browsing of games you can spectate.** A spectator reaches a game only via a link a
  player shares (the game view's own URL, `?game=<id>` under `?tab=friends`) — there's no "games
  happening in your groups" directory. Not asked for explicitly; flagged here as a possible future
  enhancement rather than added speculatively.
- **"A stale tab can't move" is proven at the unit/SQL level, not re-proven in the browser e2e
  check** — see that script's own header comment for why simulating genuine staleness against a
  same-context `BroadcastChannel` (which propagates near-instantly) isn't worth the fragility; the
  guarantee itself (`expected_ply` mismatch → refusal) is exercised by both
  `supabase/tests/schema.test.mjs` and the local adapter directly.
- **Mobile layout (375px) and keyboard support reuse the exact same component/token vocabulary**
  the computer mode's own verified-mobile build already uses (`Board`, `Modal`, `Button`, the same
  `max-w-[min(94vw,32rem)]` pattern, the same arrow-key cursor wiring copied into `GameView.tsx`) —
  not independently re-screenshotted on a real phone this pass. Worth a glance by hand, same note
  the original HANDOFF made about its own screenshots vs. a real screen.

### Finish

- `pnpm test`: 834/834 passing. `node supabase/tests/schema.test.mjs supabase/migrations/0001_init.sql`:
  95/95 passing. `pnpm build`: clean.
- **Bundle note**: `src/lib/data/chess.ts` is imported both by the chess route (eventually, via
  `friends/*`) and, for the Hub badge, dynamically (`import("../lib/data/chess")`, not a static
  top-level import) from `src/pages/Hub.tsx` specifically so it — and the local adapter code it
  pulls in — stay out of the eagerly-loaded shared bundle that every page pays for. Confirmed by
  inspecting `pnpm build`'s output before/after that change: switching the Hub's import from static
  to dynamic measurably shrank the main `index-*.js` chunk and moved that weight into
  separately-fetched async chunks instead. Chasing an exact byte-for-byte before/after number
  against a true pre-"Play a Friend" baseline turned out to be more trouble than it was worth (see
  the aside above about the deleted file) — the qualitative result (chess's backend code is
  chunk-split away from the critical path either way) is the part that actually matters here.
- `node scripts/check-scope.mjs chess`: reports `src/pages/Hub.tsx`, `CLAUDE.md`, `PLAN.md` and
  `scripts/check-scope.mjs` outside scope — all expected and already described above (the Hub
  badge is the one place this mode's presence is visible outside its own folder, same category as
  the original build's `GameMeta.scored` change).

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
