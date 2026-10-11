-- Sansita's Puzzles — friend groups and leaderboards.
--
-- Replaces the single site-wide invite code with any number of friend groups: a member can belong
-- to several, each has its own invite code, and the friends board / leaderboard are always scoped
-- to one group (or, for the leaderboard, to everyone). The old single-code model migrates in place
-- below so existing invite links keep working.

-- ───────────────────────── Groups ─────────────────────────
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique check (char_length(invite_code) between 3 and 60),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.groups enable row level security;

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;

-- group_members' primary key only indexes group_id. is_member(), the profiles-privacy policy,
-- my_groups(), leave_group() and list_group_members() all also filter/join by user_id.
create index if not exists group_members_user_idx on public.group_members (user_id);

-- leaderboard() and friends_results() filter plays by when they were completed, per member.
create index if not exists plays_user_completed_idx on public.plays (user_id, completed_at);

create policy "members read their groups" on public.groups
  for select to authenticated using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = (select auth.uid())
    )
  );

-- A plain `exists (select 1 from group_members ...)` here would recurse: evaluating this policy
-- would re-trigger it for the inner query, since both sides are the same table. A security-definer
-- function sidesteps that — it runs as the function owner, which (like every other security-definer
-- function in this schema) bypasses its own tables' RLS rather than re-entering this same policy.
create or replace function private.shares_group(p_group_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
  )
$$;

create policy "members read memberships of their groups" on public.group_members
  for select to authenticated using (private.shares_group(group_members.group_id));
-- No insert/update/delete policies: every change to groups or group_members goes through one of
-- the security-definer functions below, exactly like profiles can only be inserted via
-- join_with_invite.

-- ───────────────────────── Membership ─────────────────────────
-- "Member" now means "belongs to at least one group" rather than "has a profile row" — the two
-- happen to always coincide (join_with_invite creates both together, and leave_group refuses to
-- empty a member's last group), but group_members is the table that actually answers the question.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where user_id = auth.uid())
$$;

-- profiles: readable by yourself, or by anyone who shares a group with you (was: any member).
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.user_id
    )
  );

create or replace function private.random_invite_code() returns text
language plpgsql set search_path = '' as $$
declare
  adjectives text[] := array['amber','bright','calm','coral','dusty','eager','fuzzy','gentle',
    'honey','ivory','jolly','kind','lucky','mellow','nimble','olive','plush','quiet','rosy',
    'sunny','tidy','velvet','windy','zesty'];
  nouns text[] := array['otter','maple','comet','pebble','willow','sparrow','harbor','lantern',
    'meadow','orchid','ripple','thistle','violet','walnut','breeze','ember','falcon','garden',
    'heron','ivy'];
  code text;
begin
  loop
    code := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
      || '-' || nouns[1 + floor(random() * array_length(nouns, 1))::int]
      || '-' || lpad(floor(random() * 100)::text, 2, '0');
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end $$;

-- Looks a group up by its invite code without joining it or requiring membership — just enough
-- for the Join page to say "you're about to join <name>" before (or instead of) joining.
create or replace function public.group_preview(code text) returns table(id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name from public.groups g
  where lower(trim(g.invite_code)) = lower(trim(code))
$$;

drop function if exists public.join_with_invite(text, text);
create or replace function public.join_with_invite(code text, name text)
returns table(group_id uuid, group_name text)
language plpgsql security definer set search_path = '' as $$
declare
  v_group_id uuid;
  v_group_name text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select g.id, g.name into v_group_id, v_group_name
  from public.groups g
  where lower(trim(g.invite_code)) = lower(trim(code));

  if v_group_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.profiles (user_id, display_name)
  values (auth.uid(), name)
  on conflict (user_id) do nothing;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict on constraint group_members_pkey do nothing;

  return query select v_group_id, v_group_name;
end $$;

create or replace function public.create_group(name text)
returns table(id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_code text;
begin
  if not public.is_member() then
    raise exception 'members only';
  end if;
  if (select count(*) from public.groups where created_by = auth.uid()) >= 3 then
    raise exception 'you can create at most 3 groups';
  end if;

  v_code := private.random_invite_code();
  insert into public.groups (name, invite_code, created_by)
  values (name, v_code, auth.uid())
  returning groups.id into v_id;
  insert into public.group_members (group_id, user_id) values (v_id, auth.uid());

  return query select v_id, v_code;
end $$;

create or replace function public.my_groups()
returns table(id uuid, name text, invite_code text, member_count integer, is_creator boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.invite_code,
    (select count(*)::integer from public.group_members gm2 where gm2.group_id = g.id),
    g.created_by = auth.uid(),
    g.created_at
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid()
  order by g.created_at
$$;

create or replace function public.list_group_members(p_group_id uuid)
returns table(user_id uuid, display_name text, joined_at timestamptz, is_creator boolean)
language sql stable security definer set search_path = '' as $$
  select pr.user_id, pr.display_name, gm.joined_at, g.created_by = pr.user_id
  from public.group_members gm
  join public.profiles pr on pr.user_id = gm.user_id
  join public.groups g on g.id = gm.group_id
  where gm.group_id = p_group_id
    and exists (
      select 1 from public.group_members me
      where me.group_id = p_group_id and me.user_id = auth.uid()
    )
  order by gm.joined_at
$$;

-- Creator-only actions.
create or replace function public.rename_group(p_group_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.groups set name = p_name
  where id = p_group_id and created_by = auth.uid();
  if not found then
    raise exception 'only the creator can rename this group';
  end if;
end $$;

create or replace function public.regenerate_invite_code(p_group_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not exists (select 1 from public.groups where id = p_group_id and created_by = auth.uid()) then
    raise exception 'only the creator can regenerate the invite code';
  end if;
  v_code := private.random_invite_code();
  update public.groups set invite_code = v_code where id = p_group_id;
  return v_code;
end $$;

create or replace function public.remove_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.groups where id = p_group_id and created_by = auth.uid()) then
    raise exception 'only the creator can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'use leave_group to remove yourself';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
end $$;

-- Any member, but never their last group (is_member() — and so access to everything else —
-- depends on belonging to at least one).
create or replace function public.leave_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this group';
  end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) <= 1 then
    raise exception 'cannot leave your last group';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = auth.uid();
end $$;

-- ───────────────────────── Friends board, now per group ─────────────────────────
drop function if exists public.friends_results(text, date);
create or replace function public.friends_results(p_game text, p_group_id uuid, p_date date default null)
returns table (display_name text, status text, summary text, score integer, completed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := coalesce(p_date, public.puzzle_today());
begin
  if not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
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
    join public.group_members gm on gm.user_id = pl.user_id and gm.group_id = p_group_id
    where pl.game_id = p_game and pl.puzzle_date = d and pl.status <> 'in_progress'
    order by pl.completed_at;
end $$;

-- ───────────────────────── Points ─────────────────────────
-- A game scores a point only when won on its own puzzle day (started_at's India-time date equals
-- puzzle_date — the same "on_day" rule my_stats() uses for streaks); an archive catch-up always
-- scores 0, however it's finished. The bonus depends on how long that win's on-day streak had
-- reached *as of that win*: +1 once it reaches 3, +2 once it reaches 7 (not cumulative — a streak
-- of 7 scores 1 base + 2 bonus = 3, not 1+1+2). Streak position reuses my_stats()' island trick:
-- grouping consecutive puzzle_dates by (date - row_number()), then numbering each win within its
-- island from 1. This runs over every member's entire history (not just one group), because the
-- global leaderboard needs the same per-user points as every group leaderboard.
create or replace function private.play_points()
returns table(user_id uuid, game_id text, completed_at timestamptz, points integer)
language sql stable set search_path = '' as $$
  with on_day_wins as (
    select p.user_id, p.game_id, p.puzzle_date, p.completed_at
    from public.plays p
    where p.status = 'won'
      and (p.started_at at time zone 'Asia/Kolkata')::date = p.puzzle_date
  ),
  grouped as (
    select *,
      puzzle_date - (row_number() over (partition by user_id, game_id order by puzzle_date))::integer as grp
    from on_day_wins
  ),
  positioned as (
    select user_id, game_id, completed_at,
      row_number() over (partition by user_id, game_id, grp order by puzzle_date) as streak_position
    from grouped
  )
  select user_id, game_id, completed_at,
    1 + case when streak_position >= 7 then 2 when streak_position >= 3 then 1 else 0 end
  from positioned
$$;

-- scope='group' needs group_id; scope='global' ranks every member. A period is which plays count
-- towards it, by when they were *completed* (India time): 'day' is just `date`; 'week' is the
-- Sunday–Saturday India week containing it (extract(dow ...) is 0=Sunday..6=Saturday, so
-- date - dow is that week's Sunday). Points sum private.play_points() for on-day wins completed in
-- the period; wins/games_played count every finished play completed in the period, win or loss,
-- on-day or archive (archive plays always add 0 points but still count as played). Ties favour
-- whoever finished their last counted (period-completed) game earlier, then alphabetically.
create or replace function public.leaderboard(
  p_scope text, p_group_id uuid default null, p_period text default 'day', p_date date default null
)
returns table(rank integer, display_name text, points integer, wins integer, games_played integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := coalesce(p_date, public.puzzle_today());
  period_start date;
  period_end date;
begin
  if p_scope not in ('group', 'global') then
    raise exception 'scope must be group or global';
  end if;
  if p_period not in ('day', 'week') then
    raise exception 'period must be day or week';
  end if;
  if p_scope = 'group' then
    if p_group_id is null then
      raise exception 'group_id is required for scope=group';
    end if;
    if not exists (
      select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()
    ) then
      raise exception 'members only';
    end if;
  elsif not public.is_member() then
    raise exception 'members only';
  end if;

  if p_period = 'day' then
    period_start := d;
    period_end := d;
  else
    period_start := d - extract(dow from d)::integer;
    period_end := period_start + 6;
  end if;

  return query
  with member_scope as (
    select pr.user_id, pr.display_name
    from public.profiles pr
    where p_scope = 'global'
      or exists (
        select 1 from public.group_members gm
        where gm.group_id = p_group_id and gm.user_id = pr.user_id
      )
  ),
  finished as (
    select pl.user_id, pl.status, pl.completed_at
    from public.plays pl
    join member_scope ms on ms.user_id = pl.user_id
    where pl.status <> 'in_progress'
      and (pl.completed_at at time zone 'Asia/Kolkata')::date between period_start and period_end
  ),
  points as (
    select pp.user_id, pp.points
    from private.play_points() pp
    join member_scope ms on ms.user_id = pp.user_id
    where (pp.completed_at at time zone 'Asia/Kolkata')::date between period_start and period_end
  ),
  agg as (
    select
      ms.user_id,
      ms.display_name,
      coalesce((select sum(pt.points) from points pt where pt.user_id = ms.user_id), 0)::integer as total_points,
      (select count(*) from finished f where f.user_id = ms.user_id and f.status = 'won')::integer as total_wins,
      (select count(*) from finished f where f.user_id = ms.user_id)::integer as total_played,
      (select max(f.completed_at) from finished f where f.user_id = ms.user_id) as last_completed
    from member_scope ms
  )
  select
    (row_number() over (
      order by a.total_points desc, coalesce(a.last_completed, 'infinity'::timestamptz) asc, a.display_name asc
    ))::integer,
    a.display_name,
    a.total_points,
    a.total_wins,
    a.total_played,
    a.user_id = auth.uid()
  from agg a
  order by 1;
end $$;

-- ───────────────────────── Migrate the existing site ─────────────────────────
-- Before groups, there was one invite code (private.app_config) and every profile was implicitly
-- a member of "the" site. That becomes the first group, named by the human running this migration,
-- keeping the same invite_code so links already shared keep working. A brand-new database (no
-- app_config row yet — e.g. this test suite, which seeds it only after every migration has run)
-- leaves this as a no-op: the first group is then created normally, through create_group().
do $$
declare
  v_code text;
  v_creator uuid;
  v_group_id uuid;
begin
  select value into v_code from private.app_config where key = 'invite_code';
  if v_code is not null and not exists (select 1 from public.groups where invite_code = v_code) then
    select user_id into v_creator from public.profiles order by joined_at asc limit 1;
    if v_creator is not null then
      insert into public.groups (name, invite_code, created_by)
      values ('iced-vanilla-latte', v_code, v_creator)
      returning id into v_group_id;

      insert into public.group_members (group_id, user_id)
      select v_group_id, p.user_id from public.profiles p
      on conflict (group_id, user_id) do nothing;
    end if;
  end if;
end $$;

revoke execute on function public.join_with_invite(text, text) from public, anon;
revoke execute on function public.friends_results(text, uuid, date) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.my_groups() from public, anon;
revoke execute on function public.list_group_members(uuid) from public, anon;
revoke execute on function public.rename_group(uuid, text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.leaderboard(text, uuid, text, date) from public, anon;

grant execute on function public.join_with_invite(text, text) to authenticated;
grant execute on function public.friends_results(text, uuid, date) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.list_group_members(uuid) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.leaderboard(text, uuid, text, date) to authenticated;

-- group_preview is deliberately open to a signed-in-but-not-yet-a-member session too (that's
-- exactly who visits /join), and to anon so a link preview doesn't need a sign-in round trip first.
grant execute on function public.group_preview(text) to authenticated, anon;
