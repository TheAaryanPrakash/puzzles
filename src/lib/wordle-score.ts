export type LetterState = "correct" | "present" | "absent";

/**
 * Classic two-pass Wordle scoring: greens are marked first, then yellows are assigned against
 * the answer's remaining (non-green) letter counts, so a repeated guessed letter is never
 * marked "present" more times than it actually occurs in the answer.
 */
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const len = a.length;
  const result: LetterState[] = new Array(len).fill("absent");
  const remaining = new Map<string, number>();

  for (let i = 0; i < len; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < len; i++) {
    if (result[i] === "correct") continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      result[i] = "present";
      remaining.set(g[i], left - 1);
    }
  }

  return result;
}
