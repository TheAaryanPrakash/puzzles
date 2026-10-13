import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "connections",
  title: "Connections",
  order: 6,
  tagline: "Group the sixteen words into four",
  hubAccent: "#c8a641",
  font: "Libre Franklin",
  howTo: {
    rules: "Find groups of four words that share something in common. Select four words and hit Submit.",
    steps: [
      "Categories range from straightforward (rose) to tricky (gold) — a word can look like it fits more than one group, so watch for the trap.",
      "\"One away…\" means three of your four words belong together, but one doesn't.",
      "You have 4 mistakes before the game ends — get it wrong a 4th time and the rest of the board is revealed.",
      "Shuffle mixes up the remaining words if the grid gets hard to read.",
    ],
  },
};
