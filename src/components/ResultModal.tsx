import { useEffect } from "react";
import { Modal } from "./Modal";
import { ShareButton } from "./ShareButton";
import { FriendsBoard } from "./FriendsBoard";
import { NextPuzzleCountdown } from "./NextPuzzleCountdown";
import { useStats } from "../lib/hooks";
import type { ResultModalProps } from "./types";

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
      headerExtra={<p className="text-sm text-game-muted">#{puzzleNumber}</p>}
    >
      <div className="space-y-4">
        {extraContent}
        {score !== undefined && <p className="text-center font-brand text-lg">Score: {score}</p>}

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Played" value={s.played} />
          <Stat label="Win %" value={winPct} />
          <Stat label="Streak" value={s.currentStreak} />
          <Stat label="Max streak" value={s.maxStreak} />
        </div>
        {statsExtraContent}

        <div className="flex items-center justify-between gap-3">
          <ShareButton text={summary} />
          <NextPuzzleCountdown />
        </div>

        <div>
          <h3 className="font-brand text-sm font-semibold text-game-muted">Friends</h3>
          <FriendsBoard gameId={gameId} date={date} />
        </div>

        {children}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-brand text-2xl font-bold">{value}</div>
      <div className="text-xs text-game-muted">{label}</div>
    </div>
  );
}
