import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "wordle",
  title: "Wordle",
  order: 1,
  tagline: "Guess the word in 6 tries",
  hubAccent: "#367846",
  font: "Libre Franklin",
  howTo: {
    rules: "Guess the word in 6 tries. Each guess must be a real 5-letter word. Press Enter to submit.",
    steps: [
      "🟩 The letter is in the word and in the correct spot.",
      "🟨 The letter is in the word but in the wrong spot.",
      "⬜ The letter is not in the word in any spot.",
      "Hard Mode: any revealed hint must be used in later guesses — a correct letter stays in its spot, and a letter known to be in the word must appear again somewhere. Turn it on before your first guess; it's locked in for the rest of the puzzle.",
    ],
    example: { label: "Every day", detail: "A new puzzle arrives every day. Everyone gets the same word." },
  },
};
