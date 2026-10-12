# Chess vs. Computer — RESEARCH

Chess is the 15th card on the Hub but **not a daily puzzle**: no shared puzzle, no per-day release,
play as many games as you want, never scored, never synced to Supabase. See "Chosen design" below
for how that's enforced structurally rather than by convention, and CLAUDE.md's new "Chess" section
for the approved package/licence exceptions this game relies on.

## 1. Official rules

Standard FIDE chess rules — confirmed against Tornelo's and WorldChess's rules explainers (FIDE's
own PDF wasn't fetched directly; both secondary sources agree with each other and with the
universally-taught rule set, so treated as reliable):

- **Checkmate / stalemate**: the side to move has no legal move; checkmate if in check, stalemate
  (draw) otherwise.
- **Threefold repetition**: the *same position* (same side to move, same castling rights, same
  en-passant capturability) occurs three times — doesn't have to be consecutive.
- **50-move rule**: 50 full moves by each side with no capture and no pawn move → draw. (FIDE's
  2023 rules also have an automatic-draw-at-75-moves arbiter rule for strict enforcement, but for a
  two-player-vs-engine casual game, claiming/declaring at 50 is enough — not implementing the 75-move
  auto-draw separately since chess.js's own `isDrawByFiftyMoves()` already models the 50-move form.)
- **Insufficient material (dead position, FIDE Art. 5.2.2)**: K vs K; K+B vs K; K+N vs K; K+B vs K+B
  with **same-coloured bishops** (opposite-coloured bishops *can* checkmate, so that combination is
  **not** a dead position and must keep playing).
- **En passant**: a pawn moving two squares from its start can be captured *en passant* by an enemy
  pawn on an adjacent file, only on the immediately following move.
- **Castling**: king and that rook have never moved; no piece between them; king is not currently in
  check, does not pass through a square attacked by the opponent, and does not land on an attacked
  square.

## 2–3. Prior art

| Project | Approach | Strengths | Weaknesses / gaps | Licence |
|---|---|---|---|---|
| **chess.js** (jhlywa/chess.js, npm `chess.js`) | Full move generation/validation, FEN/PGN, game-end detection (`isCheckmate`, `isStalemate`, `isDraw`, `isDrawByFiftyMoves`, `isThreefoldRepetition`, `isInsufficientMaterial`, `isGameOver`, `inCheck`). | Battle-tested (used by lichess's own puzzle trainer and hundreds of clones), tiny, zero deps, handles castling-through-check and en passant internally via its legal-move generator — no caller-side special-casing needed. | API uses `inCheck()`, not `isCheck()` (easy typo); `isInsufficientMaterial()`'s same-colour-bishop handling isn't spelled out in the docs prose — verified empirically in `logic.test.ts` rather than trusted blind. | **BSD-2-Clause** (confirmed on [repo](https://github.com/jhlywa/chess.js) and npm). |
| **`stockfish` npm package** (nmrugg/stockfish.js — the unscoped `stockfish` name resolves to this, *not* a lichess-maintained package) | Prebuilt Stockfish-NNUE WASM + asm.js fallback, several build variants from "full" (~94MB, multi-threaded, needs SharedArrayBuffer/COOP-COEP) down to a **"lite-single"** variant: single-threaded, no SharedArrayBuffer, ~1.7MB combined JS+WASM. The file *is* the Worker script — `new Worker(url)` pointed straight at it, no wrapper needed; it speaks UCI over `postMessage`/`onmessage`. | Exactly fits "no COOP/COEP, runs in one Worker, small footprint." Standard UCI (`uci`, `isready`/`readyok`, `ucinewgame`, `position fen …`, `setoption name X value Y`, `go movetime N`, reading `bestmove …` / `info depth D multipv N score cp X pv …`). | Engine itself: **GPLv3**. Wrapper/loader JS: MIT. Exact filename suffix (version number) wasn't pinned here — read off the installed package's own file listing at `pnpm add` time rather than hardcoding a version that'll drift. | GPLv3 (engine) + MIT (wrapper) — see CLAUDE.md "Chess" for how we ship it unmodified rather than linking it into `src/`. |
| **Chesskit** (arunoruto/chesskit, Next.js) | Stockfish Worker + chess.js, live eval bar, custom arrow overlays, play-at-any-Elo. | Closest UX precedent for hint arrows + eval visualisation; confirms Worker + chess.js is the standard combo. | Uses a board library (not usable here — CLAUDE.md requires a hand-written board). | Reviewed for UX only, no code copied. |
| **eddmann's "Stockfish in a Web Worker" writeup** | Minimal Worker wiring tutorial: load engine script, `postMessage('uci')`, parse `bestmove`. | Clean, minimal confirmation of the exact wiring this game needs — no extra moving parts. | Toy-sized, no difficulty/variety/clock layer — those are ours to design. | Reviewed for approach only. |
| **lichess.org (lichess-org/lila)** | The reference deployment of Stockfish-in-a-Worker at scale; also the source of the piece-licence ledger used below. | Proves the single-Worker-per-tab architecture scales fine; `COPYING.md` is an authoritative, maintained record of which bundled piece sets are actually permissively licensed (several widely-assumed-free sets, e.g. `cburnett`, are GPLv2+ or CC-BY-SA, **not** usable here). | AGPL — read-only, no code copied. | Reviewed for architecture + licence research only. |

## 4. Stockfish difficulty calibration

Confirmed from the [official UCI options wiki](https://github.com/official-stockfish/Stockfish/wiki/UCI-&-Commands):

- `UCI_Elo` (spin, **min 1320, max 3190**) only takes effect when `UCI_LimitStrength` is `true`, and
  **overrides `Skill Level`** when it's on. This floor of 1320 makes `UCI_Elo` structurally unusable
  for a genuine beginner tier — it can never go low enough.
- `Skill Level` (0–20, default 20) is the only mechanism that reaches genuinely weak play. No
  official Elo table exists for it (checked the wiki and official repo — not published); only
  inconsistent forum anecdotes. We don't claim a precise Elo number for it in any UI copy.

**Chosen tiers** (tuned by testing against ourselves during build, final values below; all movetimes
are per-move search budgets for the single-threaded "lite-single" build):

| Tier | Engine options | Movetime | Rationale |
|---|---|---|---|
| **Easy** | `Skill Level = 1`, `UCI_LimitStrength = false` | 250 ms | Low but not 0 (0 can occasionally hang a piece in one move in a way that reads as "broken" rather than "beginner"; 1 still blunders often but keeps *some* search). Short movetime keeps it snappy and reinforces "weak" without needing to drop depth artificially. |
| **Medium** | `UCI_LimitStrength = true`, `UCI_Elo = 1500` | 700 ms | 1500 sits in the middle of the requested 1400–1600 band and is comfortably inside Stockfish's documented, *calibrated* 1320–3190 range — unlike Skill Level, this mechanism is the one Stockfish's own docs claim is Elo-anchored (to CCRL 40/4), so it's the better-justified choice for "land near a target human rating." |
| **Hard** | `UCI_LimitStrength = false`, `Skill Level = 20` (default/full strength) | 1200 ms, or less when the clock is low (see "Clock" in Chosen design) | Full-strength search at ~1s+ per move on a single-threaded lite build is well above club level; this is the standard "strong bot" config used by every reviewed implementation. |

Engine `Threads` is left at 1 (the lite-single build is single-threaded anyway) and `Hash` at its
small default — not worth tuning for a phone-friendly, short-lived Worker.

## 5. Move variety (MultiPV)

Real, commonly-used technique (confirmed via a 2026 engine-blog post and chess-programming forum
threads): request the top N principal variations via `MultiPV`, then weight/sample among the
returned moves by how many centipawns worse than the best each one is. Reported literature margins
for *pure strength testing* are narrow (~10–30cp before play measurably weakens) — but that's testing
variety as the *only* strength lever. Here, strength is already set by Skill Level / `UCI_Elo`
*before* MultiPV ever runs, so a wider margin at Easy/Medium doesn't make the bot stronger or weaker
— it only changes which of several already-similar-strength moves gets played. Hard keeps the
literature's tighter margin because at full strength a wider margin would start admitting real
mistakes.

- **Margins**: Hard 25cp (per task baseline), Medium 45cp, Easy 70cp. All three stay under a pawn's
  ~100cp value, which is the actual safety property the task asks for ("never pick a move that loses
  material outright") — since every candidate is within the margin of the *best* move's own eval, and
  outright material loss for nothing costs at minimum a pawn (~100cp) relative to not losing it, no
  candidate inside any of these margins can be an outright hanging piece. No second heuristic pass is
  needed on top of the margin filter.
- **Scope**: only for the engine's own moves, and only for its **first 10 moves of the game** (not
  10 plies — 10 times it's actually to move), matching the task. After that, MultiPV is dropped back
  to 1 (just play the best move) — endgames and tactical moments later in longer games shouldn't get
  "flavour" randomisation layered on top of an already-decided best line.
- **Parsing**: one `info … multipv N … pv …` line per PV index per depth; keep only the *last* (deepest)
  line seen for each `multipv` index before `bestmove` arrives, then sample among those N candidates.

## 6. Piece art

The task requires CC0, MIT, Apache-2.0 or CC-BY — explicitly **not** GPL and **not** CC BY-SA. This
ruled out the two most "obvious" choices:
- **cburnett** (the famous Wikipedia/lichess-default set) is **GPLv2+** per lila's own
  `COPYING.md` — excluded.
- Several other lila-bundled sets (`shapes`, and most of `sadsnake1`'s large catalogue — `staunty`,
  `fresca`, `cardinal`, etc.) are **CC BY-NC-SA** — excluded (non-commercial *and* share-alike).
- `HollowLeaf1981/ChessPieces` (MIT, found via a lichess community blog post) looked promising but
  every set in the repo is **PNG only** (verified via the GitHub API's file tree) — disqualified by
  the task's explicit "SVG set" requirement.

**Chosen: lila's `public/piece/rhosgfx` set**, by [RhosGFX](https://rhosgfx.itch.io/), licensed
**CC0 1.0** — confirmed directly in lichess's own `COPYING.md` (`public/piece/rhosgfx | RhosGFX |
CC0 1.0`). 12 SVG files (one per piece/colour), ~1.3–1.9 KB each (~20 KB total), fetched from
`raw.githubusercontent.com/lichess-org/lila/master/public/piece/rhosgfx/` (already an allow-listed
WebFetch domain in this repo's `.claude/settings.json`) rather than itch.io's download flow. CC0
needs no attribution at all, but RhosGFX is credited in HANDOFF.md anyway as good practice. The SVGs
are flat, slightly stylised (cream/charcoal palette, 72×72 viewBox, inline hex fills) — reads well
against a pink board and matches the site's "warm and playful" brief better than a stark line-art set
would.

## Chosen design (deviations explained)

- **No `GameLayout`, no `ResultModal`, no `StatsModal`, no `FriendsBoard`, no `NextPuzzleCountdown`,
  no `AlreadyPlayed`, no `SiteHeader`.** Traced each one: `GameLayout` calls `usePlays` (→
  `dataSource.listPlays`) unconditionally for its Archive button; `ResultModal`/`StatsModal` call
  `useStats`/`useFriendsResults` (→ `dataSource`) and render `FriendsBoard`; `SiteHeader` renders
  `GroupSwitcher` (→ `dataSource.listMyGroups`). All of that is explicitly out of bounds for chess
  ("never calls the DataSource... no friends board... no share-to-leaderboard"), and none of the
  concepts (Archive of daily puzzle days, "already played today") apply to a game you can play
  unlimited times. Chess gets its own small header (back link + title + Help/Settings icons, same
  visual language as `GameLayout`'s) and its own result modal (reuses `Modal`, `Button`,
  `ShareButton` — all verified DataSource-free — for the actual shared primitives, with its own
  personal-record row instead of `useStats`, "New game" instead of "next puzzle", "Copy PGN" instead
  of a friends board).
- **`celebrate()` is reused as-is** for a win — it's a pure confetti wrapper, no DataSource, exactly
  the "no per-game confetti" rule intends.
- **Local-only storage**, namespaced like the rest of the site's own non-DataSource local state
  (`src/lib/groups.ts`'s `sansitas-puzzles:active-group:<userId>` pattern):
  `sansitas-puzzles:chess:game:<userId>` (in-progress game) and
  `sansitas-puzzles:chess:record:<userId>` (personal win/loss/draw record). Every read/write wrapped
  in try/catch per the task; a storage failure degrades to "nothing persists," never to a crash.
- **No dark mode to support.** Audited `src/styles/brand.css` and every game's `theme.css` — there is
  **no** `prefers-color-scheme` or `data-theme` anywhere in this codebase; it's a single warm-pink
  light palette. The task's "stay clear in light and dark mode" is written against a site that
  doesn't have a dark mode yet, so this is scoped down to "good contrast in the one theme the site
  actually has," with token names chosen so a future site-wide dark mode could still override them
  under `[data-theme="dark"]` without renaming anything.
- **No `@playwright/test`, only the already-installed `playwright` library.** The repo has no
  Playwright test runner config anywhere (`scripts/shot.mjs` is the only existing use, and it's a
  one-off screenshot script against the raw `chromium` API) and the task allows no new packages
  beyond chess.js/stockfish. The "Playwright check" for move variety and the 375px/keyboard/
  refresh/hint/undo pass are both implemented as plain Node scripts
  (`scripts/chess/variety-check.mjs`, `scripts/chess/e2e-check.mjs`) scripting `chromium.launch()`
  directly against the dev server, the same way `shot.mjs` already does — reproducible and rerunnable
  without adding a dependency.
- **The GPL boundary.** Stockfish's own files (GPLv3) live untouched in `public/assets/chess/engine/`
  next to their licence file, loaded only as a Worker script via `postMessage`/`onmessage` — no
  Stockfish code is imported into, copied into, or linked with anything in `src/`. This is the same
  "separate process, message-passing boundary" pattern lichess.org itself uses (lichess is AGPL and
  bundles Stockfish the same arm's-length way), not a novel interpretation.
- **`scored?: boolean` on `GameMeta`, default `true`, `false` for chess** — this is the one place
  chess's presence is visible outside its own folder. `src/routes.tsx` gets a
  `scoredGameMetas = allGameMetas.filter(m => !m.id.startsWith("_") && m.scored !== false)` export,
  computed independently of `import.meta.env.PROD` so it's stable in tests too. `Hub.tsx`'s "`X / 14`"
  count and solved-count switch to it; the grid itself still renders every `gameMetas` entry
  (including chess) so the card shows up, just tagged "Just for fun · unscored" with no status badge
  instead of fetching a play status that will never exist. Finale's `required_games` check and the
  leaderboard are **already** correct with no code change at all — both are purely derived from rows
  in the `plays` table (or, locally, `localStorage` keys under `puzzles:play:`), and chess never
  writes one.

## Edge cases (each becomes a test)

- Difficulty → engine-option mapping for all three tiers (exact Skill Level / `UCI_LimitStrength` /
  `UCI_Elo` / movetime values above).
- MultiPV candidate picker: stays within margin, excludes nothing *inside* the margin, never returns
  a candidate more than ~1 pawn worse than best; stops applying after the engine's 10th move.
- Clock: increment applied after the mover's move (not before), tab-hidden pause/resume, a flag
  (time hits 0) is a loss for whoever ran out — *unless* the other side has insufficient mating
  material, which is a draw instead.
- Undo: steps back exactly two plies (yours, then the engine's reply); disabled once a clock is
  running; marks the game "assisted."
- Hint: doesn't mutate game state by itself; marks the game "assisted" the first time it's used.
- Save/restore: `JSON.parse(JSON.stringify(game))` round-trips to an identical game (PGN/FEN history,
  settings, clock times, assisted flags); corrupted/garbage storage falls back to a fresh game
  instead of throwing.
- Checkmate, stalemate, threefold repetition, 50-move rule, insufficient material (including the
  same-colour-vs-opposite-colour bishop distinction), promotion (all four piece choices), castling
  through/into/out of check (illegal in all three forms), en passant — each as its own `chess.js`-
  backed fixture position.

## Deliberately left out

- **Elo claims in the UI.** No official Skill-Level-to-Elo table exists; the UI says "Easy / Medium /
  Hard," not "≈1500," except where a number is actually calibrated-and-documented (none of the three
  tiers get a number shown to the player — avoids promising precision the engine doesn't give).
  (If the human wants Medium's "~1400–1600" surfaced as copy later, that's a one-line change, not a
  design question — left out here only because the task didn't ask for engine-strength numbers on
  screen.)
- **75-move auto-draw rule.** `isDrawByFiftyMoves()` already covers the player-facing 50-move claim;
  the stricter 75-move arbiter-only rule doesn't apply to an unsupervised two-party game.
- **A board UI library.** Explicitly ruled out by CLAUDE.md; the board is hand-written.
- **Any site-wide dark mode.** Out of scope — see "Chosen design" above.

## Skills used

- `motion-framer`: reused the exact spring presets already in `Button.tsx`/`Modal.tsx`
  (`{ type: "spring", stiffness: 420-500, damping: 30-32 }`) for piece drops/captures, gated behind
  `useReducedMotion` — consistency with the rest of the site mattered more here than inventing new
  timing.
- `ui-ux-pro-max`: queried for touch-target sizing and keyboard-focus-in-modal guidance (same checks
  sudoku's agent ran) before finalizing the board's tap targets and the settings/result modals.
- `playwright-cli` (interactive) + the two `scripts/chess/*.mjs` checks (see "Chosen design"): 375px
  and 1280px screenshots, a full keyboard-only pass, and the engine-variety proof.
- `web-design-guidelines`: fetched for a final self-review pass before calling the game done.

## Build plan

1. `public/assets/chess/engine/` — copy the installed `stockfish` package's lite-single build
   (js + wasm) and its licence file, unmodified. `public/assets/chess/pieces/` — the 12 RhosGFX SVGs.
2. `src/games/chess/logic.ts` (+ `logic.test.ts`) — pure functions: difficulty→engine-options,
   MultiPV candidate picker, clock math (tick/pause/increment/flag vs. insufficient material), undo,
   assisted-flag, save/restore (de)serialization, corrupt-storage fallback. No chess.js import needed
   here beyond types where useful — this is the one file every edge case above lands in.
3. `src/games/chess/lib/engine.ts` — thin Worker wrapper (spawn, UCI handshake, `go()` returning
   parsed candidates, `terminate()`). `src/games/chess/lib/storage.ts` — try/catch'd
   localStorage read/write for both keys.
4. `src/games/chess/components/` — `Board` (hand-written squares/pieces/drag+tap/legal-move dots/
   highlights/coordinates/keyboard cursor), `Piece` (renders the 12 RhosGFX pieces), `Clock`,
   `MoveList`, `CapturedPieces`, `PromotionPicker`, `SettingsModal` (difficulty/side/clock, remembers
   last choice), `GameResultModal` (own, not the shared `ResultModal`).
5. `src/games/chess/{meta.ts,index.tsx,theme.css}` — wires it all together; no `usePuzzle`/`usePlay`.
6. `scripts/chess/variety-check.mjs`, `scripts/chess/e2e-check.mjs` — the two Playwright-library
   checks described above, run against `pnpm dev --port 5215`.
7. `src/games/chess/HANDOFF.md`, screenshots, `CLAUDE.md`'s new "Chess" section, `scoredGameMetas`
   wiring, `scripts/check-scope.mjs`'s new `chess` scope entry, `pnpm test` + `pnpm build`, commit in
   small steps.
