import { PGlite } from "@electric-sql/pglite";
// Run: node supabase/tests/schema.test.mjs supabase/migrations/0001_init.sql  (needs @electric-sql/pglite)
// Applies every *.sql file in that path's directory, in filename order — so a new migration
// only needs a new file here, never a change to this invocation (package.json's test:db is frozen).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const db = new PGlite();
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const throws = async (name, fn) => { try { await fn(); ok(name, false); } catch (e) { ok(`${name}  (${e.message.split("\n")[0]})`, true); } };

// Supabase shim: roles, auth schema, auth.uid() from a session setting
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  insert into auth.users values ('${A}'), ('${B}'), ('${C}');
`);
const migrationsDir = dirname(process.argv[2]);
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
for (const file of migrationFiles) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}
await db.exec(`
  grant usage on schema public, auth to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
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

// Privacy + friends board
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

// 0002: RLS performance indexes exist (see docs/research/backend.md)
const indexNames = (await db.query(
  "select indexname from pg_indexes where schemaname = 'public' and tablename in ('plays', 'messages')",
)).rows.map((r) => r.indexname);
ok("plays has a (game_id, puzzle_date) index", indexNames.includes("plays_game_date_idx"));
ok("messages has a recipient index", indexNames.includes("messages_recipient_idx"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
