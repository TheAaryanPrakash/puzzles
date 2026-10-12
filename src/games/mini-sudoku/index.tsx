import { useEffect, useRef, useState } from "react";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HowToPlayModal, useAutoOpenHowToPlay } from "../../components/HowToPlayModal";
import { useAuth } from "../../lib/auth";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { Board } from "../sudoku/shared/components/Board";
import { NumberPad } from "../sudoku/shared/components/NumberPad";
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
  type MiniSudokuPuzzle,
  type MiniSudokuState,
} from "./logic";

const EMPTY_STATE: MiniSudokuState = { entries: [], notes: [], elapsed: 0 };

export default function MiniSudokuGame() {
  const { date, puzzle, status } = usePuzzle<MiniSudokuPuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<MiniSudokuState>(meta.id, date);

  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [checkMistakes, setCheckMistakes] = useState(true);
  const { member } = useAuth();
  const [helpOpen, openHelp, closeHelp] = useAutoOpenHowToPlay(meta.id, member?.userId);
  const [resultOpen, setResultOpen] = useState(false);
  const [history, setHistory] = useState<MiniSudokuState[]>([]);
  const [localElapsed, setLocalElapsed] = useState(0);

  useEffect(() => {
    setSelected(null);
    setHistory([]);
    setLocalElapsed(0);
    setResultOpen(false);
  }, [date]);

  const baseState: MiniSudokuState = puzzle ? { ...defaultState(puzzle), ...play?.state } : EMPTY_STATE;
  const state: MiniSudokuState = play ? baseState : { ...baseState, elapsed: localElapsed };
  const solved = puzzle ? isWon(state, puzzle) : false;
  const finished = play ? play.status !== "in_progress" : false;
  const puzzleNumber = dayIndex(date) + 1;

  const stateRef = useRef(state);
  stateRef.current = state;
  const playRef = useRef(play);
  playRef.current = play;

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

  async function applyMove(next: MiniSudokuState) {
    if (next === state) return;
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!puzzle || solved || finished) return;
      // See sudoku/index.tsx's identical guard: skip while any Modal (role="dialog") is open so
      // typing to read/dismiss it never edits the board hidden behind it.
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
    <GameLayout game={meta.id} title={meta.title} onHelp={openHelp}>
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

          <div className="flex w-full max-w-[min(92vw,22rem)] items-center justify-between text-sm text-game-muted">
            <span className="tabular-nums">{formatElapsed(state.elapsed)}</span>
            <span className="capitalize">{puzzle.difficulty}</span>
            <button
              type="button"
              onClick={() => setCheckMistakes((v) => !v)}
              aria-pressed={checkMistakes}
              className={`rounded-brand-sm border px-2 py-1 text-xs font-bold outline-none transition-colors duration-brand-fast focus-visible:ring-2 focus-visible:ring-game-accent focus-visible:ring-offset-1 ${
                checkMistakes
                  ? "border-game-accent text-game-accent"
                  : "border-game-border text-game-muted hover:bg-game-surface-2"
              }`}
            >
              Check mistakes
            </button>
          </div>

          <Board
            label="Mini Sudoku board"
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

      <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />

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
            <p className="text-center text-lg font-bold">Solved in {formatElapsed(play?.score ?? state.elapsed)}</p>
          }
          friendsBoardProps={{ sortByScoreAscending: true, formatScore: formatElapsed }}
        />
      )}
    </GameLayout>
  );
}
