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
    return <p className="text-sm text-game-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-game-border">
      {results.map((entry) =>
        renderEntry ? (
          <li key={entry.name}>{renderEntry(entry)}</li>
        ) : (
          <li key={entry.name} className="flex items-center justify-between py-2 text-sm">
            <span>{entry.name}</span>
            <span className="flex items-center gap-2">
              <span aria-hidden>{STATUS_GLYPH[entry.status]}</span>
              {entry.score !== undefined && <span>{entry.score}</span>}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
