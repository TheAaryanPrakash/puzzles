// The backend agent builds this against the frozen DataSource interface (see prompts/backend.md).
import type { DataSource, Play, PlayStatus } from "./types";

function notImplemented(): never {
  throw new Error("supabase data source not implemented yet — see prompts/backend.md");
}

export const supabaseDataSource: DataSource = {
  getPuzzle<T>(): Promise<{ main: T; reserve?: T } | null> {
    notImplemented();
  },
  getPlay<S>(): Promise<Play<S> | null> {
    notImplemented();
  },
  startPlay(): Promise<Play> {
    notImplemented();
  },
  savePlay(): Promise<void> {
    notImplemented();
  },
  finishPlay(): Promise<void> {
    notImplemented();
  },
  getStats(): Promise<
    Record<string, { played: number; won: number; currentStreak: number; maxStreak: number }>
  > {
    notImplemented();
  },
  getFriendsResults(): Promise<
    { name: string; status: PlayStatus; summary: string; score?: number }[]
  > {
    notImplemented();
  },
  listPlays(): Promise<{ date: string; status: PlayStatus; score?: number }[]> {
    notImplemented();
  },
};
