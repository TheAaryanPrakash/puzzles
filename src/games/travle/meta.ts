import type { GameMeta } from "../../lib/types";

export const meta: GameMeta = {
  id: "travle",
  title: "Travle",
  order: 12,
  tagline: "Chart a land route from one country to another",
  hubAccent: "#356e82",
  font: "Inter",
  howTo: {
    rules: "Get from the start country to the end country by naming every country you'd pass through, in order, travelling by land.",
    steps: [
      "🟢 Green: part of a connected chain back to the start or the end.",
      "🟡 Gold: borders another guess but isn't linked up to either end yet.",
      "⚫ Grey: not connected to anything you've guessed so far.",
    ],
    example: {
      label: "Win condition",
      detail: "You win once the start and end are joined by one complete chain — within your guess allowance.",
    },
  },
};
