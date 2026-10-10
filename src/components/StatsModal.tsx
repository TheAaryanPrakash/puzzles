import { Modal } from "./Modal";
import { useStats } from "../lib/hooks";
import type { StatsModalProps } from "./types";

export function StatsModal({
  open,
  onClose,
  gameId,
  title = "Statistics",
  extraContent,
}: StatsModalProps) {
  const { stats } = useStats();
  const s = stats[gameId] ?? { played: 0, won: 0, currentStreak: 0, maxStreak: 0 };
  const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Played" value={s.played} />
        <Stat label="Win %" value={winPct} />
        <Stat label="Streak" value={s.currentStreak} />
        <Stat label="Max streak" value={s.maxStreak} />
      </div>
      {extraContent && <div className="mt-4">{extraContent}</div>}
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
