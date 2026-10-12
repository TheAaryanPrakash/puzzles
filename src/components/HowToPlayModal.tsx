import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import FlipCard from "./fx/FlipCard";
import type { GameMeta } from "../lib/types";
import {
  WordleIcon,
  QuordleIcon,
  WorldleIcon,
  FlagleIcon,
  GlobleIcon,
  TravleIcon,
  StatesIcon,
  ZipIcon,
  ConnectionsIcon,
  SudokuIcon,
  MiniSudokuIcon,
  MiniIcon,
  DigitsIcon,
  BeeIcon,
  ChessIcon,
} from "./icons";

// Duplicated from Hub.tsx's own GAME_ICONS (out of this component's scope to import from a page) —
// keep in sync if a game's icon changes.
const GAME_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  wordle: WordleIcon,
  quordle: QuordleIcon,
  worldle: WorldleIcon,
  flagle: FlagleIcon,
  globle: GlobleIcon,
  travle: TravleIcon,
  states: StatesIcon,
  zip: ZipIcon,
  connections: ConnectionsIcon,
  sudoku: SudokuIcon,
  "mini-sudoku": MiniSudokuIcon,
  mini: MiniIcon,
  digits: DigitsIcon,
  bee: BeeIcon,
  chess: ChessIcon,
};

function seenKey(gameId: string, userId: string): string {
  return `sansitas-puzzles:howto-seen:${gameId}:${userId}`;
}

/** Whether this user has already seen gameId's HowToPlay — never throws (private browsing etc). */
function hasSeen(gameId: string, userId: string): boolean {
  try {
    return localStorage.getItem(seenKey(gameId, userId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(gameId: string, userId: string): void {
  try {
    localStorage.setItem(seenKey(gameId, userId), "1");
  } catch {
    // ignore — worst case it auto-opens again next visit, not harmful
  }
}

/**
 * Opens automatically on a member's first visit to a game (remembered per user id in
 * localStorage) and from GameLayout's `?` button. Call `markHowToPlaySeen` is not needed by
 * consumers — this component marks it seen itself, the instant it opens for any reason, so
 * reopening via `?` doesn't re-trigger the auto-open on a later visit.
 */
export function useAutoOpenHowToPlay(gameId: string, userId: string | undefined): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!userId || checked.current) return;
    checked.current = true;
    if (!hasSeen(gameId, userId)) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  useEffect(() => {
    if (open && userId) markSeen(gameId, userId);
  }, [open, gameId, userId]);

  return [open, () => setOpen(true), () => setOpen(false)];
}

export interface HowToPlayModalProps {
  game: GameMeta;
  open: boolean;
  onClose: () => void;
}

/** Shared "how to play" modal: FlipCard front (icon/title/tagline) flips to back (rules/steps/
 *  example) shortly after opening — see useAutoOpenHowToPlay for the open/auto-open logic. */
export function HowToPlayModal({ game, open, onClose }: HowToPlayModalProps) {
  const [flipped, setFlipped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 420 });
  const Icon = GAME_ICONS[game.id];
  const howTo = game.howTo;

  // Reveal beat, same pattern as ResultModal's flip — front briefly, then the real content. Reset
  // on close so reopening plays the reveal again.
  useEffect(() => {
    if (!open) {
      setFlipped(false);
      return;
    }
    const t = setTimeout(() => setFlipped(true), 500);
    return () => clearTimeout(t);
  }, [open]);

  // FlipCard needs an explicit pixel width/height — measure the modal's own content box, same
  // approach as ResultModal (see that file's comment for why: % sizing overflows at 375px).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const width = Math.max(240, el.clientWidth);
      const height = Math.round(Math.min(480, Math.max(360, window.innerHeight * 0.55)));
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

  return (
    <Modal open={open} onClose={onClose} title="How to play">
      <div ref={containerRef} className="w-full">
        <FlipCard
          flipped={flipped}
          onFlipChange={setFlipped}
          width={size.width}
          height={size.height}
          radius={16}
          background="transparent"
          color="var(--color-game-fg, #f5eaee)"
          shadow={false}
          ariaLabel={`How to play ${game.title}`}
          front={
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
              {Icon && (
                <span className="text-game-accent">
                  <Icon className="h-12 w-12" />
                </span>
              )}
              <span className="font-brand text-2xl font-bold text-game-fg">{game.title}</span>
              <span className="text-sm text-game-muted">{game.tagline}</span>
              <span className="mt-2 text-xs text-game-muted">Tap the card to flip</span>
            </div>
          }
          back={
            <div className="h-full max-h-full overflow-y-auto overscroll-contain px-1 py-1">
              <div className="space-y-4 text-left text-sm leading-relaxed text-game-fg">
                {howTo ? (
                  <>
                    <p>{howTo.rules}</p>
                    {howTo.steps && howTo.steps.length > 0 && (
                      <ul className="space-y-2">
                        {howTo.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span aria-hidden="true">•</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {howTo.example && (
                      <div className="rounded-brand-md bg-game-surface-2 px-3 py-2.5">
                        <p className="text-xs font-semibold text-game-muted">{howTo.example.label}</p>
                        <p className="mt-1">{howTo.example.detail}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-game-muted">Rules for {game.title} are coming soon.</p>
                )}
              </div>
            </div>
          }
        />
      </div>
    </Modal>
  );
}
