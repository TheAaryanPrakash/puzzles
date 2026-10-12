import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "worldle",
  title: "Worldle",
  order: 9,
  tagline: "Guess the country from its silhouette",
  hubAccent: "#2b735b",
  font: "Inter",
  howTo: {
    rules: "Guess the country from its silhouette in 6 tries. Type into the box and pick a match — nicknames and common aliases work too (e.g. \"UAE\", \"America\").",
    steps: [
      "Every wrong guess tells you the distance to the answer, the direction (a compass arrow), and a proximity % — 100% is exact, 0% is the farthest two places on Earth can be from each other.",
    ],
  },
};
