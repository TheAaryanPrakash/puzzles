export type Operator = "+" | "-" | "*" | "/";

export const OPERATORS: Operator[] = ["+", "-", "*", "/"];

export const ROUNDS_PER_DAY = 5;

export interface DigitsRound {
  numbers: number[]; // the 6 starting numbers for this round
  target: number;
  /** Fewest merges needed to reach `target` exactly, computed by the generator's solver. */
  minSteps: number;
}

export interface DigitsPuzzle {
  rounds: DigitsRound[]; // length ROUNDS_PER_DAY
}

/** One merge: `a op b = result`, all plain values (not tile ids) — see RESEARCH.md "Game design". */
export interface Step {
  a: number;
  b: number;
  op: Operator;
  result: number;
}

export interface RoundState {
  steps: Step[];
  submitted: boolean;
}

export interface DigitsState {
  rounds: RoundState[]; // length ROUNDS_PER_DAY, index-aligned with puzzle.rounds
}

/**
 * A freshly-started play's `state` is `{}` (the database's `default '{}'::jsonb`, mirrored by the
 * local adapter) — not yet shaped like DigitsState. Always derive state as
 * `{ ...DEFAULT_STATE, ...play?.state }` rather than `play?.state ?? DEFAULT_STATE`, or the page
 * crashes on that empty-but-truthy `{}` right after `start()` resolves.
 */
export const DEFAULT_STATE: DigitsState = {
  rounds: Array.from({ length: ROUNDS_PER_DAY }, () => ({ steps: [], submitted: false })),
};

export type Stars = 0 | 1 | 2 | 3;

// ─────────────────────────── applying / replaying steps ───────────────────────────

/** Computes `a op b`, or `undefined` if the op is undefined, not a positive integer, or illegal. */
export function evalOp(a: number, b: number, op: Operator): number | undefined {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a > b ? a - b : undefined; // must stay positive
    case "*":
      return a * b;
    case "/":
      return b !== 0 && a % b === 0 ? a / b : undefined; // must be exact
  }
}

/**
 * Removes one instance of `value` from `pool` (by value, not identity — see RESEARCH.md: any
 * matching instance gives the same resulting multiset). Returns `undefined` if absent.
 */
function removeOne(pool: number[], value: number): number[] | undefined {
  const i = pool.indexOf(value);
  if (i === -1) return undefined;
  return [...pool.slice(0, i), ...pool.slice(i + 1)];
}

/** Applies one step to a pool of numbers, returning the new pool, or `undefined` if illegal. */
export function applyStep(pool: number[], step: Step): number[] | undefined {
  const expected = evalOp(step.a, step.b, step.op);
  if (expected === undefined || expected !== step.result) return undefined;
  const afterA = removeOne(pool, step.a);
  if (!afterA) return undefined;
  const afterB = removeOne(afterA, step.b);
  if (!afterB) return undefined;
  return [...afterB, step.result];
}

/** Replays every step from the round's original numbers. `undefined` if any step is illegal. */
export function poolAfterSteps(numbers: number[], steps: Step[]): number[] | undefined {
  let pool = [...numbers];
  for (const step of steps) {
    const next = applyStep(pool, step);
    if (!next) return undefined;
    pool = next;
  }
  return pool;
}

// ─────────────────────────── scoring ───────────────────────────

export function starsFor(diff: number): Stars {
  if (diff === 0) return 3;
  if (diff <= 10) return 2;
  if (diff <= 25) return 1;
  return 0;
}

export interface RoundScore {
  closest: number;
  diff: number;
  stars: Stars;
}

/** The closest-to-target number currently on the board, and the stars it earns. */
export function scoreRound(round: DigitsRound, state: RoundState): RoundScore {
  const pool = poolAfterSteps(round.numbers, state.steps) ?? round.numbers;
  let closest = pool[0];
  let diff = Math.abs(closest - round.target);
  for (const n of pool) {
    const d = Math.abs(n - round.target);
    if (d < diff) {
      closest = n;
      diff = d;
    }
  }
  return { closest, diff, stars: starsFor(diff) };
}

export function isRoundOver(state: RoundState): boolean {
  return state.submitted;
}

export function totalStars(puzzle: DigitsPuzzle, state: DigitsState): number {
  return puzzle.rounds.reduce((sum, round, i) => {
    const r = state.rounds[i];
    if (!r?.submitted) return sum;
    return sum + scoreRound(round, r).stars;
  }, 0);
}

/** Won = every round has been submitted with at least 1 star. */
export function isWon(puzzle: DigitsPuzzle, state: DigitsState): boolean {
  return puzzle.rounds.every((round, i) => {
    const r = state.rounds[i];
    return r?.submitted && scoreRound(round, r).stars >= 1;
  });
}

export function isGameOver(state: DigitsState): boolean {
  return state.rounds.every((r) => r.submitted);
}

// ─────────────────────────── mutations (undo / reset / submit) ───────────────────────────

export function addStep(state: DigitsState, roundIndex: number, step: Step): DigitsState {
  const round = state.rounds[roundIndex];
  if (round.submitted) return state;
  const rounds = state.rounds.slice();
  rounds[roundIndex] = { ...round, steps: [...round.steps, step] };
  return { ...state, rounds };
}

export function undoStep(state: DigitsState, roundIndex: number): DigitsState {
  const round = state.rounds[roundIndex];
  if (round.submitted || round.steps.length === 0) return state;
  const rounds = state.rounds.slice();
  rounds[roundIndex] = { ...round, steps: round.steps.slice(0, -1) };
  return { ...state, rounds };
}

export function resetRound(state: DigitsState, roundIndex: number): DigitsState {
  const round = state.rounds[roundIndex];
  if (round.submitted) return state;
  const rounds = state.rounds.slice();
  rounds[roundIndex] = { ...round, steps: [] };
  return { ...state, rounds };
}

export function submitRound(state: DigitsState, roundIndex: number): DigitsState {
  const round = state.rounds[roundIndex];
  if (round.submitted) return state;
  const rounds = state.rounds.slice();
  rounds[roundIndex] = { ...round, submitted: true };
  return { ...state, rounds };
}

// ─────────────────────────── solver (used by the generator) ───────────────────────────

/**
 * Generate-and-test brute force over every way to combine a multiset of numbers down to one
 * value, following Graham Hutton's "Countdown Problem" functional pearl (see RESEARCH.md) —
 * split the current multiset into every non-empty/non-empty partition, solve each half
 * recursively, then combine every pair of results with every legal operator. Memoized per
 * distinct sorted sub-multiset so repeated splits aren't re-solved.
 *
 * Returns, for every reachable exact value, the minimum number of merges needed to reach it.
 */
function allResults(numbers: number[], cache: Map<string, Map<number, number>>): Map<number, number> {
  const key = numbers.slice().sort((a, b) => a - b).join(",");
  const cached = cache.get(key);
  if (cached) return cached;

  const results = new Map<number, number>();
  const record = (value: number, steps: number) => {
    const prev = results.get(value);
    if (prev === undefined || steps < prev) results.set(value, steps);
  };

  if (numbers.length === 1) {
    record(numbers[0], 0);
    cache.set(key, results);
    return results;
  }

  // Every way to split the (index) positions into two non-empty subsets, left/right order
  // doesn't matter for the split itself (we try both operand orders below).
  const n = numbers.length;
  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) left.push(numbers[i]);
      else right.push(numbers[i]);
    }
    if (left.length === 0 || right.length === 0 || left.length > right.length) continue; // avoid L/R dupes

    const leftResults = allResults(left, cache);
    const rightResults = allResults(right, cache);
    for (const [lv, lSteps] of leftResults) {
      for (const [rv, rSteps] of rightResults) {
        for (const op of OPERATORS) {
          if ((op === "*" || op === "/") && (lv === 1 || rv === 1)) continue; // no-op moves
          const a = lv >= rv ? lv : rv;
          const b = lv >= rv ? rv : lv;
          const value = evalOp(a, b, op);
          if (value === undefined) continue;
          if (op === "+" || op === "*") {
            record(value, lSteps + rSteps + 1);
          } else {
            // subtraction/division are order-sensitive; `a` (the larger) must be the minuend/
            // dividend for the result to stay a positive integer, so there's only one order to try.
            record(value, lSteps + rSteps + 1);
          }
        }
      }
    }
  }

  cache.set(key, results);
  return results;
}

/** Fewest merges to reach `target` exactly from `numbers` (any subset, each used at most once). */
export function minStepsTo(numbers: number[], target: number): number | undefined {
  const cache = new Map<string, Map<number, number>>();
  let best: number | undefined;
  const n = numbers.length;
  // Try every non-empty subset of the numbers (a solution needn't use all of them).
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: number[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(numbers[i]);
    const results = allResults(subset, cache);
    const steps = results.get(target);
    if (steps !== undefined && (best === undefined || steps < best)) best = steps;
  }
  return best;
}

/** True if `target` is reachable by combining exactly two of `numbers` in a single operation. */
export function reachableInOneStep(numbers: number[], target: number): boolean {
  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const a = Math.max(numbers[i], numbers[j]);
      const b = Math.min(numbers[i], numbers[j]);
      for (const op of OPERATORS) {
        if (evalOp(a, b, op) === target) return true;
      }
    }
  }
  return false;
}

// ─────────────────────────── spoiler-free summary ───────────────────────────

const STAR_GLYPHS: Record<Stars, string> = { 0: "⬛", 1: "⭐", 2: "⭐⭐", 3: "⭐⭐⭐" };

/** Spoiler-free share text: stars per round only — never the numbers, target, or any step. */
export function buildSummary(puzzle: DigitsPuzzle, state: DigitsState, puzzleNumber: number): string {
  const line = puzzle.rounds
    .map((round, i) => {
      const r = state.rounds[i];
      if (!r?.submitted) return "⬛";
      return STAR_GLYPHS[scoreRound(round, r).stars];
    })
    .join(" ");
  const stars = totalStars(puzzle, state);
  return `Digits #${puzzleNumber} ${stars}/${ROUNDS_PER_DAY * 3} stars\n${line}`;
}
