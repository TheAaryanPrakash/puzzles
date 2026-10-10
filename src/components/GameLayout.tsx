import { Link } from "react-router";
import type { GameLayoutProps } from "./types";

export function GameLayout({
  game,
  title,
  onHelp,
  onStats,
  headerActions,
  children,
}: GameLayoutProps) {
  return (
    <div data-game={game} className="min-h-screen bg-game-bg font-game text-game-fg">
      <header className="flex items-center justify-between border-b border-game-border bg-game-surface px-4 py-3">
        <Link to="/" aria-label="Back to hub" className="text-game-fg hover:text-game-accent">
          ←
        </Link>
        <h1 className="font-game text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          {headerActions}
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
      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
    </div>
  );
}
