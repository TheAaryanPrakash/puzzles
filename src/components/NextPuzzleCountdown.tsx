import { useEffect, useState } from "react";
import { PUZZLE_TIMEZONE } from "../config";
import { todayKey, addDays } from "../lib/daily";
import type { NextPuzzleCountdownProps } from "./types";

/** ms such that `at.getTime() + offset` reads as `at`'s wall-clock time in `timeZone`. */
function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  const hour = map.hour === "24" ? "00" : map.hour;
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +hour, +map.minute, +map.second);
  return asUtc - at.getTime();
}

function msUntilNextPuzzleDay(): number {
  const now = new Date();
  const tomorrow = addDays(todayKey(), 1);
  const [y, m, d] = tomorrow.split("-").map(Number);
  const offset = tzOffsetMs(PUZZLE_TIMEZONE, now);
  const targetUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offset;
  return Math.max(0, targetUtcMs - now.getTime());
}

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function NextPuzzleCountdown({
  label = "Next puzzle in",
  className = "",
}: NextPuzzleCountdownProps) {
  const [remaining, setRemaining] = useState(msUntilNextPuzzleDay);

  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilNextPuzzleDay()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className={`text-sm text-game-muted ${className}`}>
      {label}
      <br />
      <span className="font-brand text-base font-semibold tabular-nums text-game-fg">
        {format(remaining)}
      </span>
    </p>
  );
}
