import { SITE_URL } from "../../config";

export interface Cell {
  row: number;
  col: number;
}

export interface Checkpoint extends Cell {
  num: number;
}

export interface Wall {
  a: Cell;
  b: Cell;
}

export interface ZipPuzzle {
  size: number;
  checkpoints: Checkpoint[];
  walls: Wall[];
  /** The one valid Hamiltonian path, in order. Never shown to the player; used only for scoring. */
  solution: Cell[];
}

export interface ZipState {
  path: Cell[];
  /** Seconds of play time accumulated so far. */
  elapsed: number;
}

/**
 * A freshly-started play's `state` is `{}` (the database's own `default '{}'::jsonb`, mirrored by
 * the local adapter) — not yet shaped like ZipState. Always derive state as
 * `{ ...DEFAULT_STATE, ...play?.state }`, never `play?.state ?? DEFAULT_STATE`: the latter only
 * falls back when `play` itself is null/undefined, so it still crashes on the empty-but-truthy `{}`
 * seen in the render between `start()` resolving and the first `save()` landing.
 */
export const DEFAULT_STATE: ZipState = { path: [], elapsed: 0 };

export type Direction = "up" | "down" | "left" | "right";

const DIRECTION_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function inBounds(size: number, cell: Cell): boolean {
  return cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
}

/** Walls are undirected: a wall "between A and B" blocks movement either way. */
export function hasWall(walls: Wall[], a: Cell, b: Cell): boolean {
  return walls.some(
    (w) =>
      (cellsEqual(w.a, a) && cellsEqual(w.b, b)) || (cellsEqual(w.a, b) && cellsEqual(w.b, a)),
  );
}

export function checkpointAt(puzzle: ZipPuzzle, cell: Cell): Checkpoint | undefined {
  return puzzle.checkpoints.find((c) => cellsEqual(c, cell));
}

export function indexInPath(path: Cell[], cell: Cell): number {
  return path.findIndex((c) => cellsEqual(c, cell));
}

/** How many checkpoints have been visited so far, given legal moves were enforced all along. */
export function visitedCheckpointCount(puzzle: ZipPuzzle, path: Cell[]): number {
  return path.filter((cell) => checkpointAt(puzzle, cell) !== undefined).length;
}

export function firstCheckpoint(puzzle: ZipPuzzle): Checkpoint {
  return puzzle.checkpoints[0];
}

export function lastCheckpoint(puzzle: ZipPuzzle): Checkpoint {
  return puzzle.checkpoints[puzzle.checkpoints.length - 1];
}

/**
 * Whether `cell` may be appended to the end of `path` right now: adjacent to the path's current
 * end (or, for an empty path, exactly the first checkpoint), in bounds, not already visited, not
 * blocked by a wall, and — if it's a checkpoint — the next one in numeric order.
 */
export function canExtend(puzzle: ZipPuzzle, path: Cell[], cell: Cell): boolean {
  if (!inBounds(puzzle.size, cell)) return false;
  if (indexInPath(path, cell) !== -1) return false;

  if (path.length === 0) {
    return cellsEqual(cell, firstCheckpoint(puzzle));
  }

  const last = path[path.length - 1];
  if (!isAdjacent(last, cell)) return false;
  if (hasWall(puzzle.walls, last, cell)) return false;

  const checkpoint = checkpointAt(puzzle, cell);
  if (checkpoint) {
    return checkpoint.num === visitedCheckpointCount(puzzle, path) + 1;
  }
  return true;
}

/**
 * The single rule engine behind both drag-to-draw and arrow-key movement. If `cell` is already on
 * the path, the path retracts to that point (drag-back / moving into your own tail). If it's a
 * legal extension, it's appended. Otherwise the path is unchanged — illegal moves are silently
 * ignored, matching the original game's feel of "the pen just doesn't move there".
 */
export function applyCellInteraction(puzzle: ZipPuzzle, path: Cell[], cell: Cell): Cell[] {
  const existingIndex = indexInPath(path, cell);
  if (existingIndex !== -1) {
    return path.slice(0, existingIndex + 1);
  }
  if (canExtend(puzzle, path, cell)) {
    return [...path, { row: cell.row, col: cell.col }];
  }
  return path;
}

/**
 * Arrow-key movement. An empty path starts at checkpoint 1 regardless of direction (there is
 * nothing to move "from" yet); otherwise the candidate cell is the current end plus the direction,
 * fed through the same `applyCellInteraction` rules (so moving back onto your own tail retracts,
 * exactly like dragging back).
 */
export function moveInDirection(puzzle: ZipPuzzle, path: Cell[], direction: Direction): Cell[] {
  if (path.length === 0) {
    const first = firstCheckpoint(puzzle);
    return [{ row: first.row, col: first.col }];
  }
  const last = path[path.length - 1];
  const { dr, dc } = DIRECTION_DELTAS[direction];
  const candidate: Cell = { row: last.row + dr, col: last.col + dc };
  return applyCellInteraction(puzzle, path, candidate);
}

export function undo(path: Cell[]): Cell[] {
  return path.slice(0, -1);
}

export function clearPath(): Cell[] {
  return [];
}

/**
 * Full coverage alone isn't enough — the path must also end on the highest checkpoint (the
 * original game's "ending at the highest number" rule). A player can fill every cell while
 * wandering past the final checkpoint earlier and finishing elsewhere; that is not a win.
 */
export function isSolved(puzzle: ZipPuzzle, path: Cell[]): boolean {
  const total = puzzle.size * puzzle.size;
  if (path.length !== total) return false;
  return cellsEqual(path[path.length - 1], lastCheckpoint(puzzle));
}

export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Spoiler-free share text: puzzle number and time only — never the path or the solution. */
export function buildSummary(puzzleNumber: number, elapsedSeconds: number): string {
  return `Zip #${puzzleNumber} ⏱ ${formatElapsed(elapsedSeconds)}\n\n${SITE_URL}`;
}
