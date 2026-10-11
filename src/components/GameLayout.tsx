import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
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

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-brand-full text-lg transition-colors duration-brand-fast hover:bg-game-surface-2";

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
  const reduceMotion = useReducedMotion();

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
      <a
        href="#main-content"
        className="sr-only rounded-brand-sm bg-game-accent px-4 py-2 font-semibold text-game-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <header className="flex items-center justify-between border-b border-game-border bg-game-surface px-3 py-2.5">
        <Link
          to="/"
          aria-label="Back to hub"
          className={`${ICON_BUTTON} text-game-fg hover:text-game-accent`}
        >
          ←
        </Link>
        <h1 className="text-balance font-game text-lg font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-1">
          {headerActions}
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            aria-label="Archive"
            className={ICON_BUTTON}
          >
            🗓️
          </button>
          {onStats && (
            <button type="button" onClick={onStats} aria-label="Statistics" className={ICON_BUTTON}>
              📊
            </button>
          )}
          {onHelp && (
            <button type="button" onClick={onHelp} aria-label="How to play" className={ICON_BUTTON}>
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

      <motion.main
        id="main-content"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-xl px-4 py-6"
      >
        {children}
      </motion.main>

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
