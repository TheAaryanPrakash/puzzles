// Pure logic for the Connections importer/scheduler — no filesystem access here, so it's cheap to
// unit test (see lib.test.ts). import.ts is the thin CLI wrapper that reads/writes files.
import { mulberry32, shuffle } from "../../src/lib/daily";

export interface ConnectionsGroup {
  label: string;
  level: 0 | 1 | 2 | 3;
  words: string[];
}

export interface ConnectionsPuzzle {
  groups: ConnectionsGroup[];
}

export interface CsvRow {
  gameId: string;
  puzzleDate: string;
  word: string;
  groupName: string;
  groupLevel: string;
  startingRow: string;
  startingColumn: string;
}

/**
 * Minimal RFC4180-ish CSV parser: handles quoted fields (with embedded commas, and `""` as an
 * escaped quote), which is all this dataset uses. Returns rows of raw string fields, header row
 * included at index 0 — callers slice it off.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalise line endings so a stray \r before \n (or alone) never gets treated as content.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Last field/row, if the file doesn't end with a trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

export function parseCsvRows(text: string): CsvRow[] {
  const rows = parseCsv(text);
  // Header: Game ID,Puzzle Date,Word,Group Name,Group Level,Starting Row,Starting Column
  return rows.slice(1).map(([gameId, puzzleDate, word, groupName, groupLevel, startingRow, startingColumn]) => ({
    gameId,
    puzzleDate,
    word,
    groupName,
    groupLevel,
    startingRow,
    startingColumn,
  }));
}

export interface RawPuzzle {
  gameId: string;
  puzzleDate: string;
  rows: CsvRow[];
}

/** Groups CSV rows by Game ID (one NYT puzzle = one Game ID = 16 rows, ideally). */
export function groupRowsByPuzzle(rows: CsvRow[]): RawPuzzle[] {
  const byGameId = new Map<string, RawPuzzle>();
  for (const row of rows) {
    if (!row.gameId) continue;
    let puzzle = byGameId.get(row.gameId);
    if (!puzzle) {
      puzzle = { gameId: row.gameId, puzzleDate: row.puzzleDate, rows: [] };
      byGameId.set(row.gameId, puzzle);
    }
    puzzle.rows.push(row);
  }
  return [...byGameId.values()];
}

export type ValidationResult =
  | { ok: true; puzzle: ConnectionsPuzzle }
  | { ok: false; reason: string };

/**
 * Validates and normalises one raw puzzle into `{ groups: [{ label, level, words }] }`,
 * ordered by level ascending (0=yellow .. 3=purple), NYT metadata (Game ID, Puzzle Date,
 * Starting Row/Column) stripped.
 *
 * The "no split numbers" check (CLAUDE.md "Archive data") is structural rather than
 * pattern-matching a specific fragment: a naive comma-split of a quoted field like `"20,000"`
 * would produce an extra malformed row (wrong column count) or a non-numeric `Group Level`, both
 * of which are caught below. This dataset's CSV already quotes such fields correctly (verified
 * directly against the raw file — see RESEARCH.md), so this is a defensive check expected to
 * reject 0 puzzles here, not a no-op.
 */
export function validatePuzzle(raw: RawPuzzle): ValidationResult {
  const { gameId, rows } = raw;

  if (rows.length !== 16) {
    return { ok: false, reason: `game ${gameId}: expected 16 word-rows, found ${rows.length}` };
  }

  const words = new Set<string>();
  for (const row of rows) {
    if (
      row.word === undefined ||
      row.groupName === undefined ||
      row.groupLevel === undefined ||
      row.word === "" ||
      row.groupName === ""
    ) {
      return { ok: false, reason: `game ${gameId}: malformed row (missing word/group/level — likely a split field)` };
    }
    if (words.has(row.word)) {
      return { ok: false, reason: `game ${gameId}: duplicate word "${row.word}"` };
    }
    words.add(row.word);
  }
  if (words.size !== 16) {
    return { ok: false, reason: `game ${gameId}: expected 16 unique words, found ${words.size}` };
  }

  const groupsByName = new Map<string, { level: number; words: string[] }>();
  for (const row of rows) {
    const level = Number(row.groupLevel);
    if (!Number.isInteger(level) || level < 0 || level > 3) {
      return { ok: false, reason: `game ${gameId}: group level "${row.groupLevel}" is not an integer 0-3 (likely a split field)` };
    }
    let group = groupsByName.get(row.groupName);
    if (!group) {
      group = { level, words: [] };
      groupsByName.set(row.groupName, group);
    } else if (group.level !== level) {
      return { ok: false, reason: `game ${gameId}: group "${row.groupName}" has inconsistent levels` };
    }
    group.words.push(row.word);
  }

  if (groupsByName.size !== 4) {
    return { ok: false, reason: `game ${gameId}: expected 4 groups, found ${groupsByName.size}` };
  }

  const levelsSeen = new Set<number>();
  const groups: ConnectionsGroup[] = [];
  for (const [label, group] of groupsByName) {
    if (group.words.length !== 4) {
      return { ok: false, reason: `game ${gameId}: group "${label}" has ${group.words.length} words, expected 4` };
    }
    if (levelsSeen.has(group.level)) {
      return { ok: false, reason: `game ${gameId}: level ${group.level} used by more than one group` };
    }
    levelsSeen.add(group.level);
    groups.push({ label, level: group.level as 0 | 1 | 2 | 3, words: group.words });
  }
  if (levelsSeen.size !== 4 || ![0, 1, 2, 3].every((l) => levelsSeen.has(l))) {
    return { ok: false, reason: `game ${gameId}: levels 0-3 must each appear exactly once` };
  }

  groups.sort((a, b) => a.level - b.level);
  return { ok: true, puzzle: { groups } };
}

export interface ScheduleResult {
  mains: ConnectionsPuzzle[];
  reservePool: ConnectionsPuzzle[];
}

/**
 * Seed-31 shuffle of every valid puzzle; the first `scheduleDays` become the (non-repeating)
 * daily mains, everything left over is the reserve pool. Day n's reserve is
 * `reservePool[n % reservePool.length]` — computed by the caller (import.ts), since that's a
 * per-day lookup, not part of the one-time schedule split.
 */
export function schedulePuzzles(valid: ConnectionsPuzzle[], seed: number, scheduleDays: number): ScheduleResult {
  if (valid.length < scheduleDays) {
    throw new Error(`not enough valid puzzles: need ${scheduleDays} mains, only have ${valid.length}`);
  }
  const rng = mulberry32(seed);
  const shuffled = shuffle(valid, rng);
  const mains = shuffled.slice(0, scheduleDays);
  const reservePool = shuffled.slice(scheduleDays);
  if (reservePool.length === 0) {
    throw new Error("no puzzles left over for the reserve pool");
  }
  return { mains, reservePool };
}
