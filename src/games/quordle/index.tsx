import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HowToPlayModal, useAutoOpenHowToPlay } from "../../components/HowToPlayModal";
import { ResultModal } from "../../components/ResultModal";
import { useAuth } from "../../lib/auth";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { formatGuesses } from "../../lib/format";
import { noSwipeProps } from "../../lib/noSwipe";
import { meta } from "./meta";
import {
  BOARD_COLORS,
  BOARD_COLORS_INK,
  DEFAULT_STATE,
  MAX_GUESSES,
  WORD_LENGTH,
  boardGuesses,
  boardSolvedAt,
  buildSummary,
  combinedKeyStates,
  isOver,
  isValidGuessWord,
  isWon,
  type QuordlePuzzle,
  type QuordleState,
} from "./logic";
import { Board } from "./components/Board";
import { QuordleKeyboard } from "./components/QuordleKeyboard";

const LETTER_KEY = /^[A-Z]$/;
const SHAKE_MS = 350;

export default function QuordleGame() {
  const { date, puzzle, status } = usePuzzle<QuordlePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<QuordleState>(meta.id, date);
  const [currentGuess, setCurrentGuess] = useState("");
  const [shake, setShake] = useState(false);
  const { member } = useAuth();
  const [helpOpen, openHelp, closeHelp] = useAutoOpenHowToPlay(meta.id, member?.userId);
  const [resultOpen, setResultOpen] = useState(false);
  const [validGuesses, setValidGuesses] = useState<Set<string> | null>(null);
  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    let cancelled = false;
    void fetch("/assets/quordle/guesses.json")
      .then((r) => r.json() as Promise<string[]>)
      .then((words) => {
        if (!cancelled) setValidGuesses(new Set(words));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentGuess("");
  }, [date]);

  useEffect(
    () => () => {
      if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    },
    [],
  );

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={openHelp}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />
      </GameLayout>
    );
  }

  const activePuzzle = puzzle; // narrowed once, non-null for the rest of this render + closures
  const state: QuordleState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, activePuzzle.answers);
  const won = isWon(state, activePuzzle.answers);
  const puzzleNumber = dayIndex(date) + 1;
  const keyStates = combinedKeyStates(state, activePuzzle.answers);
  const guessesLeft = MAX_GUESSES - state.guesses.length;

  function triggerShake() {
    setShake(true);
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => setShake(false), SHAKE_MS);
  }

  async function handleSubmit() {
    if (over) return;
    if (currentGuess.length !== WORD_LENGTH) {
      triggerShake();
      return;
    }
    if (!validGuesses || !isValidGuessWord(currentGuess, validGuesses)) {
      triggerShake();
      return;
    }

    if (!play) await start();
    const nextState: QuordleState = { guesses: [...state.guesses, currentGuess] };
    save({ state: nextState });
    setCurrentGuess("");

    if (isOver(nextState, activePuzzle.answers)) {
      const nextWon = isWon(nextState, activePuzzle.answers);
      await finish({
        won: nextWon,
        state: nextState,
        summary: buildSummary(nextState, activePuzzle.answers, puzzleNumber),
        score: nextWon ? nextState.guesses.length : undefined,
      });
      setResultOpen(true);
    }
  }

  function handleKey(key: string) {
    if (over) return;
    if (key === "Enter") {
      void handleSubmit();
      return;
    }
    if (key === "Backspace") {
      setCurrentGuess((g) => g.slice(0, -1));
      return;
    }
    if (LETTER_KEY.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((g) => g + key);
    }
  }

  return (
    <GameLayout
      game={meta.id}
      title={meta.title}
      onHelp={openHelp}
      headerActions={
        !over && (
          <span className="text-sm text-game-muted" aria-live="polite">
            {guessesLeft} left
          </span>
        )
      }
    >
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
        <div className="grid w-full grid-cols-2 gap-2" {...noSwipeProps}>
          {activePuzzle.answers.map((answer, i) => {
            const solvedAt = boardSolvedAt(state.guesses, answer);
            return (
              <Board
                key={i}
                answer={answer}
                guesses={boardGuesses(state.guesses, answer)}
                currentGuess={currentGuess}
                active={solvedAt === null && !over}
                solvedAt={solvedAt}
                boardIndex={i}
                shake={shake}
                reducedMotion={reducedMotion}
              />
            );
          })}
        </div>

        <QuordleKeyboard onKey={handleKey} keyStates={keyStates} disabled={over} />

        {over && (
          <Button onClick={() => setResultOpen(true)}>{won ? "Nice! 🎉" : "See result"}</Button>
        )}
      </div>

      <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />

      {over && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={won}
          summary={buildSummary(state, activePuzzle.answers, puzzleNumber)}
          score={won ? state.guesses.length : undefined}
          puzzleNumber={puzzleNumber}
          extraContent={<Recap answers={activePuzzle.answers} state={state} />}
          friendsBoardProps={{ sortByScoreAscending: true, formatScore: formatGuesses }}
        />
      )}
    </GameLayout>
  );
}

function Recap({ answers, state }: { answers: readonly string[]; state: QuordleState }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {answers.map((answer, i) => {
        const solvedAt = boardSolvedAt(state.guesses, answer);
        return (
          <div
            key={i}
            className="flex items-center justify-between rounded-brand-sm px-2 py-1 text-sm font-semibold"
            style={{ backgroundColor: BOARD_COLORS[i], color: BOARD_COLORS_INK }}
          >
            <span>{answer}</span>
            <span>{solvedAt ? `#${solvedAt}` : "✕"}</span>
          </div>
        );
      })}
    </div>
  );
}

