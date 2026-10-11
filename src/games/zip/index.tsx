import { useEffect, useRef, useState } from "react";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HelpModal } from "../../components/HelpModal";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { meta } from "./meta";
import {
  DEFAULT_STATE,
  applyCellInteraction,
  buildSummary,
  clearPath,
  formatElapsed,
  isSolved,
  moveInDirection,
  undo,
  type Cell,
  type Direction,
  type ZipPuzzle,
  type ZipState,
} from "./logic";
import { ZipGrid } from "./components/Grid";

const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export default function ZipGame() {
  const { date, puzzle, status } = usePuzzle<ZipPuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<ZipState>(meta.id, date);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  // Mirrors usePlay's own debounce/flush pattern: the interval below needs the *latest* state and
  // callbacks without re-subscribing every second (which would reset mid-tick), so it reads them
  // through a ref kept fresh on every render instead of closing over a stale render's values.
  const tickRef = useRef<() => void>(() => {});

  const state: ZipState = { ...DEFAULT_STATE, ...play?.state };
  const isFinished = play?.status === "won" || play?.status === "lost";
  const puzzleNumber = dayIndex(date) + 1;

  tickRef.current = () => {
    if (!play || play.status !== "in_progress") return;
    save({ state: { path: state.path, elapsed: state.elapsed + 1 } });
  };

  useEffect(() => {
    if (!play || play.status !== "in_progress") return;
    const id = setInterval(() => tickRef.current(), 1000);
    return () => clearInterval(id);
    // Only (re)start the interval when the play transitions in/out of "in_progress" — not on
    // every tick's own save(), which would otherwise recreate this effect every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play?.status]);

  async function commitPath(puzzle: ZipPuzzle, next: Cell[]) {
    if (!play) await start();
    const nextState: ZipState = { path: next, elapsed: state.elapsed };
    save({ state: nextState });
    if (isSolved(puzzle, next)) {
      await finish({ won: true, state: nextState, summary: buildSummary(puzzleNumber, state.elapsed) });
      setResultOpen(true);
    }
  }

  function handleInteract(activePuzzle: ZipPuzzle, cell: Cell) {
    if (isFinished) return;
    const next = applyCellInteraction(activePuzzle, state.path, cell);
    if (next === state.path) return;
    void commitPath(activePuzzle, next);
  }

  function handleUndo(activePuzzle: ZipPuzzle) {
    if (isFinished || state.path.length === 0) return;
    void commitPath(activePuzzle, undo(state.path));
  }

  function handleClear(activePuzzle: ZipPuzzle) {
    if (isFinished || state.path.length === 0) return;
    void commitPath(activePuzzle, clearPath());
  }

  useEffect(() => {
    if (!puzzle || isFinished || helpOpen || resultOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Backspace") {
        e.preventDefault();
        handleUndo(puzzle!);
        return;
      }
      const direction = ARROW_DIRECTIONS[e.key];
      if (!direction) return;
      e.preventDefault();
      const next = moveInDirection(puzzle!, state.path, direction);
      if (next === state.path) return;
      void commitPath(puzzle!, next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, isFinished, helpOpen, resultOpen, state.path]);

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModalContent open={helpOpen} onClose={() => setHelpOpen(false)} />
      </GameLayout>
    );
  }

  const activePuzzle = puzzle; // narrowed once; closures above re-check `puzzle` for TS's sake

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && (
        <AlreadyPlayed status={play.status}>
          <div className="mt-3">
            <Button size="sm" onClick={() => setResultOpen(true)}>
              See result
            </Button>
          </div>
        </AlreadyPlayed>
      )}

      <div className="flex flex-col items-center gap-4 py-2">
        {/* No aria-live here: it ticks every second, which would spam screen readers. The
            final time is announced once instead, via ResultModal's own title/content. */}
        <p className="font-brand text-lg tabular-nums text-game-muted">{formatElapsed(state.elapsed)}</p>

        <ZipGrid
          puzzle={activePuzzle}
          path={state.path}
          readOnly={isFinished}
          onInteract={isFinished ? undefined : (cell) => handleInteract(activePuzzle, cell)}
        />

        {!isFinished && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleUndo(activePuzzle)} disabled={state.path.length === 0}>
              Undo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleClear(activePuzzle)} disabled={state.path.length === 0}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <HelpModalContent open={helpOpen} onClose={() => setHelpOpen(false)} />

      {isFinished && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={play?.status === "won"}
          summary={buildSummary(puzzleNumber, state.elapsed)}
          puzzleNumber={puzzleNumber}
          extraContent={
            <div className="flex justify-center">
              <ZipGrid puzzle={activePuzzle} path={state.path} readOnly compact />
            </div>
          }
        />
      )}
    </GameLayout>
  );
}

function HelpModalContent({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <HelpModal open={open} onClose={onClose}>
      <p>Draw one continuous path that visits every cell in the grid exactly once.</p>
      <p>
        Start at cell <strong>1</strong>, pass through every other numbered checkpoint in order,
        and end on the highest number.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Drag across cells to draw; drag back over your own path to retract it.</li>
        <li>Arrow keys extend the path one step; Backspace undoes the last step.</li>
        <li>Some boards have walls — the path can never cross one, even between adjacent cells.</li>
        <li>The path can't cross or revisit a cell.</li>
      </ul>
    </HelpModal>
  );
}
