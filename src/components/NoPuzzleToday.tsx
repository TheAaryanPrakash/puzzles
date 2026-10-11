import type { NoPuzzleTodayProps } from "./types";

export function NoPuzzleToday({ gameTitle, message }: NoPuzzleTodayProps) {
  return (
    <div className="rounded-brand-lg border-2 border-dashed border-game-border bg-game-surface-2 px-6 py-10 text-center">
      <p className="text-3xl" aria-hidden>
        🌱
      </p>
      <p className="mt-3 text-sm text-game-muted">
        {message ?? `${gameTitle ?? "This game"} doesn’t have a puzzle today yet. Check back soon!`}
      </p>
    </div>
  );
}
