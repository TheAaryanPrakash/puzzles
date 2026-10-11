import type { AlreadyPlayedProps } from "./types";
import type { PlayStatus } from "../lib/data/types";

const MESSAGE: Record<PlayStatus, string> = {
  won: "You already played this one, and won!",
  lost: "You already played this one.",
  in_progress: "You have an unfinished play. Pick up where you left off.",
};

const GLYPH: Record<PlayStatus, string> = { won: "🎉", lost: "👋", in_progress: "⏳" };

export function AlreadyPlayed({ status, message, children }: AlreadyPlayedProps) {
  return (
    <div className="flex items-start gap-3 rounded-brand-md bg-game-surface-2 p-4 text-sm text-game-fg">
      <span className="text-xl" aria-hidden>
        {GLYPH[status]}
      </span>
      <div className="flex-1">
        <p>{message ?? MESSAGE[status]}</p>
        {children}
      </div>
    </div>
  );
}
