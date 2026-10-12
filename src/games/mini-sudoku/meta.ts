import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "mini-sudoku",
  title: "Mini Sudoku",
  order: 6,
  tagline: "A pocket-sized sudoku — 6x6, every row, column and box 1 to 6",
  hubAccent: "#9b3b7b",
  font: "Nunito",
  howTo: {
    rules: "Fill the grid so every row, column and 2×3 box contains 1–6 exactly once. Select a cell, then enter a digit with the number pad or your keyboard.",
    steps: [
      "Notes — toggle on (or press N) to pencil in candidates instead of a final answer.",
      "Check mistakes — highlights any cell that repeats a digit in its row, column or box.",
      "Undo (or Ctrl/⌘+Z) steps back one move; Backspace erases the selected cell.",
      "Arrow keys move the selection; the timer keeps running until the grid is solved.",
    ],
  },
};
