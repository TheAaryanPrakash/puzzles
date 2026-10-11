# Puzzles

A private, invite-only daily puzzle site. Fourteen original browser puzzle games, one new puzzle
per game per day, shared by a small group of friends who sign in with Google and join by invite
code. Streaks, a shareable spoiler-free result, friend groups, and group/global leaderboards.

## Features

- **14 daily games**, each a from-scratch build that evokes its original but isn't a clone:

  | Game | |
  |---|---|
  | Wordle | Guess the word in 6 tries |
  | Quordle | Four Wordles, nine shared guesses |
  | Spelling Bee | Find words that use the center letter |
  | Digits | Hit the target with + − × ÷ |
  | Sudoku / Mini Sudoku | Fill the grid — every row, column and box |
  | Connections | Group sixteen words into four categories |
  | Mini Crossword | A tiny crossword, fresh every day |
  | Worldle | Guess the country from its silhouette |
  | Zip | Draw one path through every cell, in order |
  | Flagle | Guess the flag, one tile at a time |
  | Globle | Guess the country, one border-distance at a time |
  | Travle | Chart a land route from one country to another |
  | States | Guess the Indian state or union territory from its silhouette |

- Everyone gets the **same puzzle** per game per day, playable **once**; progress syncs across
  devices. Past days are replayable from an archive (no streak credit).
- Per-game streaks and stats, a spoiler-free share button, and a friends board that only reveals
  results once you've finished that day's puzzle yourself.
- **Friend groups**: a member can belong to several groups (up to three created per person), each
  with its own invite link. The friends board and leaderboard are always scoped to one active
  group, remembered per device, or to everyone for the global leaderboard.
- **Leaderboard**: points for an on-day win, with streak bonuses (+1 at a 3-day streak, +2 at 7);
  catching up from the archive is free to play but scores zero. Today or this-week views, scoped
  to one group or global. All scoring is computed in SQL, not the client.
- Invite-only and not indexed (`robots.txt` disallows everything, `noindex` meta tag).

## Tech stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS v4 + React Router. Vitest for tests.
- **Backend**: Supabase — Google OAuth, Postgres with row-level security. No custom server; every
  rule that matters (released puzzles only, one play each, streaks, points, group membership) is
  enforced in the database, not trusted from the client.
- **Hosting**: Vercel, static build, SPA rewrite to `index.html`.
- **Package manager**: pnpm.

## Project structure

```
src/
  config.ts              launch date, puzzle schedule length, archive cutoff, puzzle timezone
  lib/
    daily.ts              todayKey (date in the puzzle timezone), dayIndex, mulberry32, shuffle
    data/                  the only code that talks to storage or the backend
      types.ts             DataSource interface
      local.ts              dev adapter: content/ files + localStorage, no Supabase project needed
      supabase.ts            production adapter
    auth.tsx               Google OAuth session + membership gating
    groups.ts              active-group selection, synced across the page
    hooks.ts                usePuzzle, usePlay, usePlays, useStats, useFriendsResults, useLeaderboard
    result.ts, share.ts, wordle-score.ts, geo.ts, celebrate.ts
  components/              shared UI: GameLayout, SiteHeader, modals, FriendsBoard, GroupSwitcher, ...
  games/<id>/              meta.ts, index.tsx, logic.ts (+ tests), theme.css, components/
  pages/                   Hub, SignIn, Join, Profile, Groups, Leaderboard
  routes.tsx               auto-discovers games via import.meta.glob
content/puzzles/<id>/      generated puzzles, YYYY-MM-DD.json — not shipped in the client build
public/assets/<id>/        non-secret runtime files per game (word lists, silhouettes)
scripts/<id>/              puzzle generators/importers for that game
scripts/upload-puzzles.ts  upserts content/ into the puzzles table (service role key, local only)
supabase/migrations/       SQL schema, in order
supabase/tests/            schema.test.mjs — runs every migration against PGlite with an auth shim
wordlists/, data/          committed raw word lists and reference data
docs/                      design-system and backend research notes, before/after screenshots
```

## Data layer

Games never talk to Supabase directly — they go through the `DataSource` interface
(`src/lib/data/types.ts`), implemented by a `local` adapter (fixture data in `localStorage`, for
building and testing a game without a backend) and a `supabase` adapter (the real thing). Which one
is active is picked by `VITE_DATA_SOURCE` in `.env.local`.

A game's state is plain JSON, fully restorable (in-progress plays pick up exactly where they left
off, including from another device), and the day's puzzle is resolved from `usePuzzle`, never from
the device's local date — every member sees the same puzzle on the same calendar day in
`PUZZLE_TIMEZONE`.

## Database

`supabase/migrations/` is the schema, applied in filename order. Row-level security is enabled on
every table; anything that needs to bypass it (reading another group member's profile, joining by
invite code, computing the leaderboard) goes through a `security definer` SQL function rather than
loosening a policy. `supabase/tests/schema.test.mjs` applies the full migration history to an
in-memory Postgres (via `@electric-sql/pglite`) with a minimal `auth` shim, and asserts the RLS and
scoring rules directly — no live project required to run it.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # see below
pnpm dev
```

`.env.local`:

- Leave `VITE_DATA_SOURCE` unset (or `local`) to develop against the local fixture adapter — no
  Supabase project needed.
- Set `VITE_DATA_SOURCE=supabase` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (both
  safe to ship in the client; RLS still applies) to run against a real project.
- `SUPABASE_SERVICE_ROLE_KEY` is only for `scripts/upload-puzzles.ts`, run locally with `npx tsx`.
  Never set it as a `VITE_`-prefixed variable, and never set it in Vercel.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check (`tsc -b`) and build |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:db` | Run the Postgres schema/RLS/scoring tests against every migration, via PGlite |
| `pnpm shot` | Playwright screenshots at 375px and 1280px, used for visual review |
| `node scripts/upload-puzzles.ts` | Push generated puzzles from `content/` into Supabase |

## Puzzle generation

Each game's generator lives in `scripts/<id>/` and is deterministic — seeded from `mulberry32`
(`src/lib/daily.ts`), never `Math.random()` — and idempotent, writing one JSON file per playable
day into `content/puzzles/<id>/`. A generator throws rather than publish a day it isn't confident
in, and writes a human-reviewable sample report to `scripts/out/<id>-samples.md`. Archive games
(Connections, Mini Crossword) only draw from puzzles published before a cutoff date, with
publisher metadata stripped.
