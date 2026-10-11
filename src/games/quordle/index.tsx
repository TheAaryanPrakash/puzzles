import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import "@fontsource/libre-franklin/400.css";
import "@fontsource/libre-franklin/700.css";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HelpModal } from "../../components/HelpModal";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { meta } from "./meta";
import {
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
  const [helpOpen, setHelpOpen] = useState(false);
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
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          <HowToPlay />
        </HelpModal>
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
      onHelp={() => setHelpOpen(true)}
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
        <div className="grid w-full grid-cols-2 gap-2">
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
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <HowToPlay />
      </HelpModal>

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
            className="flex items-center justify-between rounded-brand-sm px-2 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: `var(--quordle-board-${i + 1})` }}
          >
            <span>{answer}</span>
            <span>{solvedAt ? `#${solvedAt}` : "✕"}</span>
          </div>
        );
      })}
    </div>
  );
}

function HowToPlay() {
  return (
    <>
      <p>Solve all four boards before you run out of guesses.</p>
      <p>
        You get <strong>{MAX_GUESSES} guesses total, shared across all four boards</strong> — every
        word you submit is checked against all four answers at once. A solved board dims and shows
        which guess cracked it; the rest keep going.
      </p>
      <p>
        Tiles work just like Wordle: green is correct, yellow is in the word but the wrong spot, gray
        is not in the word. The keyboard splits each key into four quadrants, one per board, so you
        can see what you know for every board at a glance.
      </p>
    </>
  );
}
