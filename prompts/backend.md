# Agent `backend`: Supabase adapter, sign-in, puzzle upload

Read CLAUDE.md. Dev server port: **5102**. Scope check: `node scripts/check-scope.mjs backend`.
You may edit `supabase/`, `src/lib/data/supabase.ts` (+ `supabase.test.ts`), `src/lib/auth.tsx`,
`src/pages/SignIn.tsx`, `src/pages/Join.tsx`, `src/pages/Profile.tsx`, `scripts/upload-puzzles.ts`,
`.env.example` and `docs/research/backend.md`.

You run at the same time as 13 game agents and the design agent. Games use the local adapter; you
build the Supabase adapter behind the **same frozen `DataSource` interface** (`src/lib/data/types.ts`).
Don't change that interface or any hook signatures. Keep `auth.tsx`'s exported API as the foundation
defined it. You may need a Supabase project for manual testing; if you don't have credentials,
build and test everything against mocks and PGlite, and list what needs a live check in your summary.

Work without waiting for approval.

## 1. Research → `docs/research/backend.md`
`supabase/migrations/0001_init.sql` is provided and tested (`pnpm test:db`, 25 checks). Read it and its
test first. Then research Supabase best practice for: Google OAuth in a Vite SPA (PKCE, redirect
handling, session persistence), RLS performance (wrapping `auth.uid()` in a select, indexes), typed
clients (`supabase gen types`), and safe service-role usage. If research finds improvements, add them
in a NEW migration file (never edit 0001) and extend the PGlite test for each change.

## 2. Build
- `supabase.ts`: DataSource exactly as `types.ts` defines it. getPuzzle reads `puzzles` (RLS hides
  future rows → return null). startPlay inserts; savePlay updates state/variant; finishPlay sets
  status, summary, score and state in one update. getStats → rpc `my_stats`. getFriendsResults →
  rpc `friends_results`. Map database errors to friendly messages ("You've already played this one").
- `auth.tsx`: AuthProvider (session + member profile), RequireMember (→ /signin, then /join).
- SignIn, Join and Profile use site-tier tokens and shared components only (the design agent restyles
  those). Check them against `ui-ux-pro-max` and `web-design-guidelines`.
- SignIn: "Continue with Google". Join: reads `?code=` (pre-filled), asks for a display name, calls
  `join_with_invite`. Profile: edit display name, sign out, per-game stats.
- `scripts/upload-puzzles.ts`: reads `content/puzzles/*/*.json` and upserts into `puzzles` in batches
  of 500 using SUPABASE_SERVICE_ROLE_KEY from `.env.local`. Flags: `--game`, `--from`, `--dry-run`.
  Prints counts per game. Refuses to run if the key is missing or VITE_-prefixed.
- `.env.example` documenting every variable and which must never be public.
- Tests with a mocked Supabase client for the adapter's mapping and error handling.

## 3. Finish
`pnpm test`, `pnpm test:db` and `pnpm build` pass, scope check passes, commit, and reply with a
summary plus the manual steps that need a live Supabase project.
