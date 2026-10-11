// Generator-only logic for the Mini crossword: turning one archive record into a numbered grid,
// picking a fair clue for each entry, and scheduling 365 days + a reserve pool. Kept separate
// from src/games/mini/logic.ts (the runtime game logic) and unit-tested on its own — see
// RESEARCH.md for why each rule is here.
import type { Direction, MiniCell, MiniClue } from "../../src/games/mini/logic";

export interface RawArchiveCell {
  guess?: string;
  blank?: boolean;
}

export interface RawArchivePuzzle {
  print_date: string;
  puzzle_id: number;
  board: { cells: RawArchiveCell[] };
}

export interface ParsedGrid {
  date: string;
  size: number;
  letters: (string | null)[]; // row-major; null = black square
}

/**
 * Parses one archive record into a letter grid, or null if it's unusable: not square, or
 * containing a non-single-letter "guess" (the archive has two puzzles with a rebus-style square
 * — a literal "-" and a literal "8" sharing one cell with other letters — which this grid's
 * one-letter-per-cell UI can't represent; dropped like the 6x6 one-off, see RESEARCH.md).
 */
export function parseArchiveGrid(raw: RawArchivePuzzle): ParsedGrid | null {
  const cells = raw.board.cells;
  const size = Math.round(Math.sqrt(cells.length));
  if (size * size !== cells.length || size < 2) return null;

  const letters: (string | null)[] = [];
  for (const cell of cells) {
    if (cell.blank) {
      letters.push(null);
      continue;
    }
    const guess = cell.guess ?? "";
    if (!/^[A-Za-z]$/.test(guess)) return null;
    letters.push(guess.toUpperCase());
  }
  return { date: raw.print_date, size, letters };
}

export interface GridEntry {
  number: number;
  row: number;
  col: number;
  length: number;
  answer: string;
}

export interface NumberedGrid {
  cells: MiniCell[];
  across: GridEntry[];
  down: GridEntry[];
}

/**
 * Standard crossword numbering: scan row-major; a cell starts a new number if it begins an
 * across run of length ≥ 2 (black/edge to its left, white to its right) and/or a down run of
 * length ≥ 2 (black/edge above, white below) — one shared numbering sequence for both.
 */
export function numberGrid(size: number, letters: (string | null)[]): NumberedGrid {
  const black = (r: number, c: number): boolean =>
    r < 0 || r >= size || c < 0 || c >= size || letters[r * size + c] === null;

  const cells: MiniCell[] = letters.map((letter) => (letter === null ? null : { answer: letter }));
  const across: GridEntry[] = [];
  const down: GridEntry[] = [];
  let number = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (black(r, c)) continue;
      const startsAcross = black(r, c - 1) && !black(r, c + 1);
      const startsDown = black(r - 1, c) && !black(r + 1, c);
      if (!startsAcross && !startsDown) continue;

      number += 1;
      const cell = cells[r * size + c];
      if (cell) cell.number = number;

      if (startsAcross) {
        let length = 0;
        while (!black(r, c + length)) length++;
        const answer = Array.from({ length }, (_, i) => letters[r * size + c + i]).join("");
        across.push({ number, row: r, col: c, length, answer });
      }
      if (startsDown) {
        let length = 0;
        while (!black(r + length, c)) length++;
        const answer = Array.from({ length }, (_, i) => letters[(r + i) * size + c]).join("");
        down.push({ number, row: r, col: c, length, answer });
      }
    }
  }
  return { cells, across, down };
}

/** Every white cell must belong to at least one entry — an isolated cell means a broken grid. */
export function findIsolatedCells(size: number, grid: NumberedGrid): number[] {
  const covered = new Set<number>();
  for (const entry of grid.across) {
    for (let i = 0; i < entry.length; i++) covered.add(entry.row * size + entry.col + i);
  }
  for (const entry of grid.down) {
    for (let i = 0; i < entry.length; i++) covered.add((entry.row + i) * size + entry.col);
  }
  const isolated: number[] = [];
  grid.cells.forEach((cell, i) => {
    if (cell && !covered.has(i)) isolated.push(i);
  });
  return isolated;
}

// ---------------------------------------------------------------------------------------------
// CSV (the CrosswordQA dataset has quoted fields with embedded commas and quotes, e.g.
// `"""Dick Tracy"" character Trueheart"` — plain `split(",")` can't handle that).
// ---------------------------------------------------------------------------------------------

/** Minimal RFC4180-style CSV parser: quoted fields, doubled-quote escaping, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r") {
      i += 1;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Clue selection
// ---------------------------------------------------------------------------------------------

/**
 * Disqualifies wordplay ("?"), cross-references ("See 5-Across", "11-Down"), and clues that name
 * a specific year — the three CLAUDE.md rules that are reliably detectable by pattern. "Recent
 * event" clues that don't name a year slip past this and get caught in manual review of the
 * samples file instead (see RESEARCH.md).
 */
const BAD_CLUE = /\?|\d+-?\s*(across|down)\b|\bsee\s+\d+|\b(19|20)\d{2}\b/i;

export function isUsableClue(clue: string): boolean {
  const text = clue.trim();
  return text.length > 0 && !BAD_CLUE.test(text);
}

/**
 * Deduplicates and ranks candidate clue strings for one answer: clues that recur (appearing for
 * that answer across several puzzles in the dataset) sort first, then shorter ones — both read
 * as more "standard" and fair. Does not pick one; `pickClue` does that so the same answer can
 * get a different clue on different days.
 */
export function rankClues(rawClues: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const raw of rawClues) {
    const text = raw.trim();
    if (!text) continue;
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([text]) => text);
}

export interface PickedClue {
  clue: string;
  source: "dataset" | "written";
}

/**
 * Picks one clue for an occurrence of `answer`: a uniform-random choice (via the seeded `rng`)
 * among the top `poolSize` ranked dataset candidates, so a frequently-repeated answer varies
 * across days instead of always showing the single "best" clue. Falls back to the hand-written
 * clue when the dataset has no usable candidate for this answer at all.
 */
export function pickClue(
  rankedCandidates: readonly string[] | undefined,
  written: string | undefined,
  rng: () => number,
  poolSize = 8,
  answer?: string,
): PickedClue {
  const pool = (rankedCandidates ?? []).slice(0, poolSize);
  if (pool.length > 0) {
    const clue = pool[Math.floor(rng() * pool.length)];
    return { clue, source: "dataset" };
  }
  if (written) return { clue: written, source: "written" };
  throw new Error(`no usable clue for answer${answer ? ` "${answer}"` : ""}`);
}

/** Attaches a chosen clue to a grid entry, producing the final MiniClue shape. */
export function toMiniClue(entry: GridEntry, picked: PickedClue): MiniClue {
  return { ...entry, clue: picked.clue, source: picked.source };
}

// ---------------------------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------------------------

export function isSaturday(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6;
}

export interface AssignedMains<T> {
  mains: Map<string, T>;
  leftover: T[];
}

/**
 * Assigns one unique main grid per day: a 7x7 on Saturdays, a 5x5 every other day (CLAUDE.md's
 * weekday/Saturday split), consuming each pool in its given order (callers pass a pre-shuffled
 * pool for variety; this function stays a deterministic consumer, easier to test on its own).
 * Throws if either pool runs out — the generator-level "not enough puzzles" guard.
 */
export function assignMains<T>(fives: readonly T[], sevens: readonly T[], days: readonly string[]): AssignedMains<T> {
  const fivesQueue = [...fives];
  const sevensQueue = [...sevens];
  const mains = new Map<string, T>();
  for (const day of days) {
    if (isSaturday(day)) {
      const grid = sevensQueue.shift();
      if (!grid) throw new Error(`not enough 7x7 grids for every Saturday (ran out at ${day})`);
      mains.set(day, grid);
    } else {
      const grid = fivesQueue.shift();
      if (!grid) throw new Error(`not enough 5x5 grids for every weekday (ran out at ${day})`);
      mains.set(day, grid);
    }
  }
  return { mains, leftover: [...fivesQueue, ...sevensQueue] };
}

/** Day n's reserve, cycling through the (shuffled) leftover pool — same rule as Connections. */
export function reserveFor<T>(pool: readonly T[], dayNumber: number): T {
  if (pool.length === 0) throw new Error("reserve pool is empty");
  return pool[((dayNumber % pool.length) + pool.length) % pool.length];
}
