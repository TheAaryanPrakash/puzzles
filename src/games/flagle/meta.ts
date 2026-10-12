import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "flagle",
  title: "Flagle",
  order: 10,
  tagline: "Guess the flag, one tile at a time",
  hubAccent: "#3b6ea5",
  font: "Inter",
  howTo: {
    rules: "Guess today's flag in 6 tries. The flag starts almost entirely covered — every wrong guess lifts one more tile.",
    steps: [
      "Type a country's name (or its ISO code) and pick it from the list.",
      "Each guess shows how far away it was, which direction to go, and a closeness percentage — just like Worldle.",
    ],
  },
};
