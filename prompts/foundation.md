# Agent `foundation`: scaffold, frozen interfaces, local adapter (runs on main)

Read CLAUDE.md fully. You run **directly on main**, before the fan-out. Another agent (`data`) runs at
the same time in its own worktree, fetching word lists, geo data and archives. Don't create
`wordlists/`, `data/` or `public/assets/shared/`.

Your job is the part of the site that every other agent builds against. As soon as you're done,
15 agents start at once, and none of them may change what you freeze. So get the interfaces right,
keep them small, and make every shared piece work, even if it's plain-looking.

Work without waiting for approval. Commit in small steps on main.

## 1. Scaffold
- Vite + React + TS with **pnpm**. Add Tailwind v4, React Router, Vitest, tsx.
- Install everything in CLAUDE.md "Stack" plus fonts: @fontsource/fredoka, nunito, libre-franklin,
  dm-serif-display, space-grotesk, inter, poppins, source-serif-4, ibm-plex-mono. Also add 2–3 more
  font pairings the design agent could choose from, picked with the `ui-ux-pro-max` skill for a
  warm, playful feel.
- Read the `motion-framer` and `playwright-cli` skills and install exactly what they need
  (`motion`; `playwright` as a dev dependency), then run `pnpm exec playwright install chromium`
  once. Browsers go to a shared cache, so every worktree can use them.
- pnpm (v12 on this Mac) blocks dependency build scripts by default. If one the toolchain needs is
  blocked (e.g. esbuild), approve it the way the current pnpm docs describe for this version.
- `package.json` and `pnpm-lock.yaml` are frozen after this.
- Add a `pnpm shot <url> <out.png> [width]` script (Playwright, headless) so every agent can screenshot
  a page at 375px or desktop without writing its own.
- `vite.config.ts`: dev server port from `process.env.PORT` (default 5173) with `strictPort: true`.
- Exclude `.claude/**` everywhere the main checkout would otherwise see agent worktrees:
  Vitest `exclude`, tsconfig `exclude`, Vite `server.watch.ignored`. Without this, tests in main
  run all 15 agents' copies.
- `src/config.ts` exactly as in CLAUDE.md.
- `index.html`: `<meta name="robots" content="noindex, nofollow">`; `public/robots.txt`: `Disallow: /`.

## 2. Frozen interfaces
- `src/lib/data/types.ts`: the DataSource interface from CLAUDE.md, exactly.
- `src/components/types.ts`: the props of every shared component listed in CLAUDE.md. Think about what
  13 different games will need: e.g. Keyboard (key states, onKey, optional per-key render prop,
  extra keys such as Enter/Backspace), ResultModal (won, summary, score, extra content slot),
  HelpModal (children), GameLayout (game, title, header actions). Prefer optional props and children
  slots over narrow APIs, since nobody can extend these later during the build.
- `src/styles/brand.css`: every token name: site tier (`--brand-*`, spacing, radii, motion) and
  game tier (`--game-bg`, `--game-fg`, `--game-surface`, `--game-border`, `--game-accent`,
  `--game-font`, `--tile-radius`, `--tile-correct`, `--tile-present`, `--tile-absent`, plus any
  others games need), with neutral placeholder values, mapped to Tailwind v4 via `@theme inline`.
  The design agent will change values, never names.

## 3. Shared library (`src/lib`)
- `daily.ts`: `todayKey()` = today's date in PUZZLE_TIMEZONE via Intl (test around midnight IST
  with fake timers, e.g. 18:29 and 18:31 UTC), `addDays` (UTC math), `dayIndex`, `mulberry32`, `shuffle`.
- `data/local.ts`: the dev adapter. Puzzles come from `content/puzzles/` through a dev-only mechanism
  (Vite dev-server middleware, or `import.meta.glob` behind `import.meta.env.DEV`), so `content/` is
  never in a production bundle. Plays and stats in localStorage, mirroring the database rules: no future
  puzzles, one play per game per date, finished plays immutable, variant switch only before any state is
  saved, streaks counting on-day wins only. `?date=` override supported here only. Friends results:
  two fake friends so the UI can be built.
- `data/supabase.ts`: a stub that throws "not implemented" (the backend agent builds it).
  `data/index.ts`: picks the adapter from VITE_DATA_SOURCE (local by default in dev).
- `auth.tsx`: AuthProvider, useAuth, RequireMember. Implement a local mode where you're always signed in
  as a fake member, plus the exported types the backend agent will fill in.
- `hooks.ts` (usePuzzle, usePlay with debounced save flushed on visibilitychange/pagehide, useStats,
  useFriendsResults), `result.ts`, `share.ts`, `wordle-score.ts` (tests: LLAMA/HELLO, ABBEY/BABES,
  SPEED/ERASE), `geo.ts` (tests with known city pairs), `celebrate.ts` (reduced motion), `types.ts` (GameMeta).
- Tests for the local adapter covering every rule above.

## 4. Shared components, functional and plainly styled
Implement every component in `src/components/types.ts` so it fully works: accessible Modal (focus trap,
Esc), Keyboard with physical-key support, ResultModal with stats + ShareButton + FriendsBoard +
NextPuzzleCountdown, ArchivePicker, and so on. Style them only with the semantic tokens and keep the
styling minimal; the design agent restyles them in parallel.

## 5. Routes, pages, example game
- `routes.tsx`: discover `src/games/*/meta.ts` (eager) and `index.tsx` (lazy) via `import.meta.glob`.
  Routes: `/` Hub, `/<id>`, `/signin`, `/join`, `/profile`, `/finale`, `/dev/themes` (dev only).
- Pages: working but plain Hub (cards from metas, done/in-progress marks) and DevThemes, plus stubs
  for SignIn, Join, Profile and Finale.
- `src/games/_example/`: a tiny complete game that shows the whole contract: restore from state,
  start on first move, finish with a spoiler-free summary, ResultModal, theme.css, RESEARCH.md and
  HANDOFF.md templates, and the two required tests (state round-trip, no answer in summary). Ids
  starting with `_` are hidden from the hub in production. Also add a tiny `content/puzzles/_example/`.

## 6. Wire up the provided files
- Keep `supabase/`, `scripts/check-scope.mjs`, `scripts/launch.sh`, `prompts/` and `.claude/settings.json`
  as they are.
- package.json scripts: `test`, `build`, `dev`, `test:db` (`node supabase/tests/schema.test.mjs
  supabase/migrations/0001_init.sql`), `scope` (`node scripts/check-scope.mjs`).

## 7. Finish
`pnpm test`, `pnpm test:db` and `pnpm build` pass; `pnpm build` output contains nothing from
`content/`. Commit. Reply with what's frozen (list the component prop types) and anything the
fan-out agents should know.
