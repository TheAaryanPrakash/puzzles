export interface ClockProps {
  ms: number;
  active: boolean;
  label: string;
}

const LOW_TIME_MS = 30_000;

/** Renders mm:ss from milliseconds, floored at 0, with a warm highlight for whichever side is
 *  actually on the move and a colour change under 30s. */
export function Clock({ ms, active, label }: ClockProps) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const low = ms > 0 && ms <= LOW_TIME_MS;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-brand-md border px-3 py-2 ${
        active ? "border-game-accent bg-game-surface-2" : "border-game-border bg-game-surface"
      }`}
    >
      <span className="text-sm font-semibold text-game-muted">{label}</span>
      <span
        className={`text-lg tabular-nums ${low ? "text-brand-danger" : "text-game-fg"}`}
        style={{ fontFamily: "var(--chess-mono-font)" }}
        aria-live="off"
      >
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
