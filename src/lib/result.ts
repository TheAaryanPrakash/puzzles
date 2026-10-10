import type { DataSource } from "./data/types";
import { celebrate } from "./celebrate";

export interface GameResult {
  won: boolean;
  state: unknown;
  summary: string;
  score?: number;
}

/** What every game's `finish()` ultimately calls: persist the final play, then celebrate a win. */
export async function completeGame(
  dataSource: DataSource,
  gameId: string,
  date: string,
  result: GameResult,
): Promise<void> {
  await dataSource.finishPlay(gameId, date, result);
  if (result.won) celebrate();
}
