import { Link } from "react-router";
import { SiteHeader } from "../components/SiteHeader";
import JellyRadio from "../components/fx/JellyRadio";
import GlideSelect from "../components/fx/GlideSelect";
import { useActiveGroup } from "../lib/groups";
import { useLeaderboard } from "../lib/hooks";
import { useState } from "react";
import { TrophyIcon } from "../components/icons";

type Period = "day" | "week";
type Scope = "group" | "global";

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>("day");
  const [scope, setScope] = useState<Scope>("group");
  const { activeGroupId, activeGroup, groups, setActiveGroupId, loading: groupsLoading } = useActiveGroup();
  const { rows, loading, error } = useLeaderboard(scope, {
    groupId: activeGroupId ?? undefined,
    period,
  });

  const showingGroup = scope === "group";
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const mine = rows.find((r) => r.isMe);
  const myRankOutsideTop3 = mine && !top3.includes(mine) ? mine : null;

  return (
    <div className="min-h-screen bg-brand-bg/85">
      <SiteHeader title="Leaderboard" backTo="/" />
      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <p className="text-sm text-brand-muted">
          Win a puzzle on its own day for 1 point, plus a +1 bonus once your streak reaches 3, or
          +2 once it reaches 7. Catching up from the archive is free to play, but scores 0.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <JellyRadio
            items={[
              { value: "day", label: "Today" },
              { value: "week", label: "This week" },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            size="sm"
            ariaLabel="Period"
          />
          <JellyRadio
            items={[
              { value: "group", label: showingGroup && activeGroup ? activeGroup.name : "My group" },
              { value: "global", label: "Everyone" },
            ]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            size="sm"
            ariaLabel="Scope"
          />
        </div>

        {showingGroup && groups.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-brand-muted">Group</span>
            <GlideSelect
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              value={activeGroupId ?? undefined}
              onChange={(id) => setActiveGroupId(id)}
              size="sm"
              ariaLabel="Choose group"
            />
          </div>
        )}

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
            <>
              {/* Top 3 as a small bento-style row — the grid mechanics of MagicBento aren't worth
                  pulling in for 3 static cards, so this is a plain bento-flavoured layout: a
                  bigger #1 card plus two smaller #2/#3 cards, same visual language (surface-2,
                  rounded-brand-lg, a glow accent) as the rest of the redesign. */}
              <div className="grid grid-cols-3 gap-2">
                {top3.map((row, i) => (
                  <div
                    key={`${row.rank}-${row.displayName}`}
                    className={`flex flex-col items-center gap-1 rounded-brand-lg border p-3 text-center shadow-brand-sm ${
                      i === 0
                        ? "col-span-3 border-brand-accent bg-brand-accent/10 sm:col-span-1"
                        : "border-brand-border bg-brand-surface"
                    } ${row.isMe ? "ring-2 ring-brand-ring" : ""}`}
                  >
                    {i === 0 && <TrophyIcon className="h-5 w-5 text-brand-accent" aria-hidden />}
                    <span className="font-brand text-xs font-semibold text-brand-muted">#{row.rank}</span>
                    <span className="truncate text-sm font-semibold text-brand-fg">
                      {row.displayName}
                      {row.isMe && " (you)"}
                    </span>
                    <span className="font-brand text-lg font-bold tabular-nums text-brand-accent">
                      {row.points}
                    </span>
                  </div>
                ))}
              </div>

              {myRankOutsideTop3 && (
                <div className="mt-2 flex items-center gap-3 rounded-brand-md bg-brand-accent/10 px-3 py-2 text-sm">
                  <span className="w-6 shrink-0 text-center font-brand font-semibold text-brand-accent tabular-nums">
                    {myRankOutsideTop3.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-brand-accent">You</span>
                  <span className="font-brand font-bold tabular-nums text-brand-fg">
                    {myRankOutsideTop3.points}
                  </span>
                </div>
              )}

              {rest.length > 0 && (
                <ol className="mt-3 divide-y divide-brand-border overflow-hidden rounded-brand-md border border-brand-border">
                  {rest.map((row) => (
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
            </>
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
