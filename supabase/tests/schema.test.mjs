import { PGlite } from "@electric-sql/pglite";
// Run: node supabase/tests/schema.test.mjs supabase/migrations/0001_init.sql  (needs @electric-sql/pglite)
// Applies every *.sql file in that path's directory, in filename order — so a new migration
// only needs a new file here, never a change to this invocation (package.json's test:db is frozen).
//
// The groups migration (0004) is applied partway through this file instead of up front: everything
// before that point runs the original pre-groups suite almost unchanged, building up a realistic
// database (members, puzzles, plays, streaks, messages) the way the real site would have one before
// 0004 ever ran. Only then is 0004 applied, and a further section tests that it migrated that state
// correctly (the old invite code becomes the first group, keeps working, etc.) plus everything new
// (other groups, creator-only actions, per-group privacy, points, and the leaderboard).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const db = new PGlite();
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";
const D = "00000000-0000-0000-0000-00000000000d";
const E = "00000000-0000-0000-0000-00000000000e";
const F = "00000000-0000-0000-0000-00000000000f";
const G = "00000000-0000-0000-0000-000000000010";
const H = "00000000-0000-0000-0000-000000000011";
const I = "00000000-0000-0000-0000-000000000012";
const J = "00000000-0000-0000-0000-000000000013";
const K = "00000000-0000-0000-0000-000000000014";
const L = "00000000-0000-0000-0000-000000000015";
const M = "00000000-0000-0000-0000-000000000016";
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const throws = async (name, fn) => { try { await fn(); ok(name, false); } catch (e) { ok(`${name}  (${e.message.split("\n")[0]})`, true); } };

// Supabase shim: roles, auth schema, auth.uid() from a session setting, and a minimal storage
// schema (just enough of buckets/objects for 0003's policy — real Supabase Storage's extra
// columns/functions aren't needed to test an RLS policy's logic).
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  insert into auth.users values
    ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}'), ('${F}'), ('${G}'), ('${H}'), ('${I}'),
    ('${J}'), ('${K}'), ('${L}'), ('${M}');

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
  create table storage.objects (
    id bigint generated always as identity primary key,
    bucket_id text references storage.buckets(id),
    name text not null,
    owner uuid
  );
  alter table storage.objects enable row level security;
`);
const migrationsDir = dirname(process.argv[2]);
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const groupsIndex = migrationFiles.findIndex((f) => f.includes("groups"));
const preGroupsFiles = groupsIndex === -1 ? migrationFiles : migrationFiles.slice(0, groupsIndex);
const groupsFile = groupsIndex === -1 ? null : migrationFiles[groupsIndex];
const postGroupsFiles = groupsIndex === -1 ? [] : migrationFiles.slice(groupsIndex + 1);

for (const file of preGroupsFiles) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}
await db.exec(`
  grant usage on schema public, auth, storage to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on storage.buckets, storage.objects to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into private.app_config values ('invite_code', 'sunflower-23');
  insert into public.puzzles (game_id, puzzle_date, payload, reserve)
  select g, public.puzzle_today() + d, jsonb_build_object('answer', g || d), '{"answer":"reserve"}'
  from unnest(array['wordle','bee']) g, generate_series(-5, 3) d;
`);

const as = async (uid, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role;"); }
};

// Membership
ok("signed-in non-member sees no puzzles", (await as(A, "select * from puzzles")).rows.length === 0);
await throws("wrong invite code is rejected", () => as(A, "select join_with_invite('nope', 'Sansita')"));
await as(A, "select join_with_invite('sunflower-23', 'Sansita')");
await as(B, "select join_with_invite('sunflower-23', 'Amal')");

// Puzzle release gating
const visible = (await as(A, "select puzzle_date - puzzle_today() as d from puzzles where game_id='wordle' order by 1")).rows.map(r => r.d);
ok("member sees today and past only", JSON.stringify(visible) === JSON.stringify([-5, -4, -3, -2, -1, 0]));
ok("tomorrow's puzzle is not readable",
  (await as(A, "select * from puzzles where puzzle_date = puzzle_today() + 1")).rows.length === 0);

// Starting plays
await throws("cannot start tomorrow's puzzle",
  () => as(A, "insert into plays (game_id, puzzle_date) values ('wordle', puzzle_today() + 1)"));
await throws("cannot insert an already-won play",
  () => as(A, "insert into plays (game_id, puzzle_date, status) values ('wordle', puzzle_today(), 'won')"));
await throws("non-member cannot start a play",
  () => as(C, "insert into plays (game_id, puzzle_date) values ('wordle', puzzle_today())"));
await throws("cannot insert a play for another user",
  () => as(A, `insert into plays (user_id, game_id, puzzle_date) values ('${B}', 'wordle', puzzle_today())`));

await as(A, "insert into plays (game_id, puzzle_date) values ('wordle', puzzle_today())");
const sw = await as(A, "update plays set variant = 'reserve' where game_id='wordle' and puzzle_date = puzzle_today()");
ok("can switch to reserve before first move", sw.affectedRows === 1);
await as(A, `update plays set state = '{"guesses":["CRANE"]}' where game_id='wordle' and puzzle_date = puzzle_today()`);
await throws("cannot switch puzzle after starting",
  () => as(A, "update plays set variant = 'main' where game_id='wordle' and puzzle_date = puzzle_today()"));

// Finishing locks the play
await as(A, `update plays set status='won', summary='🟩🟩🟩🟩🟩', score=3 where game_id='wordle' and puzzle_date = puzzle_today()`);
const done = (await as(A, "select completed_at from plays where game_id='wordle' and puzzle_date = puzzle_today()")).rows[0];
ok("completed_at set by the server", done.completed_at !== null);
const replay = await as(A, `update plays set status='in_progress', state='{}' where game_id='wordle' and puzzle_date = puzzle_today()`);
ok("finished play cannot be reopened", replay.affectedRows === 0);
await throws("cannot start the same puzzle twice",
  () => as(A, "insert into plays (game_id, puzzle_date) values ('wordle', puzzle_today())"));
const del = await as(A, "delete from plays where game_id='wordle'");
ok("plays cannot be deleted", del.affectedRows === 0);
await as(B, "insert into plays (game_id, puzzle_date) values ('bee', puzzle_today())");
await throws("cannot backdate started_at",
  () => as(B, "update plays set started_at = now() - interval '1 day' where game_id='bee'"));
await as(B, "insert into plays (game_id, puzzle_date, started_at) values ('bee', puzzle_today() - 1, now() - interval '2 days')");
const forged = (await as(B, "select started_at > now() - interval '1 minute' as fresh from plays where game_id='bee' and puzzle_date = puzzle_today() - 1")).rows[0];
ok("client-supplied started_at is ignored on insert", forged.fresh === true);

// Privacy + friends board (pre-groups: still a single implicit site-wide group)
ok("other members cannot read my plays directly",
  (await as(B, "select * from plays where game_id='wordle'")).rows.length === 0);
ok("friends board is empty until you finish",
  (await as(B, "select * from friends_results('wordle')")).rows.length === 0);
await as(B, "insert into plays (game_id, puzzle_date) values ('wordle', puzzle_today())");
await as(B, "update plays set status='lost', summary='⬛⬛🟨⬛⬛' where game_id='wordle' and puzzle_date = puzzle_today()");
const board = (await as(B, "select display_name, status from friends_results('wordle')")).rows;
ok("friends board shows everyone after you finish", board.length === 2 && board[0].display_name === "Sansita");
await throws("non-member cannot read friends board", () => as(C, "select * from friends_results('wordle')"));

// Streaks: backfill history as superuser (bypassing the guard to set past timestamps)
await db.exec(`
  alter table plays disable trigger plays_guard;
  insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at)
  select '${A}', 'wordle', puzzle_today() + d, 'won',
         (puzzle_today() + d)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours',
         (puzzle_today() + d)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours 5 minutes'
  from generate_series(-3, -1) d;
  -- a win 5 days ago, played late (archive catch-up): counts as played, not for streaks
  insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at)
  values ('${A}', 'wordle', puzzle_today() - 5, 'won', now(), now());
  -- bee: won yesterday on the day, lost today
  insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at) values
    ('${A}', 'bee', puzzle_today() - 1, 'won',
     (puzzle_today() - 1)::timestamp at time zone 'Asia/Kolkata' + interval '20 hours', now()),
    ('${A}', 'bee', puzzle_today(), 'lost', now(), now());
  alter table plays enable trigger plays_guard;
`);
const stats = Object.fromEntries((await as(A, "select * from my_stats()")).rows.map(r => [r.game_id, r]));
ok("wordle: played counts archive catch-ups", stats.wordle.played === 5 && stats.wordle.won === 5);
ok("wordle: 4-day current streak (3 past days + today)", stats.wordle.current_streak === 4 && stats.wordle.max_streak === 4);
ok("bee: today's loss resets current streak", stats.bee.current_streak === 0 && stats.bee.max_streak === 1);

// Birthday finale messages (A has finished wordle and bee today)
await db.exec(`
  insert into messages (recipient, unlock_date, required_games, content) values
    ('${A}', puzzle_today(), 2, '{"title":"finale"}'),
    ('${A}', puzzle_today(), 3, '{"title":"needs 3 games"}'),
    ('${A}', puzzle_today() + 1, 0, '{"title":"tomorrow"}');
`);
const msgs = (await as(A, "select content->>'title' as t from messages")).rows.map(r => r.t);
ok("recipient sees message once required games are finished", JSON.stringify(msgs) === '["finale"]');
ok("other members cannot read someone else's message",
  (await as(B, "select * from messages")).rows.length === 0);

// 0003: finale Storage bucket — A's own message is unlocked (required_games=2, met above); B has
// no unlocked message at all. One file in each member's own folder.
await db.exec(`
  insert into storage.objects (bucket_id, name, owner) values
    ('finale', '${A}/photo.jpg', '${A}'),
    ('finale', '${B}/photo.jpg', '${B}');
`);
ok("recipient reads her own file once her message is unlocked",
  (await as(A, "select name from storage.objects where bucket_id = 'finale'")).rows.length === 1);
ok("recipient cannot read another member's folder even if hers is unlocked",
  (await as(A, `select name from storage.objects where bucket_id = 'finale' and name = '${B}/photo.jpg'`)).rows.length === 0);
ok("a member with no unlocked message reads no finale files, even her own",
  (await as(B, "select name from storage.objects where bucket_id = 'finale'")).rows.length === 0);

// 0002: RLS performance indexes exist (see docs/research/backend.md)
const indexNames = (await db.query(
  "select indexname from pg_indexes where schemaname = 'public' and tablename in ('plays', 'messages')",
)).rows.map((r) => r.indexname);
ok("plays has a (game_id, puzzle_date) index", indexNames.includes("plays_game_date_idx"));
ok("messages has a recipient index", indexNames.includes("messages_recipient_idx"));

// ═══════════════════════════ 0004: groups & leaderboard ═══════════════════════════
// Applied on top of the realistic, already-populated database above — the same database the real
// site would have had the moment before this migration runs for real.
if (groupsFile) {
  await db.exec(readFileSync(join(migrationsDir, groupsFile), "utf8"));
  for (const file of postGroupsFiles) await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  // Covers the two new tables; everything else was already granted above.
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);

  // ───── migrating the existing site ─────
  const migrated = (await db.query(
    "select id, name, invite_code, created_by from groups",
  )).rows;
  ok("exactly one group exists after migration", migrated.length === 1);
  const siteGroup = migrated[0];
  ok("it keeps the old invite code", siteGroup?.invite_code === "sunflower-23");
  ok("it's named by the human running the migration", siteGroup?.name === "iced-vanilla-latte");
  ok("its creator is the earliest-joined existing profile", siteGroup?.created_by === A);
  const migratedMembers = (await db.query(
    `select user_id from group_members where group_id = '${siteGroup.id}' order by user_id`,
  )).rows.map((r) => r.user_id);
  ok("both existing profiles became members", JSON.stringify(migratedMembers.sort()) === JSON.stringify([A, B].sort()));
  ok("is_member() still true for a migrated profile", (await as(A, "select is_member() as m")).rows[0].m === true);

  // ───── existing invite links still work ─────
  const joined = (await as(D, "select * from join_with_invite('sunflower-23', 'Deepa')")).rows[0];
  ok("the old code still resolves to the migrated group", joined?.group_id === siteGroup.id);
  ok("join_with_invite returns the group's name", joined?.group_name === "iced-vanilla-latte");
  ok("the new joiner is now a member of the migrated group",
    (await db.query(`select 1 from group_members where group_id = '${siteGroup.id}' and user_id = '${D}'`)).rows.length === 1);

  // ───── profiles are now group-scoped, not site-wide ─────
  ok("a member of the migrated group can read another member's profile",
    (await as(D, `select display_name from profiles where user_id = '${A}'`)).rows.length === 1);

  // get everyone else a profile + the migrated group, as the cheapest way in (mirrors D above)
  for (const [uid, name] of [[E, "Esha"], [F, "Farah"], [G, "Gita"], [H, "Hari"]]) {
    await as(uid, `select * from join_with_invite('sunflower-23', '${name}')`);
  }

  // ───── create_group, the 3-group limit, and membership vs. creation ─────
  const group1 = (await as(E, "select * from create_group('Book Club')")).rows[0];
  const group2 = (await as(E, "select * from create_group('Quiz Night')")).rows[0];
  const group3 = (await as(E, "select * from create_group('Trivia')")).rows[0];
  ok("creating a group makes the invite code unique and the creator a member",
    group1.invite_code !== group2.invite_code &&
    (await db.query(`select 1 from group_members where group_id = '${group1.id}' and user_id = '${E}'`)).rows.length === 1);
  await throws("a 4th group hits the per-creator limit",
    () => as(E, "select * from create_group('One Too Many')"));
  const eGroups = (await as(E, "select * from my_groups() order by created_at")).rows;
  ok("E belongs to 4 groups but created only 3",
    eGroups.length === 4 && eGroups.filter((g) => g.is_creator).length === 3);

  // ───── cross-group privacy: profiles and friends_results ─────
  // Iris joins only E's private "Trivia" group — never the migrated site group — so she and A
  // share no group at all, unlike every other test user above (all of whom also joined via
  // 'sunflower-23' as the cheapest way to get a profile).
  await as(I, `select * from join_with_invite('${group3.invite_code}', 'Iris')`);
  ok("someone outside every shared group cannot read a member's profile",
    (await as(I, `select display_name from profiles where user_id = '${A}'`)).rows.length === 0);
  await as(E, "insert into plays (game_id, puzzle_date) values ('wordle', puzzle_today())");
  await as(E, "update plays set status='won', summary='🟩' where game_id='wordle' and puzzle_date = puzzle_today()");
  await throws("friends_results requires sharing that group",
    () => as(A, `select * from friends_results('wordle', '${group1.id}')`));
  const group1Board = (await as(E, `select display_name from friends_results('wordle', '${group1.id}')`)).rows;
  ok("friends_results only shows that group's members", group1Board.length === 1 && group1Board[0].display_name === "Esha");

  // ───── joining group1 (not creator) ─────
  await as(F, `select * from join_with_invite('${group1.invite_code}', 'Farah')`);
  await as(F, `select * from join_with_invite('sunflower-23', 'ignored-name')`); // already a member of the migrated group; no-op on the name

  // ───── creator-only actions ─────
  await throws("a non-creator cannot rename the group", () => as(F, `select rename_group('${group1.id}', 'New Name')`));
  await as(E, `select rename_group('${group1.id}', 'Book Club Deluxe')`);
  ok("the creator can rename the group",
    (await as(E, "select * from my_groups()")).rows.find((g) => g.id === group1.id)?.name === "Book Club Deluxe");

  await throws("a non-creator cannot regenerate the invite code",
    () => as(F, `select regenerate_invite_code('${group1.id}')`));
  const oldCode = group1.invite_code;
  const newCode = (await as(E, `select regenerate_invite_code('${group1.id}') as c`)).rows[0].c;
  ok("the creator gets a fresh code", newCode !== oldCode);
  ok("the old code no longer resolves", (await db.query(`select * from group_preview('${oldCode}')`)).rows.length === 0);
  ok("the new code resolves to the group", (await db.query(`select * from group_preview('${newCode}')`)).rows[0]?.name === "Book Club Deluxe");

  await throws("a non-creator cannot remove a member", () => as(F, `select remove_member('${group1.id}', '${E}')`));
  await as(E, `select remove_member('${group1.id}', '${F}')`);
  ok("the removed member is gone from the roster",
    (await as(E, `select * from list_group_members('${group1.id}')`)).rows.length === 1);
  await throws("a removed member can no longer read that group's friends board",
    () => as(F, `select * from friends_results('wordle', '${group1.id}')`));

  // ───── leave_group, but never your last ─────
  ok("F still has exactly the migrated group left",
    (await as(F, "select * from my_groups()")).rows.length === 1);
  await throws("cannot leave your only group", () => as(F, `select leave_group('${siteGroup.id}')`));
  await as(E, `select leave_group('${siteGroup.id}')`);
  ok("E can leave a group that isn't the last one",
    (await as(E, "select * from my_groups()")).rows.length === 3);

  // ═════════════ points, streaks, archive catch-ups, week boundary, global board ═════════════
  await db.exec(`
    insert into public.puzzles (game_id, puzzle_date, payload)
    select 'points-demo', public.puzzle_today() + d, '{}'::jsonb from generate_series(-12, 0) d
    union all
    select 'week-demo', public.puzzle_today() + d, '{}'::jsonb from generate_series(-12, 12) d;
  `);

  // G: a 7-day on-day win streak (points-demo, days -9..-3), a loss (-4, already inside the
  // streak's date range but a different game-day doesn't exist twice — use -4 before the streak
  // starts isn't possible since -4 is inside -9..-3; use day 1 instead), and an archive catch-up
  // (day -10, played today) that must score 0 regardless of being a win.
  await db.exec(`
    alter table plays disable trigger plays_guard;
    insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at)
    select '${G}', 'points-demo', public.puzzle_today() + d, 'won',
           (public.puzzle_today() + d)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours',
           (public.puzzle_today() + d)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours 5 minutes'
    from generate_series(-9, -3) d;
    insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at)
    values ('${G}', 'points-demo', public.puzzle_today() - 11, 'lost',
      (public.puzzle_today() - 11)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours',
      (public.puzzle_today() - 11)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours 5 minutes');
    insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at)
    values ('${G}', 'points-demo', public.puzzle_today() - 10, 'won', now(), now());
    alter table plays enable trigger plays_guard;
  `);
  const gGroup = (await as(G, "select * from my_groups()")).rows[0]; // the migrated group
  const gDay = async (d) => (await as(G, `select * from leaderboard('group', '${gGroup.id}', 'day', puzzle_today() + ${d})`)).rows.find((r) => r.display_name === "Gita");
  ok("1st win in a streak scores 1 point, no bonus", (await gDay(-9))?.points === 1);
  ok("5th win in a streak scores the +1 bonus (position ≥ 3)", (await gDay(-5))?.points === 2);
  ok("7th win in a streak scores the +2 bonus (position ≥ 7)", (await gDay(-3))?.points === 3);
  ok("a loss scores 0 points but still counts as played", (await gDay(-11))?.points === 0 && (await gDay(-11))?.games_played === 1);
  const gArchiveDay = (await as(G, "select * from leaderboard('group', '" + gGroup.id + "', 'day') ")).rows.find((r) => r.display_name === "Gita");
  ok("an archive catch-up win (today) scores 0 points but counts as a win",
    gArchiveDay?.points === 0 && gArchiveDay?.wins === 1 && gArchiveDay?.games_played === 1);

  // H: the Sunday–Saturday week boundary. lastSaturday is the day before this week's Sunday;
  // nextSunday is the day after this week's Saturday — both must fall outside "this week".
  const dow = (await db.query("select extract(dow from public.puzzle_today())::int as d")).rows[0].d;
  const weekStartOffset = -dow;
  const lastSaturdayOffset = weekStartOffset - 1;
  const nextSundayOffset = weekStartOffset + 7;
  await db.exec(`
    alter table plays disable trigger plays_guard;
    insert into plays (user_id, game_id, puzzle_date, status, started_at, completed_at)
    select '${H}', 'week-demo', public.puzzle_today() + d, 'won',
           (public.puzzle_today() + d)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours',
           (public.puzzle_today() + d)::timestamp at time zone 'Asia/Kolkata' + interval '9 hours 5 minutes'
    from unnest(array[${lastSaturdayOffset}, ${weekStartOffset}, ${nextSundayOffset}]) d;
    alter table plays enable trigger plays_guard;
  `);
  const hGroup = (await as(H, "select * from my_groups()")).rows[0];
  const hWeek = (await as(H, `select * from leaderboard('group', '${hGroup.id}', 'week', puzzle_today() + ${weekStartOffset})`)).rows.find((r) => r.display_name === "Hari");
  ok("the week only counts this week's Sunday win, not last Saturday's or next Sunday's",
    hWeek?.points === 1 && hWeek?.games_played === 1);
  const hLastSaturday = (await as(H, `select * from leaderboard('group', '${hGroup.id}', 'day', puzzle_today() + ${lastSaturdayOffset})`)).rows.find((r) => r.display_name === "Hari");
  ok("last Saturday's win still shows up on its own day", hLastSaturday?.points === 1);

  // ───── the global board spans every member, ignoring group boundaries ─────
  const globalToday = (await as(G, "select * from leaderboard('global', null, 'day')")).rows;
  ok("the global board includes a member from another group entirely",
    globalToday.some((r) => r.display_name === "Gita"));
  const group3Board = (await as(E, `select * from leaderboard('group', '${group3.id}', 'day')`)).rows;
  ok("a private group's board does not include someone who never joined it",
    !group3Board.some((r) => r.display_name === "Gita"));
  const myRow = globalToday.find((r) => r.is_me);
  ok("is_me flags exactly the caller's own row", myRow?.display_name === "Gita");
  const ranked = [...globalToday].sort((a, b) => a.rank - b.rank);
  ok("rank is consistent with points, descending",
    ranked.every((r, i) => i === 0 || ranked[i - 1].points >= r.points));

  // ───── overlapping group membership: no double-counting on the global board ─────
  // E belongs to 3 groups (Book Club Deluxe, Quiz Night, Trivia — created above) after leaving the
  // migrated site group, and has exactly one win anywhere (the wordle play scored during the
  // cross-group-privacy section above) — 1 point total. member_scope selects distinct profiles.*
  // rather than joining group_members for scope='global', so this must read 1, not 3, even though
  // 3 group_members rows reference E. Each of E's own group boards must also show that same single
  // win — not a 3-group member seeing 3 different totals for herself either.
  for (const [label, gid] of [["Book Club Deluxe", group1.id], ["Quiz Night", group2.id], ["Trivia", group3.id]]) {
    const row = (await as(E, `select * from leaderboard('group', '${gid}', 'day')`)).rows.find((r) => r.display_name === "Esha");
    ok(`E's own board in ${label} shows her 1 real point, not fanned out`,
      row?.points === 1 && row?.wins === 1 && row?.games_played === 1);
  }
  const globalE = globalToday.find((r) => r.display_name === "Esha");
  ok("the global board sums E's single win once despite 3 overlapping group memberships",
    globalE?.points === 1 && globalE?.wins === 1 && globalE?.games_played === 1);
  // Proves the assertion above is meaningful (not vacuously true because E is only in 1 group): a
  // join-based fan-out bug would have had exactly this many group_members rows to multiply across.
  const eMemberships = (await db.query(`select count(*)::int as n from group_members where user_id = '${E}'`)).rows[0].n;
  ok("sanity: E really does have 3 overlapping group memberships for the check above to matter",
    eMemberships === 3);

  // ───── group isolation holds even for a former member, not just someone who never joined ─────
  const siteGroupBoard = (await as(F, `select * from leaderboard('group', '${siteGroup.id}', 'day')`)).rows;
  ok("E no longer appears on the migrated group's board after leaving it",
    !siteGroupBoard.some((r) => r.display_name === "Esha"));

  // ═══════════════════════════ 0005: chess "Play a Friend" ═══════════════════════════
  // A dedicated, isolated group of actors (J/K/L/M) rather than reusing the sprawling fixture
  // above, so "shares a group with both / one / neither" has clean, unambiguous answers. Only J
  // joins the pre-existing migrated group (purely to bootstrap is_member() so J can create_group);
  // K, L and M join J's own fresh groups directly by invite code, which needs no prior membership.
  await as(J, `select * from join_with_invite('sunflower-23', 'Jana')`);
  const chessPals = (await as(J, "select * from create_group('Chess Pals')")).rows[0];
  await as(K, `select * from join_with_invite('${chessPals.invite_code}', 'Kiran')`);
  await as(L, `select * from join_with_invite('${chessPals.invite_code}', 'Leela')`);
  const justJ = (await as(J, "select * from create_group('Just J')")).rows[0];
  await as(M, `select * from join_with_invite('${justJ.invite_code}', 'Maya')`); // shares "Just J" with J only — not "Chess Pals", not the migrated group

  // ───── challenging ─────
  await throws("challenging someone outside your groups is refused",
    () => as(J, `select * from create_challenge('${C}', 'white')`));
  const jChallengesK = (await as(J, `select * from create_challenge('${K}', 'white')`)).rows[0];
  await throws("the creator can't accept their own link",
    () => as(J, `select * from accept_challenge(null, '${jChallengesK.token}')`));
  const accepted = (await as(K, `select * from accept_challenge(null, '${jChallengesK.token}')`)).rows[0];
  const gameId = accepted.game_id;
  const game0 = (await db.query(`select * from chess_games where id = '${gameId}'`)).rows[0];
  ok("creator_side='white' makes the creator white", game0.white_id === J && game0.black_id === K);

  // ───── spectating: shares a group with BOTH players / only one / neither ─────
  ok("a spectator sharing a group with both players can see the game",
    (await as(L, `select 1 from chess_games where id = '${gameId}'`)).rows.length === 1);
  ok("sharing a group with only one player is not enough to spectate",
    (await as(M, `select 1 from chess_games where id = '${gameId}'`)).rows.length === 0);
  ok("sharing no group with either player cannot spectate",
    (await as(C, `select 1 from chess_games where id = '${gameId}'`)).rows.length === 0);

  // ───── moves: non-player, wrong turn, stale ply ─────
  const startFen = game0.fen;
  await throws("a non-player can't move",
    () => as(M, `select make_move('${gameId}', 'e2e4', 'e4', '${startFen}', '', 0)`));
  await throws("moving on the wrong turn is refused (black tried to move first)",
    () => as(K, `select make_move('${gameId}', 'e7e5', 'e5', '${startFen}', '', 0)`));
  await throws("a stale expected_ply is refused",
    () => as(J, `select make_move('${gameId}', 'e2e4', 'e4', '${startFen}', '1. e4', 5)`));
  await as(J, `select make_move('${gameId}', 'e2e4', 'e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', '1. e4', 0)`);
  const afterOneMove = (await db.query(`select ply, draw_offer_by from chess_games where id = '${gameId}'`)).rows[0];
  ok("ply advanced by one after a valid move", afterOneMove.ply === 1);

  // ───── draw offer cleared by the next move ─────
  await as(J, `select offer_draw('${gameId}')`);
  const withOffer = (await db.query(`select draw_offer_by from chess_games where id = '${gameId}'`)).rows[0];
  ok("offer_draw records who offered", withOffer.draw_offer_by === J);
  await as(K, `select make_move('${gameId}', 'e7e5', 'e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', '1. e4 e5', 1)`);
  const afterSecondMove = (await db.query(`select draw_offer_by, ply from chess_games where id = '${gameId}'`)).rows[0];
  ok("a pending draw offer is cleared by the opponent's move", afterSecondMove.draw_offer_by === null && afterSecondMove.ply === 2);

  // ───── resign freezes the game ─────
  await as(J, `select resign('${gameId}')`);
  const resigned = (await db.query(`select status, result, reason from chess_games where id = '${gameId}'`)).rows[0];
  ok("resign ends the game with the other side winning", resigned.status === "finished" && resigned.result === "black_won" && resigned.reason === "resignation");
  await throws("a finished game is frozen against further moves",
    () => as(K, `select make_move('${gameId}', 'g8f6', 'Nf6', '${startFen}', '', 2)`));
  await throws("a finished game is frozen against a new draw offer",
    () => as(K, `select offer_draw('${gameId}')`));

  // ───── abandonment: refused before 7 days, allowed after ─────
  const jChallengesK2 = (await as(J, `select * from create_challenge('${K}', 'black')`)).rows[0];
  const game2Id = (await as(K, `select * from accept_challenge(null, '${jChallengesK2.token}')`)).rows[0].game_id;
  const game2 = (await db.query(`select * from chess_games where id = '${game2Id}'`)).rows[0];
  // creator_side='black' => J is black, K is white; white (K) moves first.
  ok("creator_side='black' makes the creator black", game2.white_id === K && game2.black_id === J);
  await throws("claiming abandonment before 7 days is refused",
    () => as(J, `select claim_abandoned('${game2Id}')`));
  await db.exec(`update chess_games set last_move_at = now() - interval '8 days' where id = '${game2Id}'`);
  await as(J, `select claim_abandoned('${game2Id}')`);
  const abandoned = (await db.query(`select status, result, reason from chess_games where id = '${game2Id}'`)).rows[0];
  ok("claiming abandonment after 7 days gives the claimant the win",
    abandoned.status === "finished" && abandoned.result === "black_won" && abandoned.reason === "abandoned");

  // ───── expired challenge can't be accepted ─────
  const jChallengesK3 = (await as(J, `select * from create_challenge('${K}', 'white')`)).rows[0];
  await db.exec(`update chess_challenges set expires_at = now() - interval '1 hour' where id = '${jChallengesK3.id}'`);
  await throws("an expired challenge can't be accepted",
    () => as(K, `select * from accept_challenge(null, '${jChallengesK3.token}')`));
  await as(J, `select cancel_challenge('${jChallengesK3.id}')`); // tidy up: don't leave it counting toward J's cap below

  // ───── the 5-game cap ─────
  for (let i = 0; i < 5; i++) await as(J, "select * from create_challenge(null, 'random')");
  await throws("the 5-game cap refuses a 6th game or pending challenge",
    () => as(J, "select * from create_challenge(null, 'random')"));
  await db.exec(`delete from chess_challenges where created_by = '${J}' and status = 'pending' and recipient_id is null`);

  // ───── rematch swaps colours ─────
  const rematch = (await as(K, `select * from create_rematch('${gameId}')`)).rows[0];
  const rematchGameId = (await as(J, `select * from accept_challenge(null, '${rematch.token}')`)).rows[0].game_id;
  const rematchGame = (await db.query(`select white_id, black_id, rematch_of from chess_games where id = '${rematchGameId}'`)).rows[0];
  ok("a rematch swaps colours from the original game",
    rematchGame.white_id === game0.black_id && rematchGame.black_id === game0.white_id);
  ok("a rematch records which game it's a rematch of", rematchGame.rematch_of === gameId);

  // ───── my_chess_record: overall + head-to-head ─────
  await as(K, `select resign('${rematchGameId}')`);
  const jRecord = (await as(J, "select * from my_chess_record()")).rows;
  const jOverall = jRecord.find((r) => r.opponent_name === "Overall");
  const jVsKiran = jRecord.find((r) => r.opponent_name === "Kiran");
  // J so far: resigned game 1 (loss), claimed game 2 by abandonment (win), rematch where K resigned (win).
  ok("my_chess_record totals wins/losses/draws correctly", jOverall?.wins === 2 && jOverall?.losses === 1 && jOverall?.draws === 0);
  ok("my_chess_record's head-to-head matches the overall total (same single opponent)",
    jVsKiran?.wins === 2 && jVsKiran?.losses === 1);

  // ───── chess never touches plays, my_stats or the leaderboard ─────
  const statsBefore = JSON.stringify((await as(A, "select * from my_stats() order by game_id")).rows);
  const leaderboardBefore = JSON.stringify((await as(G, `select display_name, points, wins, games_played from leaderboard('group', '${gGroup.id}', 'day') order by display_name`)).rows);
  const aChallengesB = (await as(A, `select * from create_challenge('${B}', 'white')`)).rows[0];
  const abGameId = (await as(B, `select * from accept_challenge(null, '${aChallengesB.token}')`)).rows[0].game_id;
  await as(A, `select make_move('${abGameId}', 'e2e4', 'e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', '1. e4', 0)`);
  await as(B, `select resign('${abGameId}')`);
  const statsAfter = JSON.stringify((await as(A, "select * from my_stats() order by game_id")).rows);
  const leaderboardAfter = JSON.stringify((await as(G, `select display_name, points, wins, games_played from leaderboard('group', '${gGroup.id}', 'day') order by display_name`)).rows);
  ok("playing and finishing a chess game leaves my_stats() byte-identical", statsBefore === statsAfter);
  ok("playing and finishing a chess game leaves the leaderboard byte-identical", leaderboardBefore === leaderboardAfter);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
