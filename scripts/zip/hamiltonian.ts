// Hamiltonian path generation and uniqueness checking for Zip boards.
// See src/games/zip/RESEARCH.md ("Hamiltonian path generation" / "Checkpoints and uniqueness")
// for the techniques this borrows (connectivity-pruned randomized DFS; a bounded second-solution
// search as the uniqueness oracle).
import { shuffle } from "../../src/lib/daily";
import {
  canExtend,
  cellsEqual,
  hasWall,
  type Cell,
  type Checkpoint,
  type Wall,
} from "../../src/games/zip/logic";

const NODE_BUDGET_PER_ATTEMPT = 20_000;
const PATH_BUILD_RESTARTS = 300;

function idx(size: number, cell: Cell): number {
  return cell.row * size + cell.col;
}

function cellOf(size: number, i: number): Cell {
  return { row: Math.floor(i / size), col: i % size };
}

function neighborIndices(size: number, i: number): number[] {
  const { row, col } = cellOf(size, i);
  const out: number[] = [];
  if (row > 0) out.push(idx(size, { row: row - 1, col }));
  if (row < size - 1) out.push(idx(size, { row: row + 1, col }));
  if (col > 0) out.push(idx(size, { row, col: col - 1 }));
  if (col < size - 1) out.push(idx(size, { row, col: col + 1 }));
  return out;
}

/**
 * Flood-fills the unvisited cells reachable from `from` (exclusive — `from` itself is already
 * marked visited by the caller) and returns how many there are. Used to prune a move that would
 * strand part of the grid — a classic speed-up for randomized Hamiltonian-path search (see
 * RESEARCH.md).
 */
function reachableUnvisitedCount(size: number, visited: Uint8Array, from: number): number {
  const stack = [from];
  const seen = new Uint8Array(visited.length);
  let count = 0;
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of neighborIndices(size, cur)) {
      if (visited[n] || seen[n]) continue;
      seen[n] = 1;
      count++;
      stack.push(n);
    }
  }
  return count;
}

function totalUnvisited(visited: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < visited.length; i++) if (!visited[i]) n++;
  return n;
}

/**
 * Builds a random Hamiltonian path over a `size`×`size` grid: randomized DFS, shuffling neighbor
 * order with `rng`, pruning any move that would disconnect the remaining unvisited cells from
 * each other. Restarts from a new random start cell (consuming further `rng` draws) if a node
 * budget is exceeded or a dead end is reached, rather than exploring a bad branch forever.
 * Returns `null` if no path is found within the restart budget (the caller should treat this as
 * "try again with a fresh rng draw", not a hard failure of the whole generator).
 */
export function buildHamiltonianPath(rng: () => number, size: number): Cell[] | null {
  const total = size * size;

  for (let attempt = 0; attempt < PATH_BUILD_RESTARTS; attempt++) {
    const visited = new Uint8Array(total);
    const path: number[] = [];
    let nodesExplored = 0;
    let budgetExceeded = false;

    const start = Math.floor(rng() * total);
    visited[start] = 1;
    path.push(start);

    function dfs(current: number): boolean {
      if (path.length === total) return true;
      nodesExplored++;
      if (nodesExplored > NODE_BUDGET_PER_ATTEMPT) {
        budgetExceeded = true;
        return false;
      }
      const neighbors = shuffle(neighborIndices(size, current), rng);
      for (const n of neighbors) {
        if (visited[n]) continue;
        visited[n] = 1;
        if (reachableUnvisitedCount(size, visited, n) === totalUnvisited(visited)) {
          path.push(n);
          if (dfs(n)) return true;
          path.pop();
        }
        visited[n] = 0;
        if (budgetExceeded) return false;
      }
      return false;
    }

    if (dfs(start)) {
      return path.map((i) => cellOf(size, i));
    }
  }
  return null;
}

/**
 * Picks `count` checkpoints along `path`: always the first and last cell, plus `count - 2`
 * intermediate positions spaced roughly evenly along the path with a little random jitter (so
 * different days don't all look mechanically identical).
 */
export function selectCheckpoints(path: Cell[], count: number, rng: () => number): Checkpoint[] {
  const total = path.length;
  const n = Math.max(2, Math.min(count, total));
  const indices = new Set<number>([0, total - 1]);

  const target = n - indices.size;
  const slot = total / n;
  for (let k = 1; indices.size < n && k < n; k++) {
    const base = Math.round(k * slot);
    const jitter = Math.round((rng() - 0.5) * slot * 0.5);
    let candidate = Math.min(total - 2, Math.max(1, base + jitter));
    // Resolve collisions by nudging forward, then backward.
    while (indices.has(candidate) && candidate < total - 2) candidate++;
    while (indices.has(candidate) && candidate > 1) candidate--;
    indices.add(candidate);
    if (indices.size - 2 >= target) break;
  }

  const sorted = [...indices].sort((a, b) => a - b);
  return sorted.map((pathIndex, i) => ({ num: i + 1, row: path[pathIndex].row, col: path[pathIndex].col }));
}

/** Inserts one more checkpoint at the current largest gap (in path-index terms) between neighbors. */
export function growCheckpoints(path: Cell[], checkpoints: Checkpoint[]): Checkpoint[] {
  const pathIndex = new Map<string, number>();
  path.forEach((c, i) => pathIndex.set(`${c.row},${c.col}`, i));
  const sortedByPathIndex = [...checkpoints].sort(
    (a, b) => pathIndex.get(`${a.row},${a.col}`)! - pathIndex.get(`${b.row},${b.col}`)!,
  );

  let bestGap = -1;
  let bestMid = -1;
  for (let i = 0; i < sortedByPathIndex.length - 1; i++) {
    const from = pathIndex.get(`${sortedByPathIndex[i].row},${sortedByPathIndex[i].col}`)!;
    const to = pathIndex.get(`${sortedByPathIndex[i + 1].row},${sortedByPathIndex[i + 1].col}`)!;
    const gap = to - from;
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = from + Math.floor(gap / 2);
    }
  }
  if (bestMid === -1 || bestGap < 2) return checkpoints; // no room left to insert anywhere

  const newCell = path[bestMid];
  const withNew = [...checkpoints.map((c) => ({ ...c })), { num: -1, row: newCell.row, col: newCell.col }];
  const byPathIndex = withNew.sort(
    (a, b) => pathIndex.get(`${a.row},${a.col}`)! - pathIndex.get(`${b.row},${b.col}`)!,
  );
  return byPathIndex.map((c, i) => ({ num: i + 1, row: c.row, col: c.col }));
}

export type SolutionCount = number; // capped at `cap`

/**
 * Finds up to `cap` Hamiltonian paths that start at `checkpoints[0]`, cover every cell, hit every
 * checkpoint in increasing numeric order, never cross a wall, and end exactly on the last
 * checkpoint — the full win condition (see logic.ts `isSolved`). Stops exploring once `cap`
 * solutions are found. `countSolutions` below is the common case (just "is it unique?"); this is
 * exported separately for the generator's uniqueness-by-search loop, which needs an actual
 * alternate solution to know *which* edge to wall off (see RESEARCH.md's "Checkpoints and
 * uniqueness").
 */
export function findSolutions(
  size: number,
  checkpoints: Checkpoint[],
  walls: Wall[],
  cap: number,
  nodeBudget: number,
): { solutions: Cell[][]; budgetExceeded: boolean } {
  const total = size * size;
  const puzzle = { size, checkpoints, walls, solution: [] as Cell[] };
  const start = checkpoints[0];
  const visited = new Uint8Array(total);
  const path: Cell[] = [start];
  visited[start.row * size + start.col] = 1;
  const solutions: Cell[][] = [];
  let nodes = 0;
  let budgetExceeded = false;

  function neighborsOf(cell: Cell): Cell[] {
    const out: Cell[] = [];
    if (cell.row > 0) out.push({ row: cell.row - 1, col: cell.col });
    if (cell.row < size - 1) out.push({ row: cell.row + 1, col: cell.col });
    if (cell.col > 0) out.push({ row: cell.row, col: cell.col - 1 });
    if (cell.col < size - 1) out.push({ row: cell.row, col: cell.col + 1 });
    return out;
  }

  // `from` is already marked visited by the caller; this counts unvisited cells reachable
  // through other unvisited cells (never counting `from` itself), and compares that to how many
  // unvisited cells remain in total — if they don't match, some cell would be stranded.
  function reachableAllUnvisited(from: Cell): boolean {
    const stack = [from];
    const seen = new Uint8Array(total);
    let count = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const n of neighborsOf(cur)) {
        const ni = n.row * size + n.col;
        if (visited[ni] || seen[ni]) continue;
        if (hasWall(walls, cur, n)) continue;
        seen[ni] = 1;
        count++;
        stack.push(n);
      }
    }
    let unvisitedTotal = 0;
    for (let i = 0; i < total; i++) if (!visited[i]) unvisitedTotal++;
    return count === unvisitedTotal;
  }

  function dfs(current: Cell): void {
    if (solutions.length >= cap || budgetExceeded) return;
    nodes++;
    if (nodes > nodeBudget) {
      budgetExceeded = true;
      return;
    }
    if (path.length === total) {
      if (cellsEqual(current, checkpoints[checkpoints.length - 1])) solutions.push([...path]);
      return;
    }
    for (const n of neighborsOf(current)) {
      if (solutions.length >= cap || budgetExceeded) return;
      if (!canExtend(puzzle, path, n)) continue;
      const ni = n.row * size + n.col;
      visited[ni] = 1;
      path.push(n);
      if (reachableAllUnvisited(n) || path.length === total) {
        dfs(n);
      }
      path.pop();
      visited[ni] = 0;
    }
  }

  dfs(start);
  return { solutions, budgetExceeded };
}

/** "Is it unique?" over `findSolutions` — the common case, which doesn't need the actual paths. */
export function countSolutions(
  size: number,
  checkpoints: Checkpoint[],
  walls: Wall[],
  cap: number,
  nodeBudget: number,
): { count: SolutionCount; budgetExceeded: boolean } {
  const { solutions, budgetExceeded } = findSolutions(size, checkpoints, walls, cap, nodeBudget);
  return { count: solutions.length, budgetExceeded };
}

/**
 * Given an alternate solution (`alt`, found by `findSolutions` alongside the true `solution`),
 * picks a grid-adjacent pair of cells that `alt` steps between but `solution` never does — walling
 * that edge eliminates `alt` (and everything else that relies on that exact step) without ever
 * blocking `solution`, since `solution` doesn't use it. Returns `null` only if `alt` turns out to
 * be identical to `solution` (nothing to wall off).
 */
export function pickDifferingEdge(alt: Cell[], solution: Cell[], existingWalls: Wall[]): Wall | null {
  const solutionSteps = new Set<string>();
  for (let i = 0; i < solution.length - 1; i++) {
    const a = solution[i];
    const b = solution[i + 1];
    solutionSteps.add(`${a.row},${a.col}|${b.row},${b.col}`);
    solutionSteps.add(`${b.row},${b.col}|${a.row},${a.col}`);
  }
  for (let i = 0; i < alt.length - 1; i++) {
    const a = alt[i];
    const b = alt[i + 1];
    if (solutionSteps.has(`${a.row},${a.col}|${b.row},${b.col}`)) continue;
    if (hasWall(existingWalls, a, b)) continue;
    return { a, b };
  }
  return null;
}
