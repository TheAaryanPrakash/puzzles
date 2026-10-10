import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Modal } from "./Modal";
import { ArchivePicker } from "./ArchivePicker";
import { usePlays } from "../lib/hooks";
import { resolvePuzzleDate, todayKey, dayIndex } from "../lib/daily";
import type { GameLayoutProps } from "./types";

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GameLayout({
  game,
  title,
  onHelp,
  onStats,
  headerActions,
  children,
}: GameLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { plays } = usePlays(game);

  const viewedDate = resolvePuzzleDate();
  const viewingPastDay = viewedDate !== todayKey();

  // Preserve any other query params (notably dev's `?date=` "today" override) when navigating.
  function hrefForDay(date: string | null): string {
    const params = new URLSearchParams(searchParams);
    if (date) params.set("day", date);
    else params.delete("day");
    const qs = params.toString();
    return `/${game}${qs ? `?${qs}` : ""}`;
  }

  function handleSelectDay(date: string) {
    setArchiveOpen(false);
    navigate(hrefForDay(date));
  }

  return (
    <div data-game={game} className="min-h-screen bg-game-bg font-game text-game-fg">
      <header className="flex items-center justify-between border-b border-game-border bg-game-surface px-4 py-3">
        <Link to="/" aria-label="Back to hub" className="text-game-fg hover:text-game-accent">
          ←
        </Link>
        <h1 className="font-game text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          {headerActions}
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            aria-label="Archive"
            className="rounded-brand-sm p-2 hover:bg-game-surface-2"
          >
            🗓️
          </button>
          {onStats && (
            <button
              type="button"
              onClick={onStats}
              aria-label="Statistics"
              className="rounded-brand-sm p-2 hover:bg-game-surface-2"
            >
              📊
            </button>
          )}
          {onHelp && (
            <button
              type="button"
              onClick={onHelp}
              aria-label="How to play"
              className="rounded-brand-sm p-2 hover:bg-game-surface-2"
            >
              ❓
            </button>
          )}
        </div>
      </header>

      {viewingPastDay && (
        <div className="flex items-center justify-center gap-2 bg-game-surface-2 px-4 py-2 text-sm text-game-muted">
          <span>
            Puzzle #{dayIndex(viewedDate) + 1} · {formatDate(viewedDate)}
          </span>
          <span aria-hidden>·</span>
          <Link to={hrefForDay(null)} className="font-semibold text-game-accent hover:underline">
            Back to today
          </Link>
        </div>
      )}

      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>

      <Modal open={archiveOpen} onClose={() => setArchiveOpen(false)} title="Archive">
        <ArchivePicker
          gameId={game}
          playedDates={plays.map((p) => p.date)}
          onSelect={handleSelectDay}
        />
      </Modal>
    </div>
  );
}
