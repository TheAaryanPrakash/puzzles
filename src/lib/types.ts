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
  /**
   * Content for the shared HowToPlayModal (redesign, 2026-10 — see docs/redesign/). Optional so a
   * game can go live before its content is written; the modal renders whatever's present. Plain
   * strings only (meta.ts files are .ts, not .tsx — no JSX here); the modal does all the layout.
   * `steps` items may start with an emoji (e.g. "🟩 ...") as an inline colour legend — several
   * games' own share-text already uses the same emoji vocabulary for spoiler-free result grids, so
   * reusing it here needs no new visual language.
   */
  howTo?: {
    /** 1-3 sentence overview. */
    rules: string;
    /** Bullet list of mechanics/rules beyond the overview — scoring, feedback colours, controls. */
    steps?: string[];
    /** A small worked example, e.g. one guess and what it reveals. */
    example?: { label: string; detail: string };
  };
}
