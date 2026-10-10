import type { GameMeta } from "../../lib/types";

// Ids starting with "_" are hidden from the Hub in production (see src/routes.tsx) — this game
// exists only to demonstrate the contract every real game follows.
export const meta: GameMeta = {
  id: "_example",
  title: "Example",
  order: 0,
  tagline: "Guess the number — demonstrates the game contract",
  hubAccent: "#8a7f70",
  font: "Inter",
};
