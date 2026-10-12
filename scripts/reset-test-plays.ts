// Deletes every row in `plays` on the live DB, keeping puzzles, profiles, groups and group
// memberships untouched. Stats, streaks, points and leaderboards are computed live from `plays`
// (see supabase/migrations/0001_init.sql's my_stats()/friends_results() and 0004_groups.sql's
// get_leaderboard()) — there's no separate cache table, so clearing `plays` is the whole job.
//
// Usage:
//   npx tsx scripts/reset-test-plays.ts [--dry-run]
//
// Reads SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL, which isn't secret) from .env.local,
// same as scripts/upload-puzzles.ts. Asks for a typed confirmation before deleting anything,
// unless --dry-run is passed (which never deletes).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Database } from "../supabase/types";

interface Args {
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/** Minimal .env parser: KEY=VALUE per line, `#` comments, optional quotes. No extra dependency. */
function loadEnvLocal(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const env: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function requireServiceRoleKey(env: Record<string, string>): string {
  if (env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "VITE_SUPABASE_SERVICE_ROLE_KEY is set — the service role key must never carry a VITE_ " +
        "prefix, or Vite will ship it to every browser. Rename it to SUPABASE_SERVICE_ROLE_KEY " +
        "in .env.local and remove the VITE_-prefixed copy.",
    );
  }
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (see .env.example) — this " +
        "script refuses to run without it, since it's the only thing that can bypass RLS to delete.",
    );
  }
  return key;
}

function requireSupabaseUrl(env: Record<string, string>): string {
  const url = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error("VITE_SUPABASE_URL is missing. Add it to .env.local (see .env.example).");
  }
  return url;
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(prompt);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const env = loadEnvLocal(resolve(process.cwd(), ".env.local"));
  const serviceRoleKey = requireServiceRoleKey(env);
  const url = requireSupabaseUrl(env);
  const db = createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });

  const { count, error: countErr } = await db
    .from("plays")
    .select("*", { count: "exact", head: true });
  if (countErr) throw new Error(`Counting plays failed: ${countErr.message}`);

  if (!count) {
    console.log("plays is already empty. Nothing to do.");
    return;
  }

  console.log(`plays currently has ${count} row(s).`);
  console.log("puzzles, profiles, groups and group_members are not touched by this script.");

  if (args.dryRun) {
    console.log(`Dry run — would delete all ${count} row(s) from plays.`);
    return;
  }

  const ok = await confirm(`Type "yes" to permanently delete all ${count} row(s) from plays: `);
  if (!ok) {
    console.log("Aborted. Nothing was deleted.");
    return;
  }

  const { error: deleteErr, count: deleted } = await db
    .from("plays")
    .delete({ count: "exact" })
    .gte("puzzle_date", "1900-01-01");
  if (deleteErr) throw new Error(`Deleting plays failed: ${deleteErr.message}`);

  console.log(`Deleted ${deleted} row(s) from plays.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
