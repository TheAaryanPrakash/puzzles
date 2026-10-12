/** Shared score formatter for every "fewest guesses wins" game's friends board. */
export function formatGuesses(n: number): string {
  return `${n} ${n === 1 ? "guess" : "guesses"}`;
}
