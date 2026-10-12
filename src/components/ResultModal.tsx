import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Modal } from "./Modal";
import { ShareButton } from "./ShareButton";
import { FriendsBoard } from "./FriendsBoard";
import { NextPuzzleCountdown } from "./NextPuzzleCountdown";
import FlipCard from "./fx/FlipCard";
import SpecularButton from "./fx/SpecularButton";
import { useStats, useTodayStatus } from "../lib/hooks";
import { scoredGameMetas } from "../routes";
import type { ResultModalProps } from "./types";

/** Next scored game (hub order) after `gameId` that isn't won/lost today yet, wrapping around —
 *  so a game played out of hub order still finds the next unplayed one — or `null` if every
 *  scored game is already done. */
function findNextGame(gameId: string, status: Record<string, "in_progress" | "won" | "lost">) {
  const ids = scoredGameMetas.map((m) => m.id);
  const from = ids.indexOf(gameId);
  if (from === -1) return null;
  for (let i = 1; i <= ids.length; i++) {
    const id = ids[(from + i) % ids.length];
    const s = status[id];
    if (s !== "won" && s !== "lost") return scoredGameMetas.find((m) => m.id === id) ?? null;
  }
  return null;
}

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
  friendsBoardProps,
  children,
}: ResultModalProps) {
  const navigate = useNavigate();
  const { stats, refresh } = useStats();
  const todayStatus = useTodayStatus(scoredGameMetas.map((m) => m.id));
  const [flipped, setFlipped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 520 });

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Reveal beat: show the front face briefly, then flip to the real result — only while the
  // modal is actually open, and reset so reopening (a different day, or closing/reopening) plays
  // the reveal again instead of snapping straight to the back.
  useEffect(() => {
    if (!open) {
      setFlipped(false);
      return;
    }
    const t = setTimeout(() => setFlipped(true), 450);
    return () => clearTimeout(t);
  }, [open]);

  // FlipCard needs an explicit pixel width/height (not a percentage) — measure the modal's own
  // content box so the card never overflows at 375px, where Modal's dialog is much narrower than
  // its max-w-md ceiling. Height is viewport-relative with a sane cap; content taller than that
  // scrolls inside the back face (see the `overflow-y-auto` wrapper below) rather than clipping.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const width = Math.max(240, el.clientWidth);
      const height = Math.round(Math.min(560, Math.max(420, window.innerHeight * 0.62)));
      setSize({ width, height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const s = stats[gameId] ?? { played: 0, won: 0, currentStreak: 0, maxStreak: 0 };
  const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
  const heading = title ?? (won ? "Nice!" : "Next time");
  const nextGame = findNextGame(gameId, todayStatus);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={heading}
      headerExtra={<p className="text-sm font-medium text-game-muted">Puzzle #{puzzleNumber}</p>}
    >
      <div ref={containerRef} className="w-full">
        <FlipCard
          flipped={flipped}
          flipOnClick={false}
          draggable={false}
          tilt={false}
          glare={false}
          width={size.width}
          height={size.height}
          radius={16}
          background="transparent"
          color="var(--color-game-fg, #f5eaee)"
          shadow={false}
          front={
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
              <span className="font-brand text-2xl font-bold text-game-fg">Revealing…</span>
            </div>
          }
          back={
            <div className="h-full max-h-full overflow-y-auto overscroll-contain px-1 py-1">
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
                    <FriendsBoard gameId={gameId} date={date} {...friendsBoardProps} />
                  </div>
                </div>

                {children}

                <SpecularButton
                  size="md"
                  tint="#df497b"
                  tintOpacity={0.14}
                  baseColor="#1c1215"
                  lineColor="#f47ba3"
                  textColor="#f5eaee"
                  className="w-full justify-center"
                  onClick={() => navigate(nextGame ? `/${nextGame.id}` : "/")}
                >
                  {nextGame ? `Next: ${nextGame.title}` : "Back to hub"}
                </SpecularButton>
              </div>
            </div>
          }
        />
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
