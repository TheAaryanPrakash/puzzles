-- Sansita's Puzzles — initial schema
-- Same puzzle for everyone, released by day in India time; invite-only members;
-- one play per user per game per day; streaks; friends board after you finish.

create schema if not exists private;

-- Secret settings (invite code). Not exposed through the API.
create table private.app_config (
  key   text primary key,
  value text not null
);
revoke all on schema private from public;

-- The puzzle day is the same for every player: the calendar date in India.
create or replace function public.puzzle_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- ───────────────────────── Members ─────────────────────────
-- Signing in is not enough: a user becomes a member by redeeming the invite code.
create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  joined_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = auth.uid())
$$;

create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_member());
create policy "update own profile" on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.join_with_invite(code text, name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if code is distinct from (select value from private.app_config where key = 'invite_code') then
    raise exception 'invalid invite code';
  end if;
  insert into public.profiles (user_id, display_name)
  values (auth.uid(), name)
  on conflict (user_id) do nothing;
end $$;

-- ───────────────────────── Puzzles ─────────────────────────
-- Uploaded by scripts/upload-puzzles.ts with the service role key (bypasses RLS).
-- Members can read today's and past puzzles only — future answers never leave the server.
create table public.puzzles (
  game_id     text not null,
  puzzle_date date not null,
  payload     jsonb not null,
  reserve     jsonb,
  primary key (game_id, puzzle_date)
);
alter table public.puzzles enable row level security;

create policy "members read released puzzles" on public.puzzles
  for select to authenticated
  using (public.is_member() and puzzle_date <= public.puzzle_today());

-- ───────────────────────── Plays ─────────────────────────
-- One row per user × game × puzzle date. The row is the play: its state syncs across
-- devices while in progress, and it is frozen forever once won or lost.
create table public.plays (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game_id      text not null,
  puzzle_date  date not null,
  variant      text not null default 'main' check (variant in ('main', 'reserve')),
  status       text not null default 'in_progress' check (status in ('in_progress', 'won', 'lost')),
  state        jsonb not null default '{}'::jsonb check (pg_column_size(state) < 200000),
  summary      text check (char_length(summary) <= 2000),
  score        integer,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, game_id, puzzle_date),
  foreign key (game_id, puzzle_date) references public.puzzles (game_id, puzzle_date)
);
alter table public.plays enable row level security;

create policy "read own plays" on public.plays
  for select to authenticated using (user_id = auth.uid());

create policy "start a released puzzle" on public.plays
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member()
    and puzzle_date <= public.puzzle_today()
  );

-- Only unfinished plays can change. Finished rows fail this check, so a replay is impossible.
create policy "update own unfinished play" on public.plays
  for update to authenticated
  using (user_id = auth.uid() and status = 'in_progress')
  with check (user_id = auth.uid());
-- No delete policy: plays can't be deleted by players.

create or replace function public.plays_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'in_progress' then
      raise exception 'a play must start in progress';
    end if;
    new.started_at := now();
    new.completed_at := null;
    return new;
  end if;

  if old.status <> 'in_progress' then
    raise exception 'this puzzle has already been played';
  end if;
  if new.user_id <> old.user_id or new.game_id <> old.game_id
     or new.puzzle_date <> old.puzzle_date or new.started_at <> old.started_at then
    raise exception 'user, game, date and start time cannot change';
  end if;
  if new.variant <> old.variant and old.state <> '{}'::jsonb then
    raise exception 'cannot switch to the reserve puzzle after starting';
  end if;
  new.completed_at := case when new.status = 'in_progress' then null else now() end;
  return new;
end $$;

create trigger plays_guard before insert or update on public.plays
  for each row execute function public.plays_guard();

-- ───────────────────────── Stats ─────────────────────────
-- Streak = consecutive puzzle days won, counting only plays started on the puzzle's own day
-- (archive catch-ups count as played but never extend a streak).
create or replace function public.my_stats()
returns table (game_id text, played integer, won integer, current_streak integer, max_streak integer)
language sql stable set search_path = '' as $$
  with mine as (
    select p.game_id, p.puzzle_date, p.status,
           (p.started_at at time zone 'Asia/Kolkata')::date = p.puzzle_date as on_day
    from public.plays p
    where p.user_id = auth.uid() and p.status <> 'in_progress'
  ),
  wins as (
    select m.game_id, m.puzzle_date,
           m.puzzle_date - (row_number() over (partition by m.game_id order by m.puzzle_date))::integer as grp
    from mine m
    where m.status = 'won' and m.on_day
  ),
  islands as (
    select w.game_id, max(w.puzzle_date) as last_day, count(*)::integer as len
    from wins w group by w.game_id, w.grp
  )
  select g.game_id,
         (select count(*)::integer from mine m where m.game_id = g.game_id),
         (select count(*)::integer from mine m where m.game_id = g.game_id and m.status = 'won'),
         coalesce(
           (select i.len from islands i
             where i.game_id = g.game_id and i.last_day = public.puzzle_today()),
           case when not exists (select 1 from mine m
                                  where m.game_id = g.game_id and m.puzzle_date = public.puzzle_today())
                then (select i.len from islands i
                       where i.game_id = g.game_id and i.last_day = public.puzzle_today() - 1)
           end,
           0),
         coalesce((select max(i.len) from islands i where i.game_id = g.game_id), 0)
  from (select distinct m.game_id from mine m) g
$$;

-- ───────────────────────── Friends board ─────────────────────────
-- Other members' results for a puzzle — only after you have finished it yourself,
-- so nobody gets spoiled. Summaries must be spoiler-free (emoji grids, scores).
create or replace function public.friends_results(p_game text, p_date date default null)
returns table (display_name text, status text, summary text, score integer, completed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := coalesce(p_date, public.puzzle_today());
begin
  if not public.is_member() then
    raise exception 'members only';
  end if;
  if not exists (
    select 1 from public.plays me
    where me.user_id = auth.uid() and me.game_id = p_game
      and me.puzzle_date = d and me.status <> 'in_progress'
  ) then
    return;
  end if;
  return query
    select pr.display_name, pl.status, pl.summary, pl.score, pl.completed_at
    from public.plays pl
    join public.profiles pr on pr.user_id = pl.user_id
    where pl.game_id = p_game and pl.puzzle_date = d and pl.status <> 'in_progress'
    order by pl.completed_at;
end $$;

-- ───────────────────────── Private messages (birthday finale) ─────────────────────────
-- Readable only by the recipient, only from unlock_date, and only once they have finished
-- required_games different games for that date (archive catch-ups for that date count too).
create table public.messages (
  id             bigint generated always as identity primary key,
  recipient      uuid not null references auth.users(id) on delete cascade,
  unlock_date    date not null,
  required_games integer not null default 0 check (required_games >= 0),
  content        jsonb not null
);
alter table public.messages enable row level security;

create policy "recipient reads unlocked messages" on public.messages
  for select to authenticated
  using (
    recipient = auth.uid()
    and unlock_date <= public.puzzle_today()
    and required_games <= (
      select count(distinct p.game_id) from public.plays p
      where p.user_id = auth.uid() and p.puzzle_date = unlock_date and p.status <> 'in_progress'
    )
  );

revoke execute on function public.join_with_invite(text, text) from public, anon;
revoke execute on function public.friends_results(text, date) from public, anon;
revoke execute on function public.my_stats() from public, anon;
grant execute on function public.join_with_invite(text, text) to authenticated;
grant execute on function public.friends_results(text, date) to authenticated;
grant execute on function public.my_stats() to authenticated;
