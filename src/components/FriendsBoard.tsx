import { useFriendsResults } from "../lib/hooks";
import { useActiveGroup } from "../lib/groups";
import type { FriendsBoardProps } from "./types";

const STATUS_GLYPH: Record<string, string> = { won: "✅", lost: "❌", in_progress: "⏳" };

/**
 * Ranks entries by `score` ascending (fastest time / fewest guesses first). Stable: entries
 * without a score (e.g. a loss) keep their relative order and sink below every scored entry.
 */
export function sortByScore<T extends { score?: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.score === undefined && b.score === undefined) return 0;
    if (a.score === undefined) return 1;
    if (b.score === undefined) return -1;
    return a.score - b.score;
  });
}

/** Always shows the member's *active* group (see `useActiveGroup`) — switched from the site
 *  header's group switcher, not from a prop, so every board on the site agrees on which group. */
export function FriendsBoard({
  gameId,
  date,
  renderEntry,
  emptyMessage = "No one else has finished yet.",
  sortByScoreAscending,
  formatScore,
}: FriendsBoardProps) {
  const { activeGroupId, activeGroup, loading: groupLoading } = useActiveGroup();
  const { results, loading } = useFriendsResults(gameId, date, activeGroupId);

  if (loading || groupLoading) return null;
  if (results.length === 0) {
    return (
      <p className="rounded-brand-md bg-game-surface-2 px-3 py-4 text-center text-sm text-game-muted">
        {activeGroup ? `${emptyMessage} (${activeGroup.name})` : emptyMessage}
      </p>
    );
  }

  const ordered = sortByScoreAscending ? sortByScore(results) : results;

  return (
    <ul className="divide-y divide-game-border overflow-hidden rounded-brand-md border border-game-border">
      {ordered.map((entry) =>
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
                <span className="tabular-nums text-game-muted">
                  {formatScore ? formatScore(entry.score) : entry.score}
                </span>
              )}
              <span aria-hidden>{STATUS_GLYPH[entry.status]}</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
