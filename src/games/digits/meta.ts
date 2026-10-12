import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "digits",
  title: "Digits",
  order: 5,
  tagline: "Hit the target with + − × ÷",
  hubAccent: "#9c581c",
  font: "Libre Franklin",
  howTo: {
    rules: "Each day has 5 rounds. Every round gives you 6 numbers and a target. Tap a number, an operator (+ − × ÷), then a second number to merge them into one new number — you don't have to use every number.",
    steps: [
      "Every result along the way must be a positive whole number — no fractions, no negatives.",
      "When you submit a round, the number on the board closest to the target decides your stars: hit it exactly for ⭐⭐⭐, within 10 for ⭐⭐, within 25 for ⭐.",
      "You win the day with at least one star in every round.",
      "Use Undo to take back your last merge, or Reset round to start the round over.",
    ],
  },
};
