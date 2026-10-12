import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "states",
  title: "States",
  order: 14,
  tagline: "Guess the Indian state or UT from its silhouette",
  hubAccent: "#be6d37",
  font: "Poppins",
  howTo: {
    rules: "A silhouette of one of India's 28 states or 8 union territories is shown. Guess which one in 6 tries.",
    steps: [
      "Each guess shows how far away it is, which direction the answer lies, and how close that is.",
      "Renamed states work too — try the old name if you're not sure of the new one (e.g. Orissa).",
    ],
  },
};
