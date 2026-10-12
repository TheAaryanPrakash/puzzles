import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "quordle",
  title: "Quordle",
  order: 2,
  tagline: "Four Wordles, nine shared guesses",
  hubAccent: "#5144a7",
  font: "Libre Franklin",
  howTo: {
    rules: "Solve all four boards before you run out of guesses.",
    steps: [
      "You get 9 guesses total, shared across all four boards — every word you submit is checked against all four answers at once.",
      "A solved board dims and shows which guess cracked it; the rest keep going.",
      "🟩 Correct spot · 🟨 Wrong spot · ⬜ Not in the word — same tile language as Wordle.",
      "The keyboard splits each key into four quadrants, one per board, so you can see what you know for every board at a glance.",
    ],
  },
};
