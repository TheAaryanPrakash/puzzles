# Backend research

Scope: `supabase/`, `src/lib/data/supabase.ts`, `src/lib/auth.tsx`, `src/pages/{SignIn,Join,Profile}.tsx`,
`scripts/upload-puzzles.ts`, `.env.example`. See `prompts/backend.md`.

## 1. Read `supabase/migrations/0001_init.sql` and its test first

`0001_init.sql` already encodes every rule that matters: invite-gated membership (`is_member()`,
`join_with_invite`), release gating (`puzzles` RLS using `puzzle_date <= puzzle_today()`), one play
per user/game/date (`plays` primary key + the `plays_guard` trigger, which also freezes a play once
it's `won`/`lost` and forbids reserve-switching after the first move), streaks (`my_stats`, counting
only wins started on their own puzzle day), and spoiler-safe friends boards (`friends_results`,
empty until the caller has finished that puzzle themselves). `supabase/tests/schema.test.mjs` proves
all of this against PGlite (25 checks). I read both before changing anything and never touched
`0001_init.sql` itself — only additive migrations.

## 2. Supabase + Vite SPA research

### Google OAuth (PKCE) in a browser SPA
- Supabase Auth's [PKCE flow docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow): after
  `signInWithOAuth({ provider: 'google' })`, the browser is redirected back with a `?code=` param.
  With `flowType: 'pkce'` and `detectSessionInUrl: true` (the client defaults for a browser), the
  client itself exchanges that code for a session on load — no manual `exchangeCodeForSession` call
  needed in `auth.tsx`. The code verifier lives in the browser that started the flow, so the whole
  round trip has to happen in the same browser/device (true for everyone here: no email links,
  no cross-device handoff).
- Edge case found and deliberately left out: two PKCE flows started in the same browser (e.g. two
  tabs) before either finishes will overwrite each other's code verifier and the first exchange
  fails. Fixable with `auth.experimental.appendPkceFlowIdToRedirects`, but not worth it for a
  dozen friends signing in once each — noted here instead.
- `persistSession: true` + `autoRefreshToken: true` (supabase-js defaults, set explicitly in
  `supabase.ts` for clarity) keep a member signed in across visits/devices without re-auth, which
  the "progress syncs across devices" requirement depends on.
- `redirectTo` is set to `window.location.origin` — simplest option that always lands back on the
  Hub's route tree, which then resolves to the right page (`RequireMember` → `/signin` or `/join`
  as needed) regardless of where sign-in was triggered from. Every dev port used by an agent
  (5102, plus whatever the other 14 use) and the eventual Vercel URL need to be added to Supabase's
  redirect allow-list — documented in `PLAN.md`, not something this code can do for itself.

### RLS performance
See [Supabase's RLS performance guide](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select):
wrap `auth.uid()` (and any stable helper built on it, like `is_member()`) in `select ...` inside a
policy, so Postgres caches it once per statement (an InitPlan) instead of re-evaluating it per row;
and index every column a policy filters on, since a composite primary key only indexes its leading
column. `0001_init.sql` didn't do either yet. Since it's already tested and the human said never to
edit it, I added `supabase/migrations/0002_rls_performance.sql`:
- Rewrites every policy's `auth.uid()` / `is_member()` reference as `(select ...)` (profiles,
  puzzles, plays, messages).
- Adds `plays (game_id, puzzle_date)` — `friends_results()` filters by exactly that pair across
  every member, and `plays`'s own PK only indexes `user_id`.
- Adds `messages (recipient)` — that table had no index beyond its own surrogate `id`, so the
  "recipient reads unlocked messages" policy was a full scan.
- Extended `schema.test.mjs` to run every `*.sql` file in `supabase/migrations/` in order (instead
  of just the one path given on the CLI) and to assert both new indexes exist via `pg_indexes` —
  `package.json`'s `test:db` script is frozen, so this had to work without changing that invocation.
  27/27 checks pass with both migrations applied.
- Left out: rewriting `puzzle_today()` calls the same way. It's `stable` and only reads `now()`,
  and unlike `auth.uid()`/`is_member()` it isn't the specific case Supabase's guide calls out — not
  worth the churn of touching every policy a second time for a function this cheap.

### Typed clients
Supabase's own type generator (`supabase gen types typescript --project-id <ref>`) needs a live
project or a local Supabase CLI stack, neither of which exists in this worktree. `supabase/types.ts`
is hand-written to match `0001_init.sql` + `0002_rls_performance.sql` exactly (column names,
nullability, RPC args/returns), with a comment telling the human to regenerate it for real once a
project exists and reconcile any drift. `createClient<Database>(...)` in `supabase.ts` uses it, so
every table/RPC call is typed end to end (caught a few column-name mistakes while writing
`supabase.ts` this way).

### Safe service-role usage
- The service role key bypasses every RLS policy, so it only ever belongs in
  `scripts/upload-puzzles.ts`, run locally with `npx tsx`, reading `SUPABASE_SERVICE_ROLE_KEY` from
  `.env.local` (gitignored, and `.claude/settings.json` already denies reading `.env*` files).
  Never `VITE_`-prefixed (that would inline it into the client bundle) and never set in Vercel.
- The script refuses to run (before touching the network) if the key is missing, or if it finds a
  `VITE_SUPABASE_SERVICE_ROLE_KEY` instead — a likely sign someone meant to protect it and typo'd
  the prefix convention backwards.
- `createClient(url, serviceRoleKey, { auth: { persistSession: false } })` — no session to persist
  for a one-shot script, and avoids writing a bogus auth session to disk.

## 3. Design decisions in the adapter (`src/lib/data/supabase.ts`)

- **Lazy client.** `src/lib/data/index.ts` imports `supabaseDataSource` unconditionally (so the
  `local` adapter's import graph includes this file too), and every game/design agent's dev server
  runs with `VITE_DATA_SOURCE=local` and no Supabase env vars at all. A top-level `createClient()`
  call would throw for all of them before a single game page rendered. `getSupabaseClient()`
  constructs and memoizes the client on first use instead of at module load.
- **`auth.tsx` mirrors the same switch.** The foundation's stub comment said the backend agent
  would replace `auth.tsx`'s *internals* "without changing the `AuthState` shape." Replacing it
  with only real Supabase auth would have broken all 13 game agents and the design agent, who run
  with `VITE_DATA_SOURCE=local` and no Supabase project and rely on `auth.tsx`'s original
  always-signed-in fake member. So `AuthProvider` now branches on the same `VITE_DATA_SOURCE` check
  as `src/lib/data/index.ts`: `local` keeps the original fake-member behaviour (now able to rename
  itself too, for `Profile.tsx`'s edit-name flow, entirely client-side); `supabase` runs the real
  Google OAuth + membership-gated provider. `AuthState`'s shape only grew (`updateDisplayName`
  added for `Profile.tsx`), not changed, and `useAuth`/`RequireMember`/`AuthProvider`'s signatures
  are untouched.
- **The RLS `using` clause silently excludes rows instead of erroring.** A `savePlay`/`finishPlay`
  update against a finished play matches 0 rows under `"update own unfinished play"` rather than
  raising a Postgres error (confirmed in `schema.test.mjs`'s own "finished play cannot be reopened"
  check: `affectedRows === 0`, no throw). So both methods `.select()` the update and, on an empty
  result, do one extra read to tell "already played" apart from "never started" and throw the
  right friendly message either way.
- **Error mapping.** Every failure the schema can produce has a specific, known cause (unique
  violation → already played; RLS violation → not released yet; `invalid invite code`; the
  `profiles_display_name_check` constraint), so `friendlyError()` maps each to a sentence a member
  can read, with one fallback for anything unmapped. Exported and unit-tested directly, and reused
  by `auth.tsx` for the same errors (`join_with_invite`, `updateDisplayName`).
- **Typed everything through `Database`** rather than hand-casting each response — `toPlay()` is
  the one conversion point from a DB row to the frozen `Play<S>` shape.

## 4. Pages (`SignIn`, `Join`, `Profile`)

Checked against `ui-ux-pro-max` (`ux` domain: "error summary validation inline label",
"accessible authentication social login button") and the shared-component/token rules in
`CLAUDE.md`. Changes from the scaffold:
- Visible `<label>` for every input (never placeholder-only), `role="alert"` + `aria-describedby`
  + `aria-invalid` on errors, loading states on every async button (`"Joining…"`, `"Saving…"`,
  `"Opening Google…"`), `autoFocus` on each page's first field.
- `Join` now reads `?code=` and pre-fills the invite-code field, per the task prompt.
- `Profile` adds editable display name (`updateDisplayName`, new but additive on `AuthState`) and
  per-game stats, reusing `useStats()` and `allGameMetas` (from `routes.tsx`) rather than inventing
  a second stats path.
- All of it uses only site-tier tokens (`bg-brand-*`, `rounded-brand-*`, `text-brand-*`) and the
  shared `Button`/`SiteHeader` components, per "Parallel work rules" — the design agent restyles
  values, not structure.

## 5. What still needs a live Supabase project

Everything here is tested against mocks (`src/lib/data/supabase.test.ts`, a hand-rolled fake
PostgREST/RPC client) and PGlite (`supabase/tests/schema.test.mjs`, 27/27). Not exercised without a
real project + Google OAuth credentials (see `PLAN.md`'s Supabase section for setup steps):
- The actual Google OAuth redirect round trip (`signInWithOAuth` → Google → back → session).
- `join_with_invite` / `my_stats` / `friends_results` against real Postgres (PGlite is close but
  not identical to hosted Postgres).
- `scripts/upload-puzzles.ts` against a real `puzzles` table (dry-run and the refusal paths were
  exercised locally against a throwaway `content/puzzles/<id>/` directory, then removed — no real
  upload attempted).
- Regenerating `supabase/types.ts` with the real `supabase gen types` once a project exists.
