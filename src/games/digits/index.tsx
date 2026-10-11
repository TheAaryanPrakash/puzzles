import { useEffect, useRef, useState } from "react";
import "@fontsource/libre-franklin/400.css";
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
import { RoundTabs } from "./components/RoundTabs";
import { RoundBoard } from "./components/RoundBoard";
import {
  DEFAULT_STATE,
  addStep,
  undoStep,
  resetRound,
  submitRound,
  scoreRound,
  totalStars,
  isWon,
  isGameOver,
  buildSummary,
  type DigitsPuzzle,
  type DigitsState,
  type Step,
} from "./logic";

export default function Digits() {
  const { date, puzzle, status } = usePuzzle<DigitsPuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<DigitsState>(meta.id, date);
  const [activeRound, setActiveRound] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const initializedForDate = useRef<string | null>(null);
  const autoFinishedForDate = useRef<string | null>(null);

  // See DEFAULT_STATE's comment: merge, don't `??`, so the moment right after start() (state={})
  // doesn't crash the render.
  const state: DigitsState = {
    ...DEFAULT_STATE,
    ...(play?.state as Partial<DigitsState> | undefined),
  };

  // Jump to the first unfinished round once per puzzle day (including after an archive-day nav).
  useEffect(() => {
    if (loading || initializedForDate.current === date) return;
    initializedForDate.current = date;
    const firstUnsubmitted = state.rounds.findIndex((r) => !r.submitted);
    setActiveRound(firstUnsubmitted === -1 ? state.rounds.length - 1 : firstUnsubmitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-init per date
  }, [loading, date]);

  // Self-heal: if every round got submitted but finish() never landed (e.g. the tab closed
  // between the last submit and the finish() call), finish the play on the next load instead of
  // leaving it stuck "in_progress" forever.
  useEffect(() => {
    if (!puzzle || !play || play.status !== "in_progress") return;
    if (autoFinishedForDate.current === date) return;
    if (!isGameOver(state)) return;
    autoFinishedForDate.current = date;
    void finish({
      won: isWon(puzzle, state),
      state,
      summary: buildSummary(puzzle, state, dayIndex(date) + 1),
      score: totalStars(puzzle, state),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, play, date]);

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

  const activePuzzle = puzzle;
  const puzzleNumber = dayIndex(date) + 1;
  const over = isGameOver(state);
  const won = isWon(activePuzzle, state);
  const finished = Boolean(play) && play?.status !== "in_progress";
  const activeRoundState = state.rounds[activeRound];

  async function handleApplyStep(step: Step) {
    if (!play) await start();
    save({ state: addStep(state, activeRound, step) });
  }

  function handleUndo() {
    save({ state: undoStep(state, activeRound) });
  }

  function handleReset() {
    save({ state: resetRound(state, activeRound) });
  }

  async function handleSubmit() {
    if (!play) await start();
    const nextState = submitRound(state, activeRound);
    save({ state: nextState });
    if (isGameOver(nextState)) {
      await finish({
        won: isWon(activePuzzle, nextState),
        state: nextState,
        summary: buildSummary(activePuzzle, nextState, puzzleNumber),
        score: totalStars(activePuzzle, nextState),
      });
      setResultOpen(true);
    } else {
      const nextRound = nextState.rounds.findIndex((r) => !r.submitted);
      if (nextRound !== -1) setActiveRound(nextRound);
    }
  }

  const roundTabsInfo = activePuzzle.rounds.map((round, i) => {
    const roundState = state.rounds[i];
    return {
      submitted: roundState?.submitted ?? false,
      stars: roundState?.submitted ? scoreRound(round, roundState).stars : 0,
    };
  });

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {finished && !resultOpen && play && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-6">
        <RoundTabs active={activeRound} rounds={roundTabsInfo} onSelect={setActiveRound} />
        <RoundBoard
          key={activeRound}
          round={activePuzzle.rounds[activeRound]}
          roundIndex={activeRound}
          state={activeRoundState}
          readOnly={activeRoundState.submitted}
          onApplyStep={handleApplyStep}
          onUndo={handleUndo}
          onReset={handleReset}
          onSubmit={handleSubmit}
        />
        {over && (
          <Button onClick={() => setResultOpen(true)}>{won ? "You did it! 🎉" : "See result"}</Button>
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
          summary={buildSummary(activePuzzle, state, puzzleNumber)}
          score={totalStars(activePuzzle, state)}
          puzzleNumber={puzzleNumber}
        />
      )}
    </GameLayout>
  );
}

function HelpContent() {
  return (
    <>
      <p>
        Each day has 5 rounds. Every round gives you 6 numbers and a target. Tap a number, an
        operator (+ − × ÷), then a second number to merge them into one new number — you don't
        have to use every number.
      </p>
      <p>Every result along the way must be a positive whole number — no fractions, no negatives.</p>
      <p>
        When you submit a round, the number on the board closest to the target decides your stars:
        hit it exactly for ⭐⭐⭐, within 10 for ⭐⭐, within 25 for ⭐. You win the day with at least
        one star in every round.
      </p>
      <p>Use Undo to take back your last merge, or Reset round to start the round over.</p>
    </>
  );
}
