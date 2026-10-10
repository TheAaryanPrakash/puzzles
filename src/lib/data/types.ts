// FROZEN — see CLAUDE.md "Data layer". Only the human changes this file.

export type PlayStatus = "in_progress" | "won" | "lost";

export interface Play<S = unknown> {
  gameId: string;
  date: string;
  variant: "main" | "reserve";
  status: PlayStatus;
  state: S;
  summary?: string;
  score?: number;
}

export interface DataSource {
  getPuzzle<T>(gameId: string, date: string): Promise<{ main: T; reserve?: T } | null>; // null = missing or not released
  getPlay<S>(gameId: string, date: string): Promise<Play<S> | null>;
  startPlay(gameId: string, date: string, variant?: "main" | "reserve"): Promise<Play>;
  savePlay<S>(
    gameId: string,
    date: string,
    patch: Partial<Pick<Play<S>, "state" | "variant">>,
  ): Promise<void>;
  finishPlay(
    gameId: string,
    date: string,
    result: { won: boolean; state: unknown; summary: string; score?: number },
  ): Promise<void>;
  getStats(): Promise<
    Record<string, { played: number; won: number; currentStreak: number; maxStreak: number }>
  >;
  getFriendsResults(
    gameId: string,
    date: string,
  ): Promise<{ name: string; status: PlayStatus; summary: string; score?: number }[]>;
}
