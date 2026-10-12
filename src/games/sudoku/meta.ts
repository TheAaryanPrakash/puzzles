import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "sudoku",
  title: "Sudoku",
  order: 5,
  tagline: "Fill the grid — every row, column and box, 1 to 9",
  hubAccent: "#324b85",
  font: "Source Serif 4",
  howTo: {
    rules: "Fill the grid so every row, column and 3×3 box contains 1–9 exactly once. Select a cell, then enter a digit with the number pad or your keyboard.",
    steps: [
      "Notes — toggle on (or press N) to pencil in candidates instead of a final answer.",
      "Check mistakes — highlights any cell that repeats a digit in its row, column or box.",
      "Undo (or Ctrl/⌘+Z) steps back one move; Backspace erases the selected cell.",
      "Arrow keys move the selection; the timer keeps running until the grid is solved.",
    ],
  },
};
