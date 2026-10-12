import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "mini",
  title: "Mini Crossword",
  order: 7,
  tagline: "A tiny crossword, fresh every day",
  // Redesign (2026-10): the old #2a2420 was a dark charcoal meant to sit on a light card — on the
  // new near-black Hub tiles it was ~1.2:1 against the card, i.e. invisible (both the top accent
  // bar and the tile icon, which renders in this colour). Parchment/paper tone, matching the
  // approved "sudoku given" swatch (docs/redesign/checkpoint-1/colors.png) — fits Mini's own
  // crossword-paper theme.css palette and reads clearly on black.
  hubAccent: "#d4c4c9",
  font: "Libre Franklin",
};
