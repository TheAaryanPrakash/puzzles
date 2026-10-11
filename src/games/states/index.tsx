import { useMemo, useState } from "react";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
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
import { useStatesData } from "./data";
import {
  DEFAULT_STATE,
  MAX_GUESSES,
  alreadyGuessed,
  buildNameIndex,
  buildSummary,
  feedbackForGuess,
  isOver,
  isWon,
  type StatePuzzle,
  type StateState,
} from "./logic";
import { Silhouette } from "./components/Silhouette";
import { StateCombobox } from "./components/StateCombobox";
import { GuessList } from "./components/GuessList";

function HelpContent() {
  return (
    <>
      <p>
        A silhouette of one of India's 28 states or 8 union territories is shown. Guess which one in{" "}
        {MAX_GUESSES} tries.
      </p>
      <p>Each guess shows how far away it is, which direction the answer lies, and how close that is.</p>
      <p>Renamed states work too — try the old name if you're not sure of the new one (e.g. Orissa).</p>
    </>
  );
}

export default function StatesGame() {
  const { date, puzzle, status } = usePuzzle<StatePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<StateState>(meta.id, date);
  const { data, status: dataStatus } = useStatesData();
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const nameIndex = useMemo(() => (data ? buildNameIndex(data.states) : new Map<string, string>()), [data]);
  const options = useMemo(
    () => (data ? data.codes.map((code) => ({ code, name: data.states[code].name })) : []),
    [data],
  );

  if (status === "loading" || loading || dataStatus === "loading") return null;

  if (dataStatus === "error" || !data) {
    return (
      <GameLayout game={meta.id} title={meta.title}>
        <NoPuzzleToday gameTitle={meta.title} message="Couldn't load the map data — try refreshing." />
      </GameLayout>
    );
  }

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

  // A fresh `const` (not a re-use of the nullable `data`) so its non-null type survives into the
  // `handleGuess` closure below — TypeScript doesn't carry control-flow narrowing of a captured
  // variable across a nested function boundary, even for `const`.
  const statesData = data;
  const answerCode = puzzle.code;
  const silhouette = statesData.silhouettes[answerCode];
  const state: StateState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, answerCode);
  const won = isWon(state, answerCode);
  const puzzleNumber = dayIndex(date) + 1;
  const guessResults = state.guesses.map((code) =>
    feedbackForGuess(code, answerCode, statesData.states, statesData.maxDistanceKm),
  );
  const disabledCodes = new Set(state.guesses);
  const summary = buildSummary(state, answerCode, statesData.states, statesData.maxDistanceKm, puzzleNumber);

  async function handleGuess(code: string) {
    if (over || alreadyGuessed(state, code)) return;
    if (!play) await start();
    const nextState: StateState = { guesses: [...state.guesses, code] };
    save({ state: nextState });

    if (isOver(nextState, answerCode)) {
      const nextWon = isWon(nextState, answerCode);
      await finish({
        won: nextWon,
        state: nextState,
        summary: buildSummary(nextState, answerCode, statesData.states, statesData.maxDistanceKm, puzzleNumber),
        score: nextWon ? nextState.guesses.length : undefined,
      });
      setResultOpen(true);
    }
  }

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-5">
        <Silhouette
          path={silhouette.path}
          viewBox={silhouette.viewBox}
          status={over ? (won ? "won" : "lost") : "playing"}
          name={over ? statesData.states[answerCode].name : undefined}
        />

        {!over && (
          <>
            <p className="text-sm text-game-muted">
              Guess {state.guesses.length + 1} of {MAX_GUESSES}
            </p>
            <StateCombobox
              options={options}
              nameIndex={nameIndex}
              disabledCodes={disabledCodes}
              onSubmit={(code) => void handleGuess(code)}
            />
          </>
        )}

        <GuessList guesses={guessResults} />

        {over && (
          <Button onClick={() => setResultOpen(true)}>{won ? "You got it! 🎉" : "See result"}</Button>
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
          summary={summary}
          puzzleNumber={puzzleNumber}
          score={won ? state.guesses.length : undefined}
        />
      )}
    </GameLayout>
  );
}
