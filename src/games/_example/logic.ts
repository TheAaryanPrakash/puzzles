export interface ExamplePuzzle {
  secret: number;
  max: number;
}

export interface ExampleState {
  guesses: number[];
}

/**
 * A freshly-started play's `state` is `{}` (the database's `default '{}'::jsonb`, mirrored by the
 * local adapter) — not yet shaped like ExampleState. Always derive state as
 * `{ ...DEFAULT_STATE, ...play?.state }` rather than `play?.state ?? DEFAULT_STATE`: the latter
 * only falls back when `play` itself is null/undefined, so it still crashes on the empty-but-
 * truthy `{}` a game sees in the render right after `start()` resolves and before its first
 * `save()` lands (every game hits this, not just this one).
 */
export const DEFAULT_STATE: ExampleState = { guesses: [] };

export type GuessFeedback = "correct" | "higher" | "lower";

export const MAX_GUESSES = 4;

export function feedbackFor(guess: number, secret: number): GuessFeedback {
  if (guess === secret) return "correct";
  return guess < secret ? "higher" : "lower";
}

export function isWon(state: ExampleState, secret: number): boolean {
  return state.guesses.includes(secret);
}

export function isLost(state: ExampleState, secret: number): boolean {
  return !isWon(state, secret) && state.guesses.length >= MAX_GUESSES;
}

export function isOver(state: ExampleState, secret: number): boolean {
  return isWon(state, secret) || isLost(state, secret);
}

/** Spoiler-free share text: an emoji grid of up/down/correct, never the secret number itself. */
export function buildSummary(state: ExampleState, secret: number, puzzleNumber: number): string {
  const won = isWon(state, secret);
  const grid = state.guesses
    .map((g) => {
      const f = feedbackFor(g, secret);
      return f === "correct" ? "🟩" : f === "higher" ? "⬆️" : "⬇️";
    })
    .join("");
  return `Example #${puzzleNumber} ${won ? state.guesses.length : "X"}/${MAX_GUESSES}\n${grid}`;
}
