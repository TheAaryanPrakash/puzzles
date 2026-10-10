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
}
