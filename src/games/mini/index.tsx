import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import "@fontsource/libre-franklin/400.css";
import "@fontsource/libre-franklin/600.css";
import "@fontsource/libre-franklin/700.css";
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
import { MiniGrid } from "./components/MiniGrid";
import { ClueBar } from "./components/ClueBar";
import {
  advanceAfterType,
  buildSummary,
  cellIndex,
  clueAt,
  DEFAULT_STATE,
  formatElapsed,
  isSolved,
  moveArrow,
  moveToAdjacentClue,
  normalizeLetters,
  resolveTapDirection,
  retreatAfterDelete,
  revealedLetters,
  wordCells,
  wrongCells,
  type Cursor,
  type MiniPuzzle,
  type MiniState,
} from "./logic";

const CHECK_FLASH_MS = 1500;

function firstCursor(puzzle: MiniPuzzle): Cursor {
  const first = puzzle.clues.across[0] ?? puzzle.clues.down[0];
  return first
    ? { row: first.row, col: first.col, direction: puzzle.clues.across[0] ? "across" : "down" }
    : { row: 0, col: 0, direction: "across" };
}

export default function MiniGame() {
  const { date, puzzle, reserve, status } = usePuzzle<MiniPuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<MiniState>(meta.id, date);
  // Nullable here (`puzzle` isn't narrowed yet) — only for the cursor-reset effect below, which
  // already guards for null. The non-null `activePuzzle` used everywhere else is declared after
  // the "missing puzzle" return, where `puzzle`'s narrowing makes it non-null too.
  const viewedPuzzle = play?.variant === "reserve" && reserve ? reserve : puzzle;

  const [cursor, setCursor] = useState<Cursor>({ row: 0, col: 0, direction: "across" });
  // Optimistic, synchronous source of truth for the grid while typing: `play.state.letters`
  // only updates once start()/save() round-trip through the data layer, which is too slow to
  // drive every keystroke directly — two keys typed faster than that round-trip would both read
  // the same stale `play`, clobbering each other. Typing writes here first (same tick, so the
  // next keystroke's event always sees the latest letters/cursor); persistence happens in the
  // background via `persist()`. Reset to null (defer to `play.state`) whenever the day changes.
  const [localLetters, setLocalLetters] = useState<(string | null)[] | null>(null);
  const [wrongIndices, setWrongIndices] = useState<Set<number>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [ticks, setTicks] = useState(0);
  const elapsedBaseRef = useRef(0);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dedupes concurrent "first move" start() calls the same way: several keystrokes can each see
  // `play === null` before the first start() resolves, so they share one in-flight promise.
  const startPromiseRef = useRef<Promise<unknown> | null>(null);

  // Reset to the puzzle's first entry whenever the viewed day changes (new puzzle object), or
  // the play switches to the reserve puzzle.
  useEffect(() => {
    if (viewedPuzzle) setCursor(firstCursor(viewedPuzzle));
    setLocalLetters(null);
    startPromiseRef.current = null;
  }, [viewedPuzzle, date]);

  const over = play ? play.status !== "in_progress" : false;

  // Timer: counts up from the persisted elapsed time, pausing while the tab is hidden or the
  // puzzle is finished. `elapsedBaseRef` is re-anchored whenever the persisted state jumps
  // (puzzle change, resume from another device) so ticks always add on top of the real total.
  useEffect(() => {
    elapsedBaseRef.current = play?.state?.elapsed ?? 0;
    setTicks(0);
  }, [date, play?.state?.elapsed]);

  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setTicks((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [over]);

  const displayElapsed = elapsedBaseRef.current + ticks;

  useEffect(() => () => {
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
  }, []);

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          <MiniHelp />
        </HelpModal>
      </GameLayout>
    );
  }

  const activePuzzle = play?.variant === "reserve" && reserve ? reserve : puzzle;
  // See logic.ts's DEFAULT_STATE comment: merge, don't `??`, so the moment right after start()
  // (state === {}) doesn't crash the render.
  const state: MiniState = { ...DEFAULT_STATE, ...play?.state };
  const letters = localLetters ?? normalizeLetters(state.letters, activePuzzle);
  const puzzleNumber = dayIndex(date) + 1;

  const currentClue = clueAt(activePuzzle, cursor.direction, cursor.row, cursor.col);
  const wordIndices = currentClue ? new Set(wordCells(activePuzzle, cursor.direction, currentClue)) : new Set<number>();

  /** Fire-and-forget persistence: never awaited by a keystroke, so typing never blocks on it. */
  function persist(nextLetters: (string | null)[], revealed: boolean, elapsed: number): MiniState {
    const nextState: MiniState = { letters: nextLetters, elapsed, revealed };
    void (async () => {
      if (!play) {
        if (!startPromiseRef.current) startPromiseRef.current = start();
        await startPromiseRef.current;
      }
      save({ state: nextState });
    })();
    return nextState;
  }

  async function finishGame(nextState: MiniState, won: boolean, summaryText: string) {
    if (startPromiseRef.current) await startPromiseRef.current;
    await finish({ won, state: nextState, summary: summaryText });
    setResultOpen(true);
  }

  function handleLetter(letter: string) {
    if (over) return;
    const idx = cellIndex(activePuzzle, cursor.row, cursor.col);
    if (activePuzzle.cells[idx] === null) return;
    const nextLetters = letters.slice();
    nextLetters[idx] = letter;
    setLocalLetters(nextLetters);
    setCursor(advanceAfterType(activePuzzle, nextLetters, cursor.direction, cursor.row, cursor.col));
    const nextState = persist(nextLetters, false, displayElapsed);
    if (isSolved(activePuzzle, nextLetters)) {
      void finishGame(nextState, true, buildSummary(activePuzzle, puzzleNumber, displayElapsed, false));
    }
  }

  function handleBackspace() {
    if (over) return;
    const idx = cellIndex(activePuzzle, cursor.row, cursor.col);
    const nextLetters = letters.slice();
    let nextCursor = cursor;
    if (nextLetters[idx]) {
      nextLetters[idx] = null;
    } else {
      nextCursor = retreatAfterDelete(activePuzzle, cursor.direction, cursor.row, cursor.col);
      nextLetters[cellIndex(activePuzzle, nextCursor.row, nextCursor.col)] = null;
    }
    setLocalLetters(nextLetters);
    setCursor(nextCursor);
    if (play) persist(nextLetters, false, displayElapsed);
  }

  function handleCellClick(row: number, col: number) {
    if (over) return;
    const idx = cellIndex(activePuzzle, row, col);
    if (activePuzzle.cells[idx] === null) return;
    setCursor({ row, col, direction: resolveTapDirection(activePuzzle, row, col, cursor) });
    inputRef.current?.focus();
  }

  function stepClue(step: 1 | -1) {
    if (!currentClue) return;
    setCursor(moveToAdjacentClue(activePuzzle, cursor.direction, currentClue.number, step));
  }

  function toggleDirection() {
    setCursor({ ...cursor, direction: resolveTapDirection(activePuzzle, cursor.row, cursor.col, cursor) });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (over) return;
    switch (e.key) {
      case "Backspace":
        e.preventDefault();
        handleBackspace();
        break;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        setCursor(moveArrow(activePuzzle, cursor.row, cursor.col, cursor.direction, e.key));
        break;
      case "Tab":
        e.preventDefault();
        stepClue(e.shiftKey ? -1 : 1);
        break;
      case " ":
        e.preventDefault();
        toggleDirection();
        break;
      default:
        break;
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const match = e.target.value.match(/[a-zA-Z]/g);
    e.target.value = "";
    if (!match || match.length === 0) return;
    handleLetter(match[match.length - 1].toUpperCase());
  }

  function handleCheck() {
    setWrongIndices(new Set(wrongCells(activePuzzle, letters)));
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(() => setWrongIndices(new Set()), CHECK_FLASH_MS);
  }

  function handleReveal() {
    // Ends the puzzle for good — no "play again" (CLAUDE.md's game contract) — so confirm first.
    if (!window.confirm("Reveal every answer? You won't be able to undo this or try again.")) return;
    const nextLetters = revealedLetters(activePuzzle);
    setLocalLetters(nextLetters);
    const nextState = persist(nextLetters, true, displayElapsed);
    void finishGame(nextState, false, buildSummary(activePuzzle, puzzleNumber, displayElapsed, true));
  }

  async function handleSkipToReserve() {
    await start("reserve");
  }

  const summary = buildSummary(activePuzzle, puzzleNumber, state.elapsed, state.revealed);

  return (
    <GameLayout
      game={meta.id}
      title={meta.title}
      onHelp={() => setHelpOpen(true)}
      headerActions={
        !play ? (
          <button
            type="button"
            onClick={() => void handleSkipToReserve()}
            aria-label="Seen this puzzle before? Skip to a different one"
            title="Seen this puzzle before? Skip to a different one"
            className="rounded-brand-sm px-2 py-1 text-xs font-semibold text-game-muted hover:bg-game-surface-2 hover:text-game-accent"
          >
            Skip
          </button>
        ) : undefined
      }
    >
      {over && !resultOpen && <AlreadyPlayed status={play!.status} />}

      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full max-w-[420px] items-center justify-between text-sm text-game-muted">
          <span>Mini #{puzzleNumber}</span>
          <span>{formatElapsed(over ? state.elapsed : displayElapsed)}</span>
        </div>

        <MiniGrid
          puzzle={activePuzzle}
          letters={letters}
          cursor={cursor}
          wordIndices={over ? new Set() : wordIndices}
          wrongIndices={wrongIndices}
          readOnly={over}
          onCellClick={handleCellClick}
        />

        {!over && (
          <>
            <ClueBar
              clue={currentClue}
              direction={cursor.direction}
              onPrev={() => stepClue(-1)}
              onNext={() => stepClue(1)}
              onToggleDirection={toggleDirection}
            />
            <input
              ref={inputRef}
              className="mini-input-trap"
              autoFocus
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="Type your answer"
              onKeyDown={handleKeyDown}
              onChange={handleChange}
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCheck}>
                Check
              </Button>
              <Button variant="secondary" size="sm" onClick={handleReveal}>
                Reveal
              </Button>
            </div>
          </>
        )}

        {over && (
          <Button onClick={() => setResultOpen(true)}>{play!.status === "won" ? "Nice! 🎉" : "See result"}</Button>
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <MiniHelp />
      </HelpModal>

      {play && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={play.status === "won"}
          summary={play.summary ?? summary}
          puzzleNumber={puzzleNumber}
          extraContent={
            <MiniGrid
              puzzle={activePuzzle}
              letters={letters}
              cursor={cursor}
              wordIndices={new Set()}
              wrongIndices={new Set()}
              readOnly
            />
          }
        />
      )}
    </GameLayout>
  );
}

function MiniHelp() {
  return (
    <>
      <p>Fill every white square so the across and down answers both work — a tiny crossword.</p>
      <p>
        Type to fill a cell and move on; tap a cell (or press Space) to switch between across and
        down. Arrow keys move around, Tab jumps to the next clue.
      </p>
      <p>
        <strong>Check</strong> flags any wrong letters for a moment without clearing them.{" "}
        <strong>Reveal</strong> fills in every answer — it shows in your result as a peek, not a
        solve.
      </p>
    </>
  );
}
