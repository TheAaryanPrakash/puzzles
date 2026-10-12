import { useEffect, useRef, useState } from "react";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HelpModal } from "../../components/HelpModal";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { Board } from "./shared/components/Board";
import { NumberPad } from "./shared/components/NumberPad";
import { meta } from "./meta";
import {
  CONFIG,
  defaultState,
  setEntry,
  toggleNote,
  eraseCell,
  findConflicts,
  getHighlight,
  isWon,
  buildSummary,
  formatElapsed,
  type SudokuPuzzle,
  type SudokuState,
} from "./logic";

const EMPTY_STATE: SudokuState = { entries: [], notes: [], elapsed: 0 };

export default function SudokuGame() {
  const { date, puzzle, status } = usePuzzle<SudokuPuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<SudokuState>(meta.id, date);

  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [checkMistakes, setCheckMistakes] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [history, setHistory] = useState<SudokuState[]>([]);
  const [localElapsed, setLocalElapsed] = useState(0);

  // A new puzzle day resets all local-only UI state (undo stack, selection, pre-start timer).
  useEffect(() => {
    setSelected(null);
    setHistory([]);
    setLocalElapsed(0);
    setResultOpen(false);
  }, [date]);

  // See logic.ts's defaultState comment: merge, never `??`, so the moment right after start()
  // (play.state === {}) doesn't crash the render.
  const baseState: SudokuState = puzzle ? { ...defaultState(puzzle), ...play?.state } : EMPTY_STATE;
  // Before the play is started there's nothing to persist elapsed time into yet, so the timer
  // ticks a local counter instead until the first move calls start().
  const state: SudokuState = play ? baseState : { ...baseState, elapsed: localElapsed };
  const solved = puzzle ? isWon(state, puzzle) : false;
  const finished = play ? play.status !== "in_progress" : false;
  const puzzleNumber = dayIndex(date) + 1;

  const stateRef = useRef(state);
  stateRef.current = state;
  const playRef = useRef(play);
  playRef.current = play;

  // Timer: one tick per second, stopping once the board is solved or the play has already ended
  // (e.g. a replayed, already-won archive day).
  useEffect(() => {
    if (!puzzle) return;
    if (play && play.status !== "in_progress") return;
    const id = setInterval(() => {
      if (!puzzle || isWon(stateRef.current, puzzle)) return;
      const nextElapsed = stateRef.current.elapsed + 1;
      if (playRef.current) save({ state: { ...stateRef.current, elapsed: nextElapsed } });
      else setLocalElapsed(nextElapsed);
    }, 1000);
    return () => clearInterval(id);
  }, [date, puzzle, play?.status, save]);

  // Win detection: finish the play the instant every cell matches the solution.
  useEffect(() => {
    if (!puzzle || !play || play.status !== "in_progress") return;
    if (!isWon(state, puzzle)) return;
    void finish({
      won: true,
      state,
      summary: buildSummary(puzzleNumber, puzzle.difficulty, state.elapsed),
      score: state.elapsed,
    }).then(() => setResultOpen(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entries]);

  async function applyMove(next: SudokuState) {
    if (next === state) return; // no-op: given cell, or nothing changed
    setHistory((h) => [...h, state]);
    if (!play) await start();
    save({ state: next });
  }

  async function handleNumber(value: number) {
    if (!puzzle || !selected || solved || finished) return;
    const next = notesMode
      ? toggleNote(state, puzzle, selected.row, selected.col, value)
      : setEntry(state, puzzle, selected.row, selected.col, value);
    await applyMove(next);
  }

  async function handleErase() {
    if (!puzzle || !selected || solved || finished) return;
    await applyMove(eraseCell(state, puzzle, selected.row, selected.col));
  }

  function handleUndo() {
    if (history.length === 0 || solved || finished) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    save({ state: previous });
  }

  // Physical keyboard: digits write/note, Backspace erases, N toggles notes, Ctrl/Cmd+Z undoes.
  // Re-subscribed every render so it always sees the latest state — cheap for a single page like
  // this, and avoids a second, separately-threaded copy of the same stale-closure bookkeeping.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!puzzle || solved || finished) return;
      // Any open Modal (Help, Result, GameLayout's own Archive/Stats) renders role="dialog" and
      // moves focus into itself; skip so typing to dismiss it or read it never edits the board
      // hidden behind it.
      if (document.querySelector('[role="dialog"]')) return;
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        void handleErase();
        return;
      }
      if (e.key.toLowerCase() === "n") {
        setNotesMode((v) => !v);
        return;
      }
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= CONFIG.size) void handleNumber(digit);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (status === "loading" || loading) return null;

  const conflicts = puzzle && checkMistakes ? findConflicts(state.entries) : new Set<string>();
  const highlight = puzzle ? getHighlight(selected, state.entries) : { peers: new Set<string>(), sameValue: new Set<string>() };

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {status === "missing" || !puzzle ? (
        <NoPuzzleToday gameTitle={meta.title} />
      ) : (
        <div className="flex flex-col items-center gap-4">
          {finished && !resultOpen && (
            <AlreadyPlayed status={play!.status}>
              <Button size="sm" className="mt-3" onClick={() => setResultOpen(true)}>
                View result
              </Button>
            </AlreadyPlayed>
          )}

          <div className="flex w-full max-w-[min(92vw,28rem)] items-center justify-between text-sm text-game-muted">
            <span className="font-mono-ink tabular-nums">{formatElapsed(state.elapsed)}</span>
            <span className="capitalize">{puzzle.difficulty}</span>
            <button
              type="button"
              onClick={() => setCheckMistakes((v) => !v)}
              aria-pressed={checkMistakes}
              className={`rounded-brand-sm border px-2 py-1 text-xs font-semibold outline-none transition-colors duration-brand-fast focus-visible:ring-2 focus-visible:ring-game-accent focus-visible:ring-offset-1 ${
                checkMistakes
                  ? "border-game-accent text-game-accent"
                  : "border-game-border text-game-muted hover:bg-game-surface-2"
              }`}
            >
              Check mistakes
            </button>
          </div>

          <Board
            config={CONFIG}
            puzzle={puzzle.puzzle}
            entries={state.entries}
            notes={state.notes}
            selected={selected}
            onSelect={(row, col) => setSelected({ row, col })}
            conflicts={conflicts}
            highlight={highlight}
            solved={solved || finished}
          />

          <NumberPad
            size={CONFIG.size}
            entries={state.entries}
            disabled={solved || finished}
            notesMode={notesMode}
            onToggleNotes={() => setNotesMode((v) => !v)}
            onNumber={(v) => void handleNumber(v)}
            onErase={() => void handleErase()}
            onUndo={handleUndo}
            canUndo={history.length > 0}
          />
        </div>
      )}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <p>Fill the grid so every row, column and 3×3 box contains 1–9 exactly once.</p>
        <p>Select a cell, then enter a digit with the number pad or your keyboard.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Notes</strong> — toggle on (or press <kbd>N</kbd>) to pencil in candidates
            instead of a final answer.
          </li>
          <li>
            <strong>Check mistakes</strong> — highlights any cell that repeats a digit in its row,
            column or box.
          </li>
          <li>
            <strong>Undo</strong> (or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>) steps back one
            move; <kbd>Backspace</kbd> erases the selected cell.
          </li>
          <li>Arrow keys move the selection; the timer keeps running until the grid is solved.</li>
        </ul>
      </HelpModal>

      {puzzle && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={true}
          summary={play?.summary ?? buildSummary(puzzleNumber, puzzle.difficulty, state.elapsed)}
          score={play?.score ?? state.elapsed}
          puzzleNumber={puzzleNumber}
          extraContent={
            <p className="text-center font-mono-ink text-lg">
              Solved in {formatElapsed(play?.score ?? state.elapsed)}
            </p>
          }
          friendsBoardProps={{ sortByScoreAscending: true, formatScore: formatElapsed }}
        />
      )}
    </GameLayout>
  );
}
