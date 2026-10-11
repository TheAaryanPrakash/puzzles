import { useFriendsResults } from "../lib/hooks";
import type { FriendsBoardProps } from "./types";

const STATUS_GLYPH: Record<string, string> = { won: "✅", lost: "❌", in_progress: "⏳" };

export function FriendsBoard({
  gameId,
  date,
  renderEntry,
  emptyMessage = "No one else has finished yet.",
}: FriendsBoardProps) {
  const { results, loading } = useFriendsResults(gameId, date);

  if (loading) return null;
  if (results.length === 0) {
    return (
      <p className="rounded-brand-md bg-game-surface-2 px-3 py-4 text-center text-sm text-game-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-game-border overflow-hidden rounded-brand-md border border-game-border">
      {results.map((entry) =>
        renderEntry ? (
          <li key={entry.name} className="bg-game-surface px-3 py-2">
            {renderEntry(entry)}
          </li>
        ) : (
          <li
            key={entry.name}
            className="flex min-w-0 items-center justify-between gap-2 bg-game-surface px-3 py-2 text-sm text-game-fg"
          >
            <span className="min-w-0 truncate font-medium">{entry.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              {entry.score !== undefined && (
                <span className="tabular-nums text-game-muted">{entry.score}</span>
              )}
              <span aria-hidden>{STATUS_GLYPH[entry.status]}</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
