-- Sansita's Puzzles — RLS performance pass (see docs/research/backend.md).
--
-- Supabase's RLS performance guide (and the linked Postgres RLS docs) make two load-bearing
-- points that 0001 didn't follow yet:
--   1. Wrap a policy's calls to auth.uid() (and any stable helper built on it, like is_member())
--      in `select ...`. A bare `auth.uid() = user_id` can be re-evaluated per row; `(select
--      auth.uid()) = user_id` lets Postgres cache it once per statement as an InitPlan.
--   2. Index every column a policy filters rows by. A composite primary key only indexes its
--      leading column, so a policy — or an RPC's query — filtering on a non-leading column (or a
--      column with no key at all) forces a sequential scan as the table grows.
-- Never edit 0001 (it's already tested); this migration only touches what's safe to change after
-- the fact: policy definitions (drop + recreate, same behaviour) and new indexes.

-- ───────────────────────── Indexes ─────────────────────────
-- messages.recipient has no index at all (the table's only key is its own `id`): every read of
-- "recipient reads unlocked messages" is a full scan today, and will stay one as birthday
-- messages accumulate.
create index if not exists messages_recipient_idx on public.messages (recipient);

-- plays' primary key (user_id, game_id, puzzle_date) only indexes user_id. friends_results()
-- filters by (game_id, puzzle_date) across every member — a full scan per call — and the
-- "update own unfinished play" / "start a released puzzle" policies also benefit from it once a
-- member has played many days. is_member()'s own lookup (profiles.user_id) is already indexed by
-- that table's primary key, so it needs nothing new.
create index if not exists plays_game_date_idx on public.plays (game_id, puzzle_date);

-- ───────────────────────── Policies: wrap auth.uid() / is_member() in select ─────────────────────────
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles
  for select to authenticated using ((select public.is_member()));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "members read released puzzles" on public.puzzles;
create policy "members read released puzzles" on public.puzzles
  for select to authenticated
  using ((select public.is_member()) and puzzle_date <= public.puzzle_today());

drop policy if exists "read own plays" on public.plays;
create policy "read own plays" on public.plays
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "start a released puzzle" on public.plays;
create policy "start a released puzzle" on public.plays
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_member())
    and puzzle_date <= public.puzzle_today()
  );

drop policy if exists "update own unfinished play" on public.plays;
create policy "update own unfinished play" on public.plays
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'in_progress')
  with check (user_id = (select auth.uid()));

drop policy if exists "recipient reads unlocked messages" on public.messages;
create policy "recipient reads unlocked messages" on public.messages
  for select to authenticated
  using (
    recipient = (select auth.uid())
    and unlock_date <= public.puzzle_today()
    and required_games <= (
      select count(distinct p.game_id) from public.plays p
      where p.user_id = (select auth.uid()) and p.puzzle_date = unlock_date and p.status <> 'in_progress'
    )
  );

-- is_member() and my_stats() already filter by auth.uid() inside their own function body (not an
-- RLS qual), where the planner already caches a stable function's result per statement — so they
-- don't need the same rewrite. friends_results() takes p_game/p_date as arguments and is security
-- definer, so it has no auth.uid() row-level cost beyond the membership check above.
