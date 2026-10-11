import { useEffect } from "react";
import { Modal } from "./Modal";
import { ShareButton } from "./ShareButton";
import { FriendsBoard } from "./FriendsBoard";
import { NextPuzzleCountdown } from "./NextPuzzleCountdown";
import { useStats } from "../lib/hooks";
import type { ResultModalProps } from "./types";

/**
 * A game that scores its plays (e.g. guesses-to-win) can build a guess-distribution chart from
 * `usePlays(gameId)`'s `score` field and pass it as `statsExtraContent`, instead of inventing its
 * own stats storage.
 */
export function ResultModal({
  open,
  onClose,
  gameId,
  date,
  won,
  title,
  summary,
  score,
  puzzleNumber,
  extraContent,
  statsExtraContent,
  children,
}: ResultModalProps) {
  const { stats, refresh } = useStats();

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const s = stats[gameId] ?? { played: 0, won: 0, currentStreak: 0, maxStreak: 0 };
  const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
  const heading = title ?? (won ? "Nice!" : "Next time");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={heading}
      headerExtra={<p className="text-sm font-medium text-game-muted">Puzzle #{puzzleNumber}</p>}
    >
      <div className="space-y-5">
        {extraContent}
        {score !== undefined && (
          <p className="text-center font-brand text-lg font-semibold tabular-nums text-game-fg">
            Score: {score}
          </p>
        )}

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Played" value={s.played} />
          <Stat label="Win %" value={winPct} />
          <Stat label="Streak" value={s.currentStreak} />
          <Stat label="Max streak" value={s.maxStreak} />
        </div>
        {statsExtraContent}

        <div className="flex items-center justify-between gap-3 border-t border-game-border pt-4">
          <ShareButton text={summary} />
          <NextPuzzleCountdown />
        </div>

        <div>
          <h3 className="font-brand text-sm font-semibold text-game-muted">Friends</h3>
          <div className="mt-2">
            <FriendsBoard gameId={gameId} date={date} />
          </div>
        </div>

        {children}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-brand-md bg-game-surface-2 px-2 py-3">
      <div className="font-brand text-2xl font-bold tabular-nums text-game-fg">{value}</div>
      <div className="mt-0.5 text-xs text-game-muted">{label}</div>
    </div>
  );
}
