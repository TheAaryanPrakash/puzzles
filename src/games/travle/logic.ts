export interface TravlePuzzle {
  /** ISO 3166-1 alpha-2 codes. */
  start: string;
  end: string;
  /** Number of countries strictly between start and end on the shortest land route. */
  shortestLength: number;
  allowedGuesses: number;
}

export interface TravleState {
  /** ISO alpha-2 codes, in guess order. Never includes start or end. */
  guesses: string[];
}

/** See DEFAULT_STATE's comment in src/games/_example/logic.ts — same `{}` gotcha applies here. */
export const DEFAULT_STATE: TravleState = { guesses: [] };

export type GuessCategory = "on-path" | "adjacent" | "unconnected";

/**
 * Official travle guess-allowance table: extra guesses beyond the shortest route, keyed by how
 * many intermediate countries that shortest route has. See RESEARCH.md for the source.
 */
export function allowedGuessesFor(shortestLength: number): number {
  const extra =
    shortestLength <= 3 ? 4 : shortestLength <= 6 ? 5 : shortestLength <= 9 ? 6 : shortestLength <= 12 ? 7 : 8;
  return shortestLength + extra;
}

/** Union-Find over a small, fixed set of nodes — plenty for at most ~20 guesses plus start/end. */
class UnionFind {
  private parent = new Map<string, string>();

  add(node: string): void {
    if (!this.parent.has(node)) this.parent.set(node, node);
  }

  find(node: string): string {
    const parent = this.parent.get(node);
    if (parent === undefined || parent === node) return node;
    const root = this.find(parent);
    this.parent.set(node, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }
}

/** Builds the induced subgraph on {start, end, ...guesses} using the real adjacency graph. */
function inducedComponents(
  nodes: string[],
  adjacency: Record<string, string[]>,
): UnionFind {
  const uf = new UnionFind();
  for (const node of nodes) uf.add(node);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (adjacency[nodes[i]]?.includes(nodes[j])) uf.union(nodes[i], nodes[j]);
    }
  }
  return uf;
}

/** Start and end are connected through a gapless chain of correctly-guessed, adjacent countries. */
export function isWon(
  state: TravleState,
  puzzle: TravlePuzzle,
  adjacency: Record<string, string[]>,
): boolean {
  const nodes = [puzzle.start, puzzle.end, ...state.guesses];
  const uf = inducedComponents(nodes, adjacency);
  return uf.connected(puzzle.start, puzzle.end);
}

export function isLost(
  state: TravleState,
  puzzle: TravlePuzzle,
  adjacency: Record<string, string[]>,
): boolean {
  return !isWon(state, puzzle, adjacency) && state.guesses.length >= puzzle.allowedGuesses;
}

export function isOver(
  state: TravleState,
  puzzle: TravlePuzzle,
  adjacency: Record<string, string[]>,
): boolean {
  return isWon(state, puzzle, adjacency) || isLost(state, puzzle, adjacency);
}

/**
 * Per-guess colour category, for the map and the guess list:
 * - "on-path": in the same connected component as start or end (anchored, real progress).
 * - "adjacent": borders some other guess, but that little island isn't anchored to either end yet.
 * - "unconnected": borders nothing guessed so far.
 */
export function classifyGuesses(
  state: TravleState,
  puzzle: TravlePuzzle,
  adjacency: Record<string, string[]>,
): Record<string, GuessCategory> {
  const nodes = [puzzle.start, puzzle.end, ...state.guesses];
  const uf = inducedComponents(nodes, adjacency);
  const startRoot = uf.find(puzzle.start);
  const endRoot = uf.find(puzzle.end);

  const result: Record<string, GuessCategory> = {};
  for (const guess of state.guesses) {
    const root = uf.find(guess);
    if (root === startRoot || root === endRoot) {
      result[guess] = "on-path";
    } else if (adjacency[guess]?.some((n) => nodes.includes(n) && n !== guess)) {
      result[guess] = "adjacent";
    } else {
      result[guess] = "unconnected";
    }
  }
  return result;
}

export type GuessRejectReason = "duplicate" | "is-endpoint" | "unknown-country";

/** Validates a resolved guess (already matched to an iso_a2 code) before it's added to state. */
export function rejectReasonFor(
  code: string | null,
  state: TravleState,
  puzzle: TravlePuzzle,
): GuessRejectReason | null {
  if (code === null) return "unknown-country";
  if (code === puzzle.start || code === puzzle.end) return "is-endpoint";
  if (state.guesses.includes(code)) return "duplicate";
  return null;
}

/** Case-insensitive match against a country's canonical name or any alias. Returns its iso_a2, or null. */
export function resolveCountryName(
  input: string,
  countryNames: Record<string, { name: string; aliases: string[] }>,
): string | null {
  const needle = input.trim().toLowerCase();
  if (!needle) return null;
  for (const [code, entry] of Object.entries(countryNames)) {
    if (entry.name.toLowerCase() === needle) return code;
    if (entry.aliases.some((alias) => alias.toLowerCase() === needle)) return code;
  }
  return null;
}

/** Regional-indicator flag emoji from an iso_a2 code — e.g. "FR" -> 🇫🇷. Start/end aren't spoilers. */
export function flagEmoji(iso_a2: string): string {
  const codePoints = [...iso_a2.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const CATEGORY_EMOJI: Record<GuessCategory, string> = {
  "on-path": "🟩",
  adjacent: "🟧",
  unconnected: "🟥",
};

/**
 * Spoiler-free share text: puzzle number, start/end flags (already visible on screen, not a
 * spoiler), win/loss, guess count, and a colour grid — never a guessed country's name or code.
 */
export function buildSummary(
  state: TravleState,
  puzzle: TravlePuzzle,
  adjacency: Record<string, string[]>,
  puzzleNumber: number,
): string {
  const won = isWon(state, puzzle, adjacency);
  const categories = classifyGuesses(state, puzzle, adjacency);
  const grid = state.guesses.map((g) => CATEGORY_EMOJI[categories[g]]).join("");
  const route = `${flagEmoji(puzzle.start)} ➜ ${flagEmoji(puzzle.end)}`;
  const resultLine = won
    ? `${state.guesses.length}/${puzzle.allowedGuesses} — ${
        state.guesses.length === puzzle.shortestLength ? "Perfect route!" : `+${state.guesses.length - puzzle.shortestLength}`
      }`
    : `X/${puzzle.allowedGuesses}`;
  return `Travle #${puzzleNumber} ${route}\n${resultLine}\n${grid}`;
}
