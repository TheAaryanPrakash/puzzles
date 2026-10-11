// Upserts content/puzzles/<gameId>/<date>.json into the `puzzles` table, bypassing RLS with the
// service role key. Local only — the service role key must never reach a browser bundle, so this
// script is run with `npx tsx`, never imported by app code.
//
// Usage:
//   npx tsx scripts/upload-puzzles.ts [--game <id>] [--from <YYYY-MM-DD>] [--dry-run]
//
// Reads SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL, which isn't secret) from .env.local.
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Database } from "../supabase/types";

const BATCH_SIZE = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

interface Args {
  game?: string;
  from?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--game") args.game = argv[++i];
    else if (arg === "--from") args.from = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.from && !/^\d{4}-\d{2}-\d{2}$/.test(args.from)) {
    throw new Error(`--from must be YYYY-MM-DD, got "${args.from}"`);
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
        "script refuses to run without it, since it's the only thing that can bypass RLS to write.",
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

interface PuzzleRow {
  game_id: string;
  puzzle_date: string;
  payload: unknown;
  reserve: unknown | null;
}

function collectRows(contentDir: string, args: Args): PuzzleRow[] {
  const rows: PuzzleRow[] = [];
  const gameDirs = readdirSync(contentDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .filter((id) => !args.game || id === args.game)
    .sort();

  if (args.game && !gameDirs.includes(args.game)) {
    throw new Error(`No content/puzzles/${args.game}/ directory found.`);
  }

  for (const gameId of gameDirs) {
    const gameDir = join(contentDir, gameId);
    const files = readdirSync(gameDir).filter((f) => DATE_RE.test(f) && statSync(join(gameDir, f)).isFile());
    for (const file of files.sort()) {
      const date = file.replace(/\.json$/, "");
      if (args.from && date < args.from) continue;
      const raw = JSON.parse(readFileSync(join(gameDir, file), "utf8")) as {
        payload: unknown;
        reserve?: unknown | null;
      };
      rows.push({
        game_id: gameId,
        puzzle_date: date,
        payload: raw.payload,
        reserve: raw.reserve ?? null,
      });
    }
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const rows = collectRows(resolve(process.cwd(), "content/puzzles"), args);
  if (rows.length === 0) {
    console.log("No matching puzzle files found.");
    return;
  }

  const countsByGame = new Map<string, number>();
  for (const row of rows) countsByGame.set(row.game_id, (countsByGame.get(row.game_id) ?? 0) + 1);

  if (args.dryRun) {
    console.log(`Dry run — would upsert ${rows.length} row(s):`);
    for (const [gameId, count] of countsByGame) console.log(`  ${gameId}: ${count}`);
    return;
  }

  // Only a real upload needs to bypass RLS, so the key is required from here on, not for --dry-run.
  const env = loadEnvLocal(resolve(process.cwd(), ".env.local"));
  const serviceRoleKey = requireServiceRoleKey(env);
  const url = requireSupabaseUrl(env);
  const db = createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await db.from("puzzles").upsert(batch, { onConflict: "game_id,puzzle_date" });
    if (error) {
      throw new Error(`Upload failed on batch starting at row ${i}: ${error.message}`);
    }
  }

  console.log(`Uploaded ${rows.length} row(s):`);
  for (const [gameId, count] of countsByGame) console.log(`  ${gameId}: ${count}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
