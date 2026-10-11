import { useState } from "react";
import { Link } from "react-router";
import { SiteHeader } from "../components/SiteHeader";
import { useActiveGroup } from "../lib/groups";
import { useLeaderboard } from "../lib/hooks";

type Period = "day" | "week";
type Scope = "group" | "global";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 flex-1 rounded-brand-sm px-3 py-1.5 text-sm font-semibold transition-colors duration-brand-fast ${
        active
          ? "bg-brand-accent text-brand-accent-fg"
          : "text-brand-muted hover:bg-brand-surface-2 hover:text-brand-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>("day");
  const [scope, setScope] = useState<Scope>("group");
  const { activeGroupId, activeGroup, groups, loading: groupsLoading } = useActiveGroup();
  const { rows, loading, error } = useLeaderboard(scope, {
    groupId: activeGroupId ?? undefined,
    period,
  });

  const showingGroup = scope === "group";

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader title="Leaderboard" backTo="/" />
      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <p className="text-sm text-brand-muted">
          Win a puzzle on its own day for 1 point, plus a +1 bonus once your streak reaches 3, or
          +2 once it reaches 7. Catching up from the archive is free to play, but scores 0.
        </p>

        <div className="mt-4 flex gap-1 rounded-brand-md bg-brand-surface-2 p-1">
          <TabButton active={period === "day"} onClick={() => setPeriod("day")}>
            Today
          </TabButton>
          <TabButton active={period === "week"} onClick={() => setPeriod("week")}>
            This week
          </TabButton>
        </div>

        <div className="mt-2 flex gap-1 rounded-brand-md bg-brand-surface-2 p-1">
          <TabButton active={scope === "group"} onClick={() => setScope("group")}>
            {showingGroup && activeGroup ? activeGroup.name : "My group"}
          </TabButton>
          <TabButton active={scope === "global"} onClick={() => setScope("global")}>
            Everyone
          </TabButton>
        </div>

        <div className="mt-5">
          {showingGroup && !groupsLoading && groups.length === 0 ? (
            <p className="rounded-brand-md bg-game-surface-2 px-3 py-4 text-center text-sm text-brand-muted">
              Join a group to see its leaderboard.
            </p>
          ) : loading || groupsLoading ? null : error ? (
            <p role="alert" className="text-center text-sm text-brand-danger">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-brand-md bg-brand-surface-2 px-3 py-4 text-center text-sm text-brand-muted">
              No one's scored yet {period === "day" ? "today" : "this week"}.
            </p>
          ) : (
            <ol className="divide-y divide-brand-border overflow-hidden rounded-brand-md border border-brand-border">
              {rows.map((row) => (
                <li
                  key={`${row.rank}-${row.displayName}`}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                    row.isMe ? "bg-brand-accent/10" : "bg-brand-surface"
                  }`}
                >
                  <span className="w-6 shrink-0 text-center font-brand font-semibold text-brand-muted tabular-nums">
                    {row.rank}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${row.isMe ? "font-semibold text-brand-accent" : "text-brand-fg"}`}
                  >
                    {row.displayName}
                    {row.isMe && " (you)"}
                  </span>
                  <span className="shrink-0 text-xs text-brand-muted">
                    {row.wins}/{row.gamesPlayed} won
                  </span>
                  <span className="w-10 shrink-0 text-right font-brand font-bold tabular-nums text-brand-fg">
                    {row.points}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/groups" className="text-sm font-semibold text-brand-accent hover:underline">
            Manage groups
          </Link>
        </div>
      </main>
    </div>
  );
}
