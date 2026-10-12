import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "zip",
  title: "Zip",
  order: 9,
  tagline: "Draw one path through every cell, in order",
  hubAccent: "#e7a540",
  font: "Nunito",
  howTo: {
    rules: "Draw one continuous path that visits every cell in the grid exactly once. Start at cell 1, pass through every other numbered checkpoint in order, and end on the highest number.",
    steps: [
      "Drag across cells to draw; drag back over your own path to retract it.",
      "Arrow keys extend the path one step; Backspace undoes the last step.",
      "Some boards have walls — the path can never cross one, even between adjacent cells.",
      "The path can't cross or revisit a cell.",
    ],
  },
};
