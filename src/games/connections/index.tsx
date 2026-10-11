import { useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import "@fontsource/libre-franklin/700.css";
import "@fontsource/libre-franklin/800.css";
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
  GROUP_SIZE,
  MAX_MISTAKES,
  effectiveOrder,
  evaluateGuess,
  isDuplicateGuess,
  countMistakes,
  isWon,
  isLost,
  isOver,
  solvedGroups,
  solvedWordSet,
  remainingGroupsByLevel,
  shuffleRemaining,
  buildSummary,
} from "./logic";
import type { ConnectionsPuzzle, ConnectionsState } from "./logic";
import { Tile } from "./components/Tile";
import { SolvedGroupBar } from "./components/SolvedGroupBar";
import { MistakeDots } from "./components/MistakeDots";
import { Toast } from "./components/Toast";

const TOAST_MS = 1600;
const SHAKE_MS = 400;

export default function ConnectionsGame() {
  const { date, puzzle, reserve, status } = usePuzzle<ConnectionsPuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<ConnectionsState>(meta.id, date);
  const reduceMotion = Boolean(useReducedMotion());

  const [selected, setSelected] = useState<string[]>([]);
  const [shakeWords, setShakeWords] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // `usePuzzle`'s own `puzzle` only resolves the variant once, at mount — see its doc comment —
  // so "Skip" (below) switches boards immediately by reading `reserve` directly off `play.variant`.
  const activePuzzle = play?.variant === "reserve" && reserve ? reserve : puzzle;
  // See logic.ts DEFAULT_STATE: merge, don't `??`, so the {} window right after start() doesn't crash.
  const state: ConnectionsState = { ...DEFAULT_STATE, ...play?.state };
  const order = effectiveOrder(state, activePuzzle, date);
  const solved = solvedGroups(state.guesses, activePuzzle);
  const solvedWords = solvedWordSet(state.guesses, activePuzzle);
  const mistakes = countMistakes(state.guesses, activePuzzle);
  const won = isWon(state.guesses, activePuzzle);
  const lost = isLost(state.guesses, activePuzzle);
  const over = isOver(state.guesses, activePuzzle);
  const visibleWords = order.filter((w) => !solvedWords.has(w));
  const remaining = lost ? remainingGroupsByLevel(state.guesses, activePuzzle) : [];
  const puzzleNumber = dayIndex(date) + 1;
  // The data layer refuses a variant switch once `play.state` is no longer the literal `{}`
  // default — mirror that here so "Skip" disappears exactly when it would be rejected anyway.
  const hasMoved = !!play && Object.keys((play.state as object) ?? {}).length > 0;

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  function triggerShake(words: string[]) {
    setShakeWords(words);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShakeWords(null), SHAKE_MS);
  }

  function toggleWord(word: string) {
    if (over) return;
    setSelected((prev) => {
      if (prev.includes(word)) return prev.filter((w) => w !== word);
      if (prev.length >= GROUP_SIZE) return prev;
      return [...prev, word];
    });
  }

  async function handleSkip() {
    if (!play) {
      await start("reserve");
      return;
    }
    save({ variant: "reserve" });
  }

  async function handleShuffle() {
    if (over) return;
    if (!play) await start();
    const nextOrder = shuffleRemaining(order, solvedWords, Math.random);
    save({ state: { guesses: state.guesses, order: nextOrder } });
  }

  function handleDeselectAll() {
    setSelected([]);
  }

  async function handleSubmit() {
    if (over || selected.length !== GROUP_SIZE) return;
    if (!play) await start();

    if (isDuplicateGuess(selected, state.guesses)) {
      showToast("Already guessed!");
      return;
    }

    const guess = selected;
    const outcome = evaluateGuess(guess, activePuzzle);
    const nextGuesses = [...state.guesses, guess];
    const nextWon = isWon(nextGuesses, activePuzzle);
    const nextMistakes = countMistakes(nextGuesses, activePuzzle);
    const nextLost = !nextWon && nextMistakes >= MAX_MISTAKES;

    setSelected([]);
    if (outcome !== "correct") triggerShake(guess);
    if (!nextWon && !nextLost && outcome === "one-away") showToast("One away…");

    const nextState: ConnectionsState = { guesses: nextGuesses, order: state.order };
    if (nextWon || nextLost) {
      await finish({
        won: nextWon,
        state: nextState,
        summary: buildSummary(nextGuesses, activePuzzle, puzzleNumber),
      });
      setResultOpen(true);
    } else {
      save({ state: nextState });
    }
  }

  return (
    <GameLayout
      game={meta.id}
      title={meta.title}
      onHelp={() => setHelpOpen(true)}
      headerActions={
        !hasMoved ? (
          <Button variant="ghost" size="sm" onClick={() => void handleSkip()}>
            Seen this before? Skip
          </Button>
        ) : undefined
      }
    >
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-4">
        <div className="grid w-full max-w-md grid-cols-4 gap-2">
          <AnimatePresence>
            {solved.map((group, i) => (
              <SolvedGroupBar key={group.label} group={group} index={i} reduceMotion={reduceMotion} />
            ))}
            {!lost &&
              visibleWords.map((word) => (
                <Tile
                  key={word}
                  word={word}
                  selected={selected.includes(word)}
                  disabled={over}
                  shake={shakeWords?.includes(word) ?? false}
                  reduceMotion={reduceMotion}
                  onClick={() => toggleWord(word)}
                />
              ))}
            {lost &&
              remaining.map((group, i) => (
                <SolvedGroupBar
                  key={group.label}
                  group={group}
                  index={solved.length + i}
                  reduceMotion={reduceMotion}
                />
              ))}
          </AnimatePresence>
        </div>

        {!over && (
          <>
            <MistakeDots mistakes={mistakes} max={MAX_MISTAKES} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void handleShuffle()}>
                Shuffle
              </Button>
              <Button variant="secondary" size="sm" disabled={selected.length === 0} onClick={handleDeselectAll}>
                Deselect all
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={selected.length !== GROUP_SIZE}
                onClick={() => void handleSubmit()}
              >
                Submit
              </Button>
            </div>
          </>
        )}

        {over && (
          <Button onClick={() => setResultOpen(true)}>{won ? "You got it! 🎉" : "See result"}</Button>
        )}
      </div>

      <Toast message={toast} reduceMotion={reduceMotion} />

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
          summary={buildSummary(state.guesses, activePuzzle, puzzleNumber)}
          puzzleNumber={puzzleNumber}
        />
      )}
    </GameLayout>
  );
}

function HelpContent() {
  return (
    <>
      <p>Find groups of four words that share something in common.</p>
      <p>Select four words and hit Submit. Categories range from straightforward (yellow) to tricky (purple).</p>
      <p>
        <strong>One away…</strong> means three of your four words belong together, but one doesn&apos;t.
      </p>
      <p>You have {MAX_MISTAKES} mistakes before the game ends.</p>
    </>
  );
}
