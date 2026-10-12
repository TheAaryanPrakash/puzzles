import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "bee",
  title: "Spelling Bee",
  order: 3,
  tagline: "Find words that use the center letter",
  hubAccent: "#ebca47",
  font: "Libre Franklin",
  howTo: {
    rules: "Make words of at least 4 letters using the 7 letters in the hive. Every word must include the center letter. Letters can repeat.",
    steps: [
      "4-letter words are worth 1 point; longer words are worth 1 point per letter.",
      "A pangram — a word using all 7 letters — earns a +7 point bonus.",
      "Reach Genius to win the day. Find every word to become Queen Bee.",
    ],
  },
};
