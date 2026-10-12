export interface GameMeta {
  /** Also the folder name under src/games/, and the `data-game` theme attribute. */
  id: string;
  title: string;
  /** Position on the Hub. */
  order: number;
  tagline: string;
  /** Hex color shown on the Hub card. */
  hubAccent: string;
  /** @fontsource family name this game's theme.css loads, e.g. "Libre Franklin". */
  font: string;
  /** Whether this game counts toward the Hub's daily total, streaks, stats, the leaderboard and
   *  the Finale's required-games check. Defaults to `true` by absence — every daily puzzle game
   *  leaves this unset. Chess is the one exception (`scored: false`): it's playable anytime, not a
   *  daily puzzle, and never writes a Play at all, so nothing here needs the DataSource to agree —
   *  see routes.tsx's `scoredGameMetas` and CLAUDE.md's "Chess" section. */
  scored?: boolean;
}
