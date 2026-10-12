import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "globle",
  title: "Globle",
  order: 11,
  tagline: "Guess the country, one border-distance at a time",
  hubAccent: "#e46772",
  font: "Space Grotesk",
  howTo: {
    rules: "A new country is hidden every day — everyone sees the same one. Guess any country to start narrowing it down.",
    steps: [
      "The globe colours each guess by how close its border is to the secret country's border — dark and muted for far, bright coral for close. Two countries that share a land border always score as close as it gets.",
      "Unlimited guesses. Keep going until you find it — your closest guess so far is tracked below.",
    ],
  },
};
