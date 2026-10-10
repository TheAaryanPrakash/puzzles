import type { AlreadyPlayedProps } from "./types";
import type { PlayStatus } from "../lib/data/types";

const MESSAGE: Record<PlayStatus, string> = {
  won: "You already played this one — and won!",
  lost: "You already played this one.",
  in_progress: "You have an unfinished play — pick up where you left off.",
};

export function AlreadyPlayed({ status, message, children }: AlreadyPlayedProps) {
  return (
    <div className="rounded-brand-md bg-game-surface-2 p-4 text-sm text-game-fg">
      <p>{message ?? MESSAGE[status]}</p>
      {children}
    </div>
  );
}
