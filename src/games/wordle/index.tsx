import { useEffect, useMemo, useState } from "react";
import "@fontsource/libre-franklin/400.css";
import "@fontsource/libre-franklin/600.css";
import "@fontsource/libre-franklin/700.css";
import "@fontsource/dm-serif-display/400.css";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HelpModal } from "../../components/HelpModal";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { Keyboard } from "../../components/Keyboard";
import { usePuzzle, usePlay, usePlays } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { formatGuesses } from "../../lib/format";
import { meta } from "./meta";
import { Board } from "./components/Board";
import { HardModeToggle } from "./components/HardModeToggle";
import { InvalidWordToast } from "./components/InvalidWordToast";
import {
  DEFAULT_STATE,
  MAX_GUESSES,
  WORD_LENGTH,
  isOver,
  isWon,
  keyboardStates,
  hardModeViolation,
  buildSummary,
  describeGuess,
} from "./logic";
import type { WordlePuzzle, WordleState } from "./logic";

const TOAST_MS = 1600;
const SHAKE_MS = 400;

export default function Wordle() {
  const { date, puzzle, status } = usePuzzle<WordlePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<WordleState>(meta.id, date);

  const [validWords, setValidWords] = useState<Set<string> | null>(null);
  const [currentGuess, setCurrentGuess] = useState("");
  const [hardModeDraft, setHardModeDraft] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const [pendingResult, setPendingResult] = useState<WordleState | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/assets/wordle/guesses.json")
      .then((r) => r.json() as Promise<string[]>)
      .then((list) => {
        if (!cancelled) setValidWords(new Set(list.map((w) => w.toUpperCase())));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          <HelpContent />
        </HelpModal>
      </GameLayout>
    );
  }

  const activePuzzle = puzzle; // narrowed once, non-null for the rest of this render + closures
  // See logic.ts DEFAULT_STATE's comment: merge, don't `??`, so the moment right after start()
  // (state = {}) doesn't crash the render.
  const state: WordleState = { ...DEFAULT_STATE, ...play?.state };
  const answer = activePuzzle.answer.toUpperCase();
  const over = isOver(state, answer);
  const won = isWon(state, answer);
  const puzzleNumber = dayIndex(date) + 1;
  const hardModeActive = state.guesses.length > 0 ? state.hardMode : hardModeDraft;

  function flashMessage(message: string) {
    setToast(message);
    setShake(true);
    setTimeout(() => setShake(false), SHAKE_MS);
    setTimeout(() => setToast((current) => (current === message ? null : current)), TOAST_MS);
  }

  async function submitGuess() {
    if (revealingRow !== null || over) return;
    if (currentGuess.length !== WORD_LENGTH) return;

    if (!validWords?.has(currentGuess)) {
      flashMessage("Not in word list");
      return;
    }
    if (hardModeActive && state.guesses.length > 0) {
      const violation = hardModeViolation(currentGuess, state.guesses, answer);
      if (violation) {
        flashMessage(violation);
        return;
      }
    }

    if (!play) await start();
    const nextGuesses = [...state.guesses, currentGuess];
    const nextState: WordleState = { guesses: nextGuesses, hardMode: hardModeActive };
    save({ state: nextState });
    setLiveMessage(describeGuess(currentGuess, answer, nextGuesses.length));
    setPendingResult(nextState);
    setRevealingRow(nextGuesses.length - 1);
    setCurrentGuess("");
  }

  function onRevealComplete() {
    setRevealingRow(null);
    const nextState = pendingResult;
    setPendingResult(null);
    if (!nextState) return;
    if (isOver(nextState, answer)) {
      const wonNow = isWon(nextState, answer);
      void finish({
        won: wonNow,
        state: nextState,
        summary: buildSummary(nextState, answer, puzzleNumber),
        score: wonNow ? nextState.guesses.length : undefined,
      }).then(() => setResultOpen(true));
    }
  }

  function onKey(key: string) {
    if (over || revealingRow !== null) return;
    if (key === "Enter") {
      void submitGuess();
      return;
    }
    if (key === "Backspace") {
      setCurrentGuess((g) => g.slice(0, -1));
      return;
    }
    if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((g) => g + key);
    }
  }

  const keyStates = keyboardStates(state.guesses, answer);

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-4">
        <HardModeToggle
          checked={hardModeActive}
          onChange={setHardModeDraft}
          locked={state.guesses.length > 0}
        />

        <div className="relative flex justify-center">
          <InvalidWordToast message={toast} />
          <Board
            guesses={state.guesses}
            currentGuess={currentGuess}
            answer={answer}
            revealingRow={revealingRow}
            onRevealComplete={onRevealComplete}
            shakeCurrentRow={shake}
          />
        </div>

        <div aria-live="polite" className="sr-only">
          {liveMessage}
        </div>

        <Keyboard onKey={onKey} keyStates={keyStates} disabled={over || revealingRow !== null} />

        {over && (
          <Button onClick={() => setResultOpen(true)}>{won ? "Nice! 🎉" : "See result"}</Button>
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <HelpContent />
      </HelpModal>

      {over && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={won}
          summary={buildSummary(state, answer, puzzleNumber)}
          puzzleNumber={puzzleNumber}
          extraContent={!won ? <AnswerReveal answer={answer} /> : undefined}
          statsExtraContent={<GuessDistribution gameId={meta.id} />}
          friendsBoardProps={{ sortByScoreAscending: true, formatScore: formatGuesses }}
        />
      )}
    </GameLayout>
  );
}

function HelpContent() {
  return (
    <>
      <p>
        Guess the word in {MAX_GUESSES} tries. Each guess must be a real {WORD_LENGTH}-letter word.
        Press Enter to submit.
      </p>
      <ul className="space-y-2">
        <li className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-tile bg-tile-correct font-bold text-white">
            A
          </span>
          The letter is in the word and in the correct spot.
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-tile bg-tile-present font-bold text-white">
            B
          </span>
          The letter is in the word but in the wrong spot.
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-tile bg-tile-absent font-bold text-white">
            C
          </span>
          The letter is not in the word in any spot.
        </li>
      </ul>
      <p>
        <strong>Hard Mode</strong>: any revealed hint must be used in later guesses — a correct
        letter stays in its spot, and a letter known to be in the word must appear again somewhere.
        Turn it on before your first guess; it's locked in for the rest of the puzzle.
      </p>
      <p>A new puzzle arrives every day. Everyone gets the same word.</p>
    </>
  );
}

/** Shown only on a loss — a win already spells the word out in green tiles on the board. */
function AnswerReveal({ answer }: { answer: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-brand-md bg-game-surface-2 p-4">
      <p className="text-sm text-game-muted">The word was</p>
      <p className="font-brand text-2xl font-bold tracking-wide text-game-fg">{answer}</p>
    </div>
  );
}

/** A simple bar chart of guesses-to-win, built from this game's own play history (`score`). */
function GuessDistribution({ gameId }: { gameId: string }) {
  const { plays } = usePlays(gameId);

  const counts = useMemo(() => {
    const buckets = Array.from({ length: MAX_GUESSES }, () => 0);
    for (const p of plays) {
      if (p.status === "won" && p.score && p.score >= 1 && p.score <= MAX_GUESSES) {
        buckets[p.score - 1] += 1;
      }
    }
    return buckets;
  }, [plays]);

  const max = Math.max(1, ...counts);
  if (plays.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="font-brand text-sm font-semibold text-game-muted">Guess distribution</h3>
      {counts.map((count, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-3 text-game-muted">{i + 1}</span>
          <div className="h-4 flex-1 rounded-brand-sm bg-game-surface-2">
            <div
              className="h-4 rounded-brand-sm bg-game-accent text-right"
              style={{ width: count > 0 ? `${Math.max(8, (count / max) * 100)}%` : 0 }}
            >
              <span className="pr-1 text-[10px] text-white">{count > 0 ? count : ""}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
