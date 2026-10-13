import { useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
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
import { noSwipeProps } from "../../lib/noSwipe";
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
  const { member } = useAuth();
  const [helpOpen, openHelp, closeHelp] = useAutoOpenHowToPlay(meta.id, member?.userId);
  const [resultOpen, setResultOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={openHelp}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />
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
      onHelp={openHelp}
      headerActions={
        !hasMoved ? (
          <>
            {/* GameLayout's header is a 3-col grid (title+switcher centered, this column on the
                right) with no shrink guard — at 375px even the bare word "Skip" still clipped
                under the game-switcher dropdown (verified live). Icon-only below sm, matching the
                Archive/Help icon buttons' own footprint; full phrase from sm up, where there's
                room. Same action either way — see "Shared changes requested" in HANDOFF.md.
                The visibility toggle lives on a wrapping span, not on the Button itself: Button's
                own base class already bakes in `inline-flex`, and Tailwind v4 resolves conflicting
                same-specificity utilities by generation order (not JSX order), so a `hidden` class
                placed on the Button directly isn't guaranteed to beat that baked-in `inline-flex`
                (verified live — it didn't). A plain span has no such conflict. */}
            <span className="sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSkip()}
                aria-label="Seen this before? Skip"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-5 w-5"
                >
                  <path d="M5 5v14l9-7-9-7Z" />
                  <path d="M18 5v14" />
                </svg>
              </Button>
            </span>
            <span className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" onClick={() => void handleSkip()}>
                Seen this before? Skip
              </Button>
            </span>
          </>
        ) : undefined
      }
    >
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-4">
        <div className="grid w-full max-w-md grid-cols-4 gap-2" {...noSwipeProps}>
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

      <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />

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

