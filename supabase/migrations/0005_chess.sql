-- Sansita's Puzzles — chess "Play a Friend": untimed correspondence chess between two members.
--
-- Chess stays structurally unscored: nothing here is referenced by plays, my_stats, leaderboard
-- or the finale, and nothing here writes to any of those tables. See CLAUDE.md "Chess" and
-- src/games/chess/RESEARCH.md's "Multiplayer (Play a Friend)" section for the design rationale —
-- this migration only implements it.

-- ───────────────────────── Challenges ─────────────────────────
-- A challenge is either direct (recipient_id set — "challenge a friend", requires sharing a group
-- at creation time) or an open link (recipient_id null — any signed-in member but the creator can
-- accept it, no group requirement). "random" side choice is resolved once, here, at creation —
-- not at accept time (see RESEARCH.md §4).
create table public.chess_challenges (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid references auth.users(id) on delete cascade,
  token         text not null unique,
  creator_side  text not null check (creator_side in ('white', 'black')),
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  expires_at    timestamptz not null default (now() + interval '3 days'),
  game_id       uuid,
  rematch_of    uuid,
  created_at    timestamptz not null default now(),
  check (recipient_id is null or recipient_id <> created_by)
);
alter table public.chess_challenges enable row level security;

create index chess_challenges_created_by_idx on public.chess_challenges (created_by);
create index chess_challenges_recipient_idx on public.chess_challenges (recipient_id);

-- Only the creator or a named recipient can see a challenge row at all. A stranger with a link
-- previews it through challenge_preview() (security-definer, below) instead of needing row access.
create policy "creator or recipient read challenges" on public.chess_challenges
  for select to authenticated using (created_by = (select auth.uid()) or recipient_id = (select auth.uid()));
-- No insert/update/delete policies — every change goes through the RPCs below.

-- ───────────────────────── Games ─────────────────────────
-- Move history is represented the same way the computer mode's GameState represents it — `pgn`,
-- replayable with chess.js — not a separate moves table. `result`/`reason` are stored from a
-- neutral (not "won/lost") perspective because two different members view the same row and must
-- each derive their own won/lost/drawn by comparing `result` to their own colour.
create table public.chess_games (
  id             uuid primary key default gen_random_uuid(),
  white_id       uuid not null references auth.users(id) on delete cascade,
  black_id       uuid not null references auth.users(id) on delete cascade,
  fen            text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn            text not null default '',
  last_move_uci  text,
  last_move_san  text,
  ply            integer not null default 0,
  status         text not null default 'active' check (status in ('active', 'finished')),
  result         text check (result in ('white_won', 'black_won', 'draw')),
  reason         text check (reason in (
                   'checkmate', 'stalemate', 'threefold', 'fifty-move', 'insufficient-material',
                   'resignation', 'draw-agreement', 'abandoned'
                 )),
  draw_offer_by  uuid references auth.users(id) on delete set null,
  last_move_at   timestamptz not null default now(),
  rematch_of     uuid references public.chess_games(id),
  created_at     timestamptz not null default now(),
  check (white_id <> black_id),
  check ((status = 'finished') = (result is not null)),
  check (status = 'active' or reason is not null)
);
alter table public.chess_games enable row level security;

alter table public.chess_challenges
  add constraint chess_challenges_game_id_fkey foreign key (game_id) references public.chess_games(id),
  add constraint chess_challenges_rematch_of_fkey foreign key (rematch_of) references public.chess_games(id);

create index chess_games_white_idx on public.chess_games (white_id);
create index chess_games_black_idx on public.chess_games (black_id);

-- Visible to a player, or to a spectator who shares a group with BOTH players — stricter than
-- the friends-board policy (0004), which only ever checks one side.
create or replace function private.shares_group_with(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  )
$$;

create policy "players and shared-group spectators read games" on public.chess_games
  for select to authenticated using (
    white_id = (select auth.uid())
    or black_id = (select auth.uid())
    or (private.shares_group_with(white_id) and private.shares_group_with(black_id))
  );
-- No insert/update/delete policies — every change goes through the RPCs below.

-- Realtime, guarded: the PGlite test database (this file's own test run) has no
-- supabase_realtime publication at all, so this is a no-op there rather than a failure.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chess_games;
  end if;
end $$;

-- ───────────────────────── Shared helpers ─────────────────────────
-- Built on gen_random_uuid() (core Postgres, no pgcrypto) rather than gen_random_bytes(), which
-- needs an extension not available everywhere this schema runs (e.g. the PGlite test harness).
create or replace function private.random_chess_token() returns text
language plpgsql set search_path = '' as $$
declare
  v_token text;
begin
  loop
    v_token := replace(gen_random_uuid()::text, '-', '');
    exit when not exists (select 1 from public.chess_challenges where chess_challenges.token = v_token);
  end loop;
  return v_token;
end $$;

-- Active games + my own pending, unexpired outgoing challenges, counted together — the task's
-- "max 5 at once" rule. Checked against the creator at create_challenge/create_rematch time, and
-- against the acceptor at accept_challenge time (accepting adds one active game to their count).
create or replace function private.chess_slot_count(p_user_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.chess_games
      where status = 'active' and (white_id = p_user_id or black_id = p_user_id))
    + (select count(*) from public.chess_challenges
        where created_by = p_user_id and status = 'pending' and expires_at > now())
$$;

create or replace function private.create_chess_challenge(
  p_recipient_id uuid, p_side text, p_rematch_of uuid
) returns table(id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_side text;
  v_id uuid;
  v_token text;
begin
  if not public.is_member() then
    raise exception 'members only';
  end if;
  if private.chess_slot_count(auth.uid()) >= 5 then
    raise exception 'you already have 5 games or pending challenges — finish or cancel one first';
  end if;
  if p_recipient_id is not null then
    if p_recipient_id = auth.uid() then
      raise exception 'cannot challenge yourself';
    end if;
    if not private.shares_group_with(p_recipient_id) then
      raise exception 'you can only challenge someone who shares a group with you';
    end if;
  end if;

  v_side := case
    when p_side = 'random' then (case when random() < 0.5 then 'white' else 'black' end)
    else p_side
  end;
  if v_side not in ('white', 'black') then
    raise exception 'side must be white, black or random';
  end if;

  v_token := private.random_chess_token();
  insert into public.chess_challenges (created_by, recipient_id, token, creator_side, rematch_of)
  values (auth.uid(), p_recipient_id, v_token, v_side, p_rematch_of)
  returning chess_challenges.id into v_id;

  return query select v_id, v_token;
end $$;

create or replace function public.create_challenge(p_recipient_id uuid default null, p_side text default 'random')
returns table(id uuid, token text)
language sql security definer set search_path = '' as $$
  select * from private.create_chess_challenge(p_recipient_id, p_side, null);
$$;

create or replace function public.create_rematch(p_game_id uuid)
returns table(id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_game record;
  v_my_side text;
  v_opponent uuid;
begin
  select * into v_game from public.chess_games where chess_games.id = p_game_id;
  if v_game is null or v_game.status <> 'finished' then
    raise exception 'can only offer a rematch for a finished game';
  end if;
  if v_game.white_id = auth.uid() then
    v_my_side := 'white'; v_opponent := v_game.black_id;
  elsif v_game.black_id = auth.uid() then
    v_my_side := 'black'; v_opponent := v_game.white_id;
  else
    raise exception 'only a player in this game can offer a rematch';
  end if;

  return query select * from private.create_chess_challenge(
    v_opponent, (case when v_my_side = 'white' then 'black' else 'white' end), p_game_id
  );
end $$;

create or replace function public.challenge_preview(p_token text)
returns table(id uuid, creator_name text, side text)
language sql stable security definer set search_path = '' as $$
  select c.id, p.display_name, c.creator_side
  from public.chess_challenges c
  join public.profiles p on p.user_id = c.created_by
  where c.token = p_token and c.status = 'pending' and c.expires_at > now()
$$;

create or replace function public.accept_challenge(p_id uuid default null, p_token text default null)
returns table(game_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_challenge record;
  v_game_id uuid;
  v_white uuid;
  v_black uuid;
begin
  if not public.is_member() then
    raise exception 'members only';
  end if;
  select * into v_challenge from public.chess_challenges c
    where (p_id is not null and c.id = p_id) or (p_token is not null and c.token = p_token);

  if v_challenge is null or v_challenge.status <> 'pending' or v_challenge.expires_at <= now() then
    raise exception 'this challenge is no longer available';
  end if;
  if v_challenge.created_by = auth.uid() then
    raise exception 'you cannot accept your own challenge';
  end if;
  if v_challenge.recipient_id is not null and v_challenge.recipient_id <> auth.uid() then
    raise exception 'this challenge is not for you';
  end if;
  if private.chess_slot_count(auth.uid()) >= 5 then
    raise exception 'you already have 5 games or pending challenges — finish or cancel one first';
  end if;

  if v_challenge.creator_side = 'white' then
    v_white := v_challenge.created_by; v_black := auth.uid();
  else
    v_white := auth.uid(); v_black := v_challenge.created_by;
  end if;

  insert into public.chess_games (white_id, black_id, rematch_of)
  values (v_white, v_black, v_challenge.rematch_of)
  returning chess_games.id into v_game_id;

  update public.chess_challenges
    set status = 'accepted', game_id = v_game_id
    where chess_challenges.id = v_challenge.id;

  return query select v_game_id;
end $$;

create or replace function public.decline_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.chess_challenges
    set status = 'declined'
    where id = p_id and recipient_id = auth.uid() and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'this challenge cannot be declined';
  end if;
end $$;

create or replace function public.cancel_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.chess_challenges
    set status = 'cancelled'
    where id = p_id and created_by = auth.uid() and status = 'pending';
  if not found then
    raise exception 'this challenge cannot be cancelled';
  end if;
end $$;

-- ───────────────────────── Playing ─────────────────────────
-- The client (chess.js) has already checked legality; the server only checks what it must:
-- caller is a player, it's their turn, the game is active, and p_expected_ply matches the stored
-- ply — the guard against a second tab or a stale page re-submitting an old position.
create or replace function public.make_move(
  p_game_id uuid, p_uci text, p_san text, p_fen text, p_pgn text, p_expected_ply integer,
  p_result text default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_game record;
  v_mover uuid;
begin
  select * into v_game from public.chess_games where id = p_game_id;
  if v_game is null or (v_game.white_id <> auth.uid() and v_game.black_id <> auth.uid()) then
    raise exception 'not a player in this game';
  end if;
  if v_game.status <> 'active' then
    raise exception 'this game has already finished';
  end if;
  v_mover := case when v_game.ply % 2 = 0 then v_game.white_id else v_game.black_id end;
  if v_mover <> auth.uid() then
    raise exception 'not your turn';
  end if;
  if v_game.ply <> p_expected_ply then
    raise exception 'stale move — refresh and try again';
  end if;
  if (p_result is null) <> (p_reason is null) then
    raise exception 'result and reason must be given together';
  end if;
  if p_reason is not null and p_reason not in
      ('checkmate', 'stalemate', 'threefold', 'fifty-move', 'insufficient-material') then
    raise exception 'make_move cannot end a game with that reason';
  end if;

  update public.chess_games set
    fen = p_fen, pgn = p_pgn, last_move_uci = p_uci, last_move_san = p_san,
    ply = v_game.ply + 1, last_move_at = now(), draw_offer_by = null,
    status = case when p_result is not null then 'finished' else 'active' end,
    result = p_result, reason = p_reason
  where id = p_game_id;
end $$;

create or replace function public.resign(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_game record;
begin
  select * into v_game from public.chess_games where id = p_game_id and status = 'active';
  if v_game is null or (v_game.white_id <> auth.uid() and v_game.black_id <> auth.uid()) then
    raise exception 'not an active game you are playing';
  end if;
  update public.chess_games set
    status = 'finished',
    result = case when v_game.white_id = auth.uid() then 'black_won' else 'white_won' end,
    reason = 'resignation'
  where id = p_game_id;
end $$;

create or replace function public.offer_draw(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.chess_games set draw_offer_by = auth.uid()
  where id = p_game_id and status = 'active' and (white_id = auth.uid() or black_id = auth.uid());
  if not found then
    raise exception 'not an active game you are playing';
  end if;
end $$;

create or replace function public.respond_draw(p_game_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_game record;
begin
  select * into v_game from public.chess_games where id = p_game_id and status = 'active';
  if v_game is null or (v_game.white_id <> auth.uid() and v_game.black_id <> auth.uid()) then
    raise exception 'not an active game you are playing';
  end if;
  if v_game.draw_offer_by is null or v_game.draw_offer_by = auth.uid() then
    raise exception 'no draw offer to respond to';
  end if;
  if p_accept then
    update public.chess_games set status = 'finished', result = 'draw', reason = 'draw-agreement'
    where id = p_game_id;
  else
    update public.chess_games set draw_offer_by = null where id = p_game_id;
  end if;
end $$;

create or replace function public.claim_abandoned(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_game record;
  v_mover uuid;
begin
  select * into v_game from public.chess_games where id = p_game_id and status = 'active';
  if v_game is null or (v_game.white_id <> auth.uid() and v_game.black_id <> auth.uid()) then
    raise exception 'not an active game you are playing';
  end if;
  v_mover := case when v_game.ply % 2 = 0 then v_game.white_id else v_game.black_id end;
  if v_mover = auth.uid() then
    raise exception 'you are the one to move — nothing to claim';
  end if;
  if now() - v_game.last_move_at <= interval '7 days' then
    raise exception 'not abandoned yet';
  end if;
  update public.chess_games set
    status = 'finished',
    result = case when v_game.white_id = auth.uid() then 'white_won' else 'black_won' end,
    reason = 'abandoned'
  where id = p_game_id;
end $$;

-- ───────────────────────── Reading ─────────────────────────
create or replace function public.chess_opponents()
returns table(user_id uuid, display_name text, group_name text)
language sql stable security definer set search_path = '' as $$
  select distinct on (pr.user_id) pr.user_id, pr.display_name, g.name
  from public.group_members mine
  join public.group_members theirs on theirs.group_id = mine.group_id and theirs.user_id <> mine.user_id
  join public.profiles pr on pr.user_id = theirs.user_id
  join public.groups g on g.id = mine.group_id
  where mine.user_id = auth.uid()
  order by pr.user_id, g.name
$$;

create or replace function public.my_chess_games()
returns table(
  id uuid, white_id uuid, white_name text, black_id uuid, black_name text,
  fen text, pgn text, last_move_san text, ply integer, status text, result text, reason text,
  draw_offer_by uuid, last_move_at timestamptz, rematch_of uuid, created_at timestamptz,
  is_my_turn boolean
)
language sql stable security definer set search_path = '' as $$
  select g.id, g.white_id, wp.display_name, g.black_id, bp.display_name,
    g.fen, g.pgn, g.last_move_san, g.ply, g.status, g.result, g.reason,
    g.draw_offer_by, g.last_move_at, g.rematch_of, g.created_at,
    g.status = 'active' and
      ((g.ply % 2 = 0 and g.white_id = auth.uid()) or (g.ply % 2 = 1 and g.black_id = auth.uid()))
  from public.chess_games g
  join public.profiles wp on wp.user_id = g.white_id
  join public.profiles bp on bp.user_id = g.black_id
  where g.white_id = auth.uid() or g.black_id = auth.uid()
  order by (g.status = 'active') desc, g.last_move_at desc
$$;

create or replace function public.my_chess_badge()
returns table(your_turn_count integer, incoming_challenge_count integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.chess_games g where g.status = 'active' and
      ((g.ply % 2 = 0 and g.white_id = auth.uid()) or (g.ply % 2 = 1 and g.black_id = auth.uid())))::integer,
    (select count(*) from public.chess_challenges c
      where c.recipient_id = auth.uid() and c.status = 'pending' and c.expires_at > now())::integer
$$;

create or replace function public.my_chess_record()
returns table(opponent_id uuid, opponent_name text, wins integer, losses integer, draws integer)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select g.*,
      case when g.white_id = auth.uid() then g.black_id else g.white_id end as opponent_id,
      case
        when g.result = 'draw' then 'draw'
        when (g.result = 'white_won' and g.white_id = auth.uid())
          or (g.result = 'black_won' and g.black_id = auth.uid()) then 'win'
        else 'loss'
      end as outcome
    from public.chess_games g
    where g.status = 'finished' and (g.white_id = auth.uid() or g.black_id = auth.uid())
  )
  select null::uuid, 'Overall',
    count(*) filter (where outcome = 'win')::integer,
    count(*) filter (where outcome = 'loss')::integer,
    count(*) filter (where outcome = 'draw')::integer
  from mine
  union all
  select m.opponent_id, pr.display_name,
    count(*) filter (where m.outcome = 'win')::integer,
    count(*) filter (where m.outcome = 'loss')::integer,
    count(*) filter (where m.outcome = 'draw')::integer
  from mine m
  join public.profiles pr on pr.user_id = m.opponent_id
  group by m.opponent_id, pr.display_name
$$;

revoke execute on function public.create_challenge(uuid, text) from public, anon;
revoke execute on function public.create_rematch(uuid) from public, anon;
revoke execute on function public.challenge_preview(text) from public, anon;
revoke execute on function public.accept_challenge(uuid, text) from public, anon;
revoke execute on function public.decline_challenge(uuid) from public, anon;
revoke execute on function public.cancel_challenge(uuid) from public, anon;
revoke execute on function public.make_move(uuid, text, text, text, text, integer, text, text) from public, anon;
revoke execute on function public.resign(uuid) from public, anon;
revoke execute on function public.offer_draw(uuid) from public, anon;
revoke execute on function public.respond_draw(uuid, boolean) from public, anon;
revoke execute on function public.claim_abandoned(uuid) from public, anon;
revoke execute on function public.chess_opponents() from public, anon;
revoke execute on function public.my_chess_games() from public, anon;
revoke execute on function public.my_chess_badge() from public, anon;
revoke execute on function public.my_chess_record() from public, anon;

grant execute on function public.create_challenge(uuid, text) to authenticated;
grant execute on function public.create_rematch(uuid) to authenticated;
grant execute on function public.challenge_preview(text) to authenticated;
grant execute on function public.accept_challenge(uuid, text) to authenticated;
grant execute on function public.decline_challenge(uuid) to authenticated;
grant execute on function public.cancel_challenge(uuid) to authenticated;
grant execute on function public.make_move(uuid, text, text, text, text, integer, text, text) to authenticated;
grant execute on function public.resign(uuid) to authenticated;
grant execute on function public.offer_draw(uuid) to authenticated;
grant execute on function public.respond_draw(uuid, boolean) to authenticated;
grant execute on function public.claim_abandoned(uuid) to authenticated;
grant execute on function public.chess_opponents() to authenticated;
grant execute on function public.my_chess_games() to authenticated;
grant execute on function public.my_chess_badge() to authenticated;
grant execute on function public.my_chess_record() to authenticated;
