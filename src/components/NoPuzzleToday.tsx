import type { NoPuzzleTodayProps } from "./types";

export function NoPuzzleToday({ gameTitle, message }: NoPuzzleTodayProps) {
  return (
    <div className="rounded-brand-md border border-dashed border-game-border p-6 text-center text-game-muted">
      <p>{message ?? `${gameTitle ?? "This game"} doesn't have a puzzle today yet.`}</p>
    </div>
  );
}
