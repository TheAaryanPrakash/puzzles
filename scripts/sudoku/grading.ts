// Technique-based difficulty grader (see RESEARCH.md "Chosen approach — difficulty"). A puzzle is
// "easy" if naked + hidden singles alone solve it, "medium" if it also needs locked candidates
// (pointing pairs / box-line reduction) or naked/hidden pairs/triples, and "hard" if even those
// aren't enough and a solver would have to guess/backtrack.
import { type BoardConfig, type Grid, candidatesFor, cloneGrid } from "./core";

export type DifficultyTier = "easy" | "medium" | "hard";

type Candidates = number[][][]; // [row][col] -> candidate values; [] once filled

type Coord = [number, number];

function computeCandidates(grid: Grid, config: BoardConfig): Candidates {
  return grid.map((row, r) =>
    row.map((value, c) => (value === 0 ? candidatesFor(grid, r, c, config) : [])),
  );
}

function isFull(grid: Grid): boolean {
  return grid.every((row) => row.every((v) => v !== 0));
}

function getRows(config: BoardConfig): Coord[][] {
  return Array.from({ length: config.size }, (_, r) =>
    Array.from({ length: config.size }, (_, c): Coord => [r, c]),
  );
}

function getCols(config: BoardConfig): Coord[][] {
  return Array.from({ length: config.size }, (_, c) =>
    Array.from({ length: config.size }, (_, r): Coord => [r, c]),
  );
}

function getBoxes(config: BoardConfig): Coord[][] {
  const boxes: Coord[][] = [];
  for (let br = 0; br < config.size; br += config.boxH) {
    for (let bc = 0; bc < config.size; bc += config.boxW) {
      const box: Coord[] = [];
      for (let r = br; r < br + config.boxH; r++) {
        for (let c = bc; c < bc + config.boxW; c++) box.push([r, c]);
      }
      boxes.push(box);
    }
  }
  return boxes;
}

function getUnits(config: BoardConfig): Coord[][] {
  return [...getRows(config), ...getCols(config), ...getBoxes(config)];
}

function sameCell(a: Coord, b: Coord): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function removeCandidate(candidates: Candidates, [r, c]: Coord, value: number): boolean {
  const list = candidates[r][c];
  const idx = list.indexOf(value);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

function cellsWithCandidate(cells: Coord[], candidates: Candidates, value: number): Coord[] {
  return cells.filter(([r, c]) => candidates[r][c].includes(value));
}

/** Pointing pairs/triples: a box's cells for one value are confined to a single row or column — eliminate it from the rest of that row/column outside the box. */
function applyPointingPairs(candidates: Candidates, config: BoardConfig): boolean {
  let changed = false;
  for (const box of getBoxes(config)) {
    for (let value = 1; value <= config.size; value++) {
      const cells = cellsWithCandidate(box, candidates, value);
      if (cells.length < 2 || cells.length > 3) continue;
      const rows = new Set(cells.map(([r]) => r));
      const cols = new Set(cells.map(([, c]) => c));
      if (rows.size === 1) {
        const [row] = rows;
        for (let c = 0; c < config.size; c++) {
          if (!cells.some(([, cc]) => cc === c)) {
            if (removeCandidate(candidates, [row, c], value)) changed = true;
          }
        }
      } else if (cols.size === 1) {
        const [col] = cols;
        for (let r = 0; r < config.size; r++) {
          if (!cells.some(([rr]) => rr === r)) {
            if (removeCandidate(candidates, [r, col], value)) changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/** Box-line reduction: a row/column's cells for one value are confined to a single box — eliminate it from the rest of that box outside the row/column. */
function applyBoxLineReduction(candidates: Candidates, config: BoardConfig): boolean {
  let changed = false;
  const boxes = getBoxes(config);
  const boxOf = (r: number, c: number) =>
    boxes.findIndex((box) => box.some(([br, bc]) => br === r && bc === c));

  for (const line of [...getRows(config), ...getCols(config)]) {
    for (let value = 1; value <= config.size; value++) {
      const cells = cellsWithCandidate(line, candidates, value);
      if (cells.length < 2) continue;
      const boxIdx = boxOf(cells[0][0], cells[0][1]);
      if (!cells.every(([r, c]) => boxOf(r, c) === boxIdx)) continue;
      for (const cell of boxes[boxIdx]) {
        if (!cells.some((lc) => sameCell(lc, cell))) {
          if (removeCandidate(candidates, cell, value)) changed = true;
        }
      }
    }
  }
  return changed;
}

function sortedKey(values: number[]): string {
  return values.slice().sort((a, b) => a - b).join(",");
}

/** Naked pairs/triples: N cells in a unit whose candidates are exactly the same N values — eliminate those values from the rest of the unit. */
function applyNakedSubsets(candidates: Candidates, config: BoardConfig, subsetSize: 2 | 3): boolean {
  let changed = false;
  for (const unit of getUnits(config)) {
    const withFew = unit.filter(
      ([r, c]) => candidates[r][c].length >= 2 && candidates[r][c].length <= subsetSize,
    );
    for (let i = 0; i < withFew.length; i++) {
      const group = [withFew[i]];
      const union = new Set(candidates[withFew[i][0]][withFew[i][1]]);
      for (let j = 0; j < withFew.length; j++) {
        if (j === i) continue;
        const [r, c] = withFew[j];
        const next = new Set([...union, ...candidates[r][c]]);
        if (next.size <= subsetSize) {
          union.clear();
          next.forEach((v) => union.add(v));
          group.push(withFew[j]);
        }
      }
      if (group.length === subsetSize && union.size === subsetSize) {
        for (const [r, c] of unit) {
          if (group.some((g) => sameCell(g, [r, c]))) continue;
          for (const value of union) {
            if (removeCandidate(candidates, [r, c], value)) changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/** Hidden pairs: exactly two values in a unit are confined to the same two cells — reduce those cells to just those two values. */
function applyHiddenPairs(candidates: Candidates, config: BoardConfig): boolean {
  let changed = false;
  for (const unit of getUnits(config)) {
    const byValue = new Map<number, Coord[]>();
    for (let value = 1; value <= config.size; value++) {
      const cells = cellsWithCandidate(unit, candidates, value);
      if (cells.length === 2) byValue.set(value, cells);
    }
    const values = [...byValue.keys()];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = byValue.get(values[i])!;
        const b = byValue.get(values[j])!;
        if (sortedKey(a.flat()) !== sortedKey(b.flat())) continue;
        if (!(sameCell(a[0], b[0]) || sameCell(a[0], b[1]))) continue;
        for (const [r, c] of a) {
          const kept = [values[i], values[j]];
          const before = candidates[r][c].length;
          candidates[r][c] = candidates[r][c].filter((v) => kept.includes(v));
          if (candidates[r][c].length !== before) changed = true;
        }
      }
    }
  }
  return changed;
}

interface Placement {
  row: number;
  col: number;
  value: number;
}

function findNakedSingles(grid: Grid, candidates: Candidates, config: BoardConfig): Placement[] {
  const placements: Placement[] = [];
  for (let r = 0; r < config.size; r++) {
    for (let c = 0; c < config.size; c++) {
      if (grid[r][c] === 0 && candidates[r][c].length === 1) {
        placements.push({ row: r, col: c, value: candidates[r][c][0] });
      }
    }
  }
  return placements;
}

function findHiddenSingles(grid: Grid, candidates: Candidates, config: BoardConfig): Placement[] {
  const found = new Map<string, Placement>();
  for (const unit of getUnits(config)) {
    for (let value = 1; value <= config.size; value++) {
      const cells = unit.filter(([r, c]) => grid[r][c] === 0 && candidates[r][c].includes(value));
      if (cells.length === 1) {
        const [row, col] = cells[0];
        found.set(`${row},${col}`, { row, col, value });
      }
    }
  }
  return [...found.values()];
}

/** Grades a (not necessarily solved) puzzle by the hardest human technique its solution requires. */
export function gradeDifficulty(puzzle: Grid, config: BoardConfig): DifficultyTier {
  const grid = cloneGrid(puzzle);
  let tier: DifficultyTier = "easy";

  while (!isFull(grid)) {
    const candidates = computeCandidates(grid, config);
    let usedElimination = false;
    let placements: Placement[] = [];

    for (;;) {
      placements = findNakedSingles(grid, candidates, config);
      if (placements.length > 0) break;

      placements = findHiddenSingles(grid, candidates, config);
      if (placements.length > 0) break;

      const eliminated =
        applyPointingPairs(candidates, config) ||
        applyBoxLineReduction(candidates, config) ||
        applyNakedSubsets(candidates, config, 2) ||
        applyHiddenPairs(candidates, config) ||
        applyNakedSubsets(candidates, config, 3);

      if (!eliminated) return "hard"; // stuck: would need to guess/backtrack
      usedElimination = true;
    }

    for (const { row, col, value } of placements) grid[row][col] = value;
    if (usedElimination && tier === "easy") tier = "medium";
  }

  return tier;
}
