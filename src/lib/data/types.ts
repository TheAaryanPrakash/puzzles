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

/** The birthday finale's content — see `messages.content` in supabase/migrations/0001_init.sql.
 *  `photos`/`video` are paths within the private "finale" Storage bucket, under the recipient's
 *  own user-id folder (`<user_id>/<file>`) — never public URLs. */
export interface FinaleMessage {
  title: string;
  body: string;
  photos: string[];
  video: string | null;
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
  listPlays(gameId: string): Promise<{ date: string; status: PlayStatus; score?: number }[]>;
  /** Null until the signed-in member is the message's recipient, it's `unlock_date`, and they've
   *  finished `required_games` different games that day — all enforced server-side, not just here. */
  getMessage(): Promise<FinaleMessage | null>;
}
