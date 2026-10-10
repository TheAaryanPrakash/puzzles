# Sansita's Puzzles — project rules

Read this fully at the start of every session. PLAN.md has the build phases and task prompts.

## What this is
A daily puzzle site with 14 games, started as a birthday gift for Sansita (birthday: 23 January).
- Invite-only: friends sign in with Google and join with an invite code. Not public; not indexed.
- Every member gets the **same puzzle** for each game each day.
- Each member can play each puzzle **once**. Progress syncs across devices (phone and laptop).
- Streaks and stats per game, a share button for results, and a friends board that shows how
  others did — only after you finish, so nobody gets spoiled.
- Birthday extras (banner, finale message) are for Sansita on 23 January.

## Key settings — `src/config.ts` is the single source of truth
```ts
export const LAUNCH_DATE     = "2026-10-17";   // first playable day
export const BIRTHDAY        = "2027-01-23";   // finale day
export const SCHEDULE_DAYS   = 365;            // generators write this many days from LAUNCH_DATE
export const ARCHIVE_CUTOFF  = "2025-04-01";   // archive puzzles must be published before this
export const PUZZLE_TIMEZONE = "Asia/Kolkata"; // everyone's puzzle day; must match the database
```
Generators, the app and `supabase/migrations` agree on these. Never hardcode dates or time zones elsewhere.

## Stack
- Frontend: Vite + React + TypeScript + Tailwind CSS v4 + React Router. Vitest for tests.
- Backend: Supabase — Google sign-in, Postgres with row-level security (RLS). No custom server.
  All rules that matter (released puzzles only, one play each, streaks) are enforced in the database.
- Hosting: Vercel (static build). Scripts run with `npx tsx`.
- Package manager: **pnpm** (its shared store keeps 15 worktrees from each costing a full node_modules).
- Libraries are installed by the foundation agent and then frozen (see "Parallel work rules"):
  @supabase/supabase-js, d3-geo, topojson-client, world-atlas, flag-icons, canvas-confetti,
  react-router, motion (animation), @fontsource/* (per game),
  dev: vitest, tsx, @electric-sql/pglite, playwright (screenshots and browser checks).

## Skills (`.claude/skills/`)
The project has design skills. Use the ones mapped to your role, read each one's SKILL.md before you
start the work it covers, and list the skills you used in your RESEARCH.md. Skills that don't fit a
puzzle site (3D engines, scroll-driven marketing pages, AI image generation) are blocked in
`.claude/settings.json`.

| Agent | Skills |
|---|---|
| design | `design-system` (token architecture → our two tiers), `ui-ux-pro-max` (palette, font pairing, UX rules), `design-taste-frontend` and `high-end-visual-design` (so it doesn't look templated), `modern-web-design` (micro-interactions, accessibility), `ui-styling` (Tailwind patterns), `motion-framer`, `brand` (warm voice for microcopy), then `web-design-guidelines` + `playwright-cli` for a final audit |
| every game agent | `motion-framer` (the game's signature animations), `ui-ux-pro-max` (the game's palette, contrast and accessibility), `playwright-cli` (screenshots at 375px and desktop, keyboard-only run), `web-design-guidelines` (self-review before finishing) |
| backend | `ui-ux-pro-max` and `web-design-guidelines` for the sign-in, join and profile pages |
| integration | `playwright-cli` + `web-design-guidelines` for the cross-game visual pass, `redesign-existing-projects` (audit only, no redesign), `motion-framer` for the finale |

When a skill and this file disagree, **this file wins**:
- Never install a package a skill suggests. Use what's installed (`motion`, `canvas-confetti`, CSS).
  No shadcn/ui, Radix, GSAP, Three.js or other libraries.
- Game pages evoke their original game. Use the taste skills for craft (spacing, type, motion,
  states), not to reinvent a game's familiar layout.
- The site's feel is warm and playful. Skills don't override the token tiers or frozen interfaces.
- Skills that generate images or call external AI services are out of scope.

## Directory layout
```
src/
  config.ts
  lib/
    daily.ts          todayKey (date in PUZZLE_TIMEZONE), addDays, dayIndex, mulberry32, shuffle
    data/             the ONLY code that talks to storage or the backend
      types.ts        DataSource interface (below)
      local.ts        dev adapter: content/ files + localStorage. Game agents use this.
      supabase.ts     production adapter
      index.ts        picks the adapter from VITE_DATA_SOURCE (local | supabase)
    auth.tsx          AuthProvider, useAuth, RequireMember
    hooks.ts          usePuzzle, usePlay, useStats, useFriendsResults
    result.ts         completeGame → saves final state + celebrate() on win
    share.ts          shareResult(text): Web Share API, clipboard fallback
    wordle-score.ts   scoreGuess(guess, answer) — shared by Wordle and Quordle
    geo.ts            centroid, distanceKm, bearing, bearingArrow, proximityPct
    celebrate.ts      confetti wrapper (canvas-confetti)
  components/         GameLayout, SiteHeader, Modal, Button, HelpModal, StatsModal, ResultModal,
                      FriendsBoard, Keyboard, ShareButton, NextPuzzleCountdown, NoPuzzleToday,
                      ArchivePicker, AlreadyPlayed
    types.ts          FROZEN prop types for every shared component
  styles/brand.css    site-tier tokens
  games/<id>/
    meta.ts  index.tsx  logic.ts  logic.test.ts  theme.css  components/
    RESEARCH.md       research findings and chosen approach (written first)
    HANDOFF.md        what was built, what to review, shared changes needed
  pages/              Hub, SignIn, Join, Profile, Finale, DevThemes
  routes.tsx          auto-discovers games via import.meta.glob
content/puzzles/<id>/ YYYY-MM-DD.json — generated puzzles. NOT in public/: never shipped in the build.
public/assets/<id>/   non-secret runtime files for one game (guess lists, silhouettes)
public/assets/shared/ geo and name tables from the data agent — read-only for everyone else
scripts/<id>/         generators/importers for that game
scripts/upload-puzzles.ts   upserts content/ into the puzzles table (service role key, local only)
scripts/out/          <id>-samples.md review reports (committed)
supabase/migrations/  SQL schema — 0001_init.sql is provided and tested
supabase/tests/       schema.test.mjs (runs the schema in PGlite with an auth shim)
wordlists/  data/<id>/  committed raw inputs (not gitignored, so every worktree has them)
prompts/<agent>.md    one task prompt per parallel agent; prompts/_game.md is the shared game procedure
scripts/launch.sh     starts the parallel agents (tmux, one `claude -w` worktree each)
scripts/check-scope.mjs   fails if a branch touched files outside its agent's scope
.claude/settings.json permission allowlist + worktree.baseRef = "head"
.claude/worktrees/    agent worktrees (gitignored; excluded from Vitest, tsc and Vite)
```

## Data layer (games never import Supabase)
```ts
// src/lib/data/types.ts
export type PlayStatus = "in_progress" | "won" | "lost";
export interface Play<S = unknown> {
  gameId: string; date: string; variant: "main" | "reserve";
  status: PlayStatus; state: S; summary?: string; score?: number;
}
export interface DataSource {
  getPuzzle<T>(gameId: string, date: string): Promise<{ main: T; reserve?: T } | null>; // null = missing or not released
  getPlay<S>(gameId: string, date: string): Promise<Play<S> | null>;
  startPlay(gameId: string, date: string, variant?: "main" | "reserve"): Promise<Play>;
  savePlay<S>(gameId: string, date: string, patch: Partial<Pick<Play<S>, "state" | "variant">>): Promise<void>;
  finishPlay(gameId: string, date: string, result: { won: boolean; state: unknown; summary: string; score?: number }): Promise<void>;
  getStats(): Promise<Record<string, { played: number; won: number; currentStreak: number; maxStreak: number }>>;
  getFriendsResults(gameId: string, date: string): Promise<{ name: string; status: PlayStatus; summary: string; score?: number }[]>;
  listPlays(gameId: string): Promise<{ date: string; status: PlayStatus; score?: number }[]>;
}
```
Hooks wrap this. A game uses only:
- `usePuzzle<T>(id)` → `{ date, puzzle, status: "loading" | "ready" | "missing" }` (respects the play's
  variant, and — via `?day=` — an archive day; see "Game contract")
- `usePlay<S>(id, date)` → `{ play, start, save, finish }`. `save` is debounced (~400 ms) and flushed on
  `visibilitychange`/`pagehide`. `finish` calls `completeGame`.
- `usePlays(id)` → `{ plays, loading, refresh }`, every play for one game, sorted by date. Powers
  GameLayout's built-in Archive button; a game can also build its own stats (e.g. a guess-distribution
  chart) from `plays[].score`.

## Game contract
```ts
// src/games/<id>/meta.ts
export const meta: GameMeta = {
  id: "wordle", title: "Wordle", order: 1,
  tagline: "Guess the word in 6 tries", hubAccent: "#6aaa64", font: "Libre Franklin",
};
```
- `index.tsx` renders inside `<GameLayout game={meta.id} title={meta.title}>`.
- **Game state is plain JSON and fully restorable.** On load: no play → fresh game; in-progress play →
  restore exactly where she left off (possibly from another device); finished play → read-only
  finished board + ResultModal. There is no "play again" for a finished puzzle.
- Start the play (`start()`) on the first meaningful move, not on page load. Save after every move.
- When the game ends, call `finish({ won, state, summary, score })`.
- `summary` is the **spoiler-free share text**: title, puzzle number (`dayIndex + 1`), emoji grid or
  score, site URL. It must never contain the answer. Test this.
- Use the shared ResultModal (stats + share + friends board), HelpModal, NextPuzzleCountdown,
  NoPuzzleToday, AlreadyPlayed. Theme them via tokens; don't fork them.
- Reserve puzzles (Connections, Mini): "Seen this before? Skip" is offered only before the first
  move, and switches the play's variant. The database refuses a switch after that.
- **Day files.** `content/puzzles/<id>/<date>.json` = `{ "payload": <puzzle>, "reserve": <puzzle> | null }`.
  Where a game's own prompt says "Day file `{ ... }`", that's the **payload** shape for that game —
  use `"reserve": null` unless the prompt asks for a reserve.
- **The `{}` gotcha.** Right after `start()`, `play.state` is briefly `{}` — the database's own
  `default '{}'::jsonb`, mirrored by the local adapter — not yet shaped like the game's state. Derive
  state as `{ ...DEFAULT_STATE, ...play?.state }`, **never** `play?.state ?? DEFAULT_STATE`: the
  latter only catches `null`/`undefined`, so it still crashes on that empty-but-truthy `{}` in the
  render between `start()` resolving and the first `save()` landing.
- **Archive days** arrive through `?day=<date>` (resolved by `src/lib/daily.ts`'s `resolvePuzzleDate`,
  LAUNCH_DATE ≤ day ≤ today, otherwise today) and `GameLayout`'s built-in Archive button — a game needs
  no code for either. Always use the `date` that `usePuzzle` returns; never call `todayKey()` directly
  inside a game.

## Daily rules
- Puzzle day = calendar date in `PUZZLE_TIMEZONE` for every player, everywhere. `todayKey()` uses
  `Intl.DateTimeFormat` with that zone — never the device's local date.
- The database only returns puzzles with `puzzle_date <= today` (India time). Future answers never
  leave the server, and the build must contain no puzzle content (Phase 3 checks `dist/`).
- Today's puzzle payload does include its answer. This is an accepted trade-off for a friends site;
  don't build server-side guess checking unless a task asks for it.
- Past days from LAUNCH_DATE are playable via ArchivePicker (once each). Archive plays count as
  played but never extend a streak. Future days are blocked.
- Dev only: with the local adapter, `?date=YYYY-MM-DD` overrides today. Never active in production.

## Generators
- Deterministic: seeded `mulberry32` from `lib/daily.ts`. Never `Math.random()` in scripts.
- Idempotent. Write only to `content/puzzles/<id>/` for LAUNCH_DATE … LAUNCH_DATE + SCHEDULE_DAYS − 1.
- Throw if there aren't enough valid puzzles for every day.
- Write `scripts/out/<id>-samples.md`: 5 random days rendered readably, plus pool stats and anything
  suspicious. The human reviews it before the UI is built.

## Word data
- Valid guesses: `wordlists/enable1.txt`. Fair answers: ENABLE ∩ `wordlists/common.txt`.
- Always remove `wordlists/blocklist.txt` entries from answers.

## Archive data (Connections, Mini crossword)
- Only puzzles published before ARCHIVE_CUTOFF. Strip NYT metadata (authors, editors, numbers, copyright).
- Validate on import; drop and report invalid puzzles. Seeded random order. One reserve per day.

## Research first — every game task
The task prompts give requirements, not the final method. Before planning, research how this game
is best built, then build it the best way you find.
1. Read the original game's official rules/help page for exact rules, scoring and UX details
   (animations, keyboard behaviour, edge cases, what the share text looks like).
2. Find at least 3 well-regarded open-source implementations or clones (GitHub stars, activity,
   tests) and any write-ups of the algorithms involved (generation, solving, uniqueness, validation).
3. For each, note: approach, strengths, known bugs/edge cases, accessibility, mobile UX, licence.
4. Write `src/games/<id>/RESEARCH.md`: sources with links, a comparison table, the chosen approach
   and why, every edge case found (each becomes a test), and what you're deliberately leaving out.
5. End RESEARCH.md with your build plan, then build it. **Don't wait for approval** — many agents run
   at once and the human reviews at the end. Deviations from the task prompt are welcome when the
   research supports them; explain them in RESEARCH.md and HANDOFF.md.

Code reuse: learn from implementations; copy code only from MIT/BSD/ISC/Apache-2.0 projects, keep
their licence notice in the copied file, and list it in HANDOFF.md. Never copy GPL/AGPL or
unlicensed code. No new npm packages. The contract, data layer and parallel rules always win.

## Design
Overall feel: warm and playful. Each game page evokes its original game.
- **Site tier** (`src/styles/brand.css`, `--brand-*`, spacing, radii, motion): never overridden. Used by
  SiteHeader, Hub, SignIn, Join, Profile, Finale, and modal structure.
- **Game tier** (`--game-*`, `--tile-*`): defaults in brand.css, overridden in
  `src/games/<id>/theme.css` under `[data-game="<id>"]`.
- Components use semantic Tailwind classes only (`bg-game-surface`, `text-tile-correct`). No raw hex
  in components.
- Games may change colour, font, tile shape, texture and signature animations. Header, modal layout,
  spacing scale and motion durations stay shared.
- Wins celebrate via `completeGame` → `celebrate()`. No per-game confetti.
- Game fonts via `@fontsource/<font>` imported in that game's `index.tsx`. Free lookalike fonts only.
- Mobile-first (375px), full physical-keyboard support, touch support, `prefers-reduced-motion`.

## Quality bar — a task is not done until
- `RESEARCH.md` exists and the build follows it.
- Game logic lives in `logic.ts` as pure functions with Vitest tests covering every edge case in
  RESEARCH.md and the task prompt.
- A test serialises mid-game state to JSON, restores it, and gets an identical game.
- A test proves the share summary never contains the answer.
- `pnpm test` and `pnpm build` pass. Works at 375px and with a physical keyboard.
- `scripts/out/<id>-samples.md` and `src/games/<id>/HANDOFF.md` are written.
- `node scripts/check-scope.mjs <agent>` passes, and all work is committed.

## Parallel work rules
Up to 15 agents run **at the same time**: design, backend and 13 game agents (sudoku covers both
Sudoku and Mini Sudoku). Each runs in its own worktree, started by `scripts/launch.sh` as
`claude -w <agent>`: folder `.claude/worktrees/<agent>/`, branch `worktree-<agent>`, branched from
main's HEAD. Nobody depends on anyone else's unfinished work, so nobody waits.

**Scopes.** Each agent may only create or edit its own paths. `scripts/check-scope.mjs` holds the
exact list and is the source of truth.
| Agent | May edit |
|---|---|
| `<game>` | `src/games/<id>/`, `scripts/<id>/`, `scripts/out/<id>-*`, `content/puzzles/<id>/`, `data/<id>/`, `public/assets/<id>/` |
| `design` | `src/styles/`, `src/components/` (not `types.ts`), `src/pages/Hub.tsx`, `src/pages/DevThemes.tsx` |
| `backend` | `supabase/`, `src/lib/data/supabase*.ts`, `src/lib/auth.tsx`, `src/pages/{SignIn,Join,Profile}.tsx`, `scripts/upload-puzzles.ts`, `.env.example` |

**Frozen for everyone** (the foundation agent creates them; only the human changes them, on main):
`package.json`, `pnpm-lock.yaml`, `CLAUDE.md`, `src/lib/data/types.ts`, `src/components/types.ts`,
and the token *names* in `src/styles/brand.css` (design may change values, never rename or remove).

**Working against interfaces, not each other.**
- Game agents use the shared components as they exist on main: functional but plainly styled.
  The design agent restyles them in parallel without changing their props, so games pick up the
  new look automatically at merge time. Never style around a shared component's internals.
- Game agents use the local adapter (`VITE_DATA_SOURCE=local`) and need no Supabase project. The
  backend agent builds the Supabase adapter against the same frozen `DataSource` interface.
- Geo and word data from the data agent is already on main (`wordlists/`, `data/`,
  `public/assets/shared/`). Treat it as read-only.

**When something shared is missing or wrong:** don't edit it. Work around it inside your own folder
(e.g. a local helper), and describe the shared change you need in your HANDOFF.md under
"Shared changes requested". Keep working; never stop to ask.

**Dev server:** use the port in your prompt file: `PORT=<port> pnpm dev`. Never the default port,
since 15 dev servers run at once. Stop your dev server before you finish.

**Git:** commit on your own branch in small steps. Never push, merge, rebase or touch main. Before
finishing, run `node scripts/check-scope.mjs <agent>` and fix anything it reports.
