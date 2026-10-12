import { useState } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "flag-icons/css/flag-icons.min.css";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HelpModal } from "../../components/HelpModal";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex } from "../../lib/daily";
import { formatGuesses } from "../../lib/format";
import { meta } from "./meta";
import { useCountryData } from "./useCountryData";
import { CountryAutocomplete } from "./components/CountryAutocomplete";
import { GuessRow } from "./components/GuessRow";
import { Silhouette } from "./components/Silhouette";
import {
  MAX_GUESSES,
  DEFAULT_STATE,
  evaluateGuess,
  isOver,
  isWon,
  buildSummary,
  nameFor,
  type WorldlePuzzle,
  type WorldleState,
} from "./logic";

export default function Worldle() {
  const { date, puzzle, status } = usePuzzle<WorldlePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<WorldleState>(meta.id, date);
  const { data, status: dataStatus } = useCountryData();
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const helpContent = (
    <>
      <p>
        Guess the country from its silhouette in {MAX_GUESSES} tries. Type into the box and pick a
        match — nicknames and common aliases work too (e.g. "UAE", "America").
      </p>
      <p>
        Every wrong guess tells you the <strong>distance</strong> to the answer, the{" "}
        <strong>direction</strong> (a compass arrow), and a <strong>proximity %</strong> — 100% is
        exact, 0% is the farthest two places on Earth can be from each other.
      </p>
    </>
  );

  if (status === "loading" || loading || dataStatus === "loading") return null;

  if (dataStatus === "error" || !data) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday
          gameTitle={meta.title}
          message="Couldn't load the map data — try refreshing the page."
        />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          {helpContent}
        </HelpModal>
      </GameLayout>
    );
  }

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          {helpContent}
        </HelpModal>
      </GameLayout>
    );
  }

  const activePuzzle = puzzle; // narrowed once, non-null for the rest of this render + closures
  const countryData = data; // same — TS can't carry the `!data` guard's narrowing into closures
  const silhouette = countryData.silhouettes[activePuzzle.code];
  // See DEFAULT_STATE's comment: merge, don't `??`, so the moment right after start() (state={})
  // doesn't crash the render.
  const state: WorldleState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, activePuzzle.code);
  const won = isWon(state, activePuzzle.code);
  const puzzleNumber = dayIndex(date) + 1;
  const feedbacks = state.guesses.map((code) =>
    evaluateGuess(code, activePuzzle.code, countryData.centroids),
  );

  async function handleSelect(code: string) {
    if (over) return;
    if (!play) await start();
    const nextState: WorldleState = { guesses: [...state.guesses, code] };
    save({ state: nextState });

    const nextOver = isOver(nextState, activePuzzle.code);
    if (nextOver) {
      const nextWon = isWon(nextState, activePuzzle.code);
      await finish({
        won: nextWon,
        state: nextState,
        summary: buildSummary(nextState, activePuzzle.code, puzzleNumber, countryData.centroids),
        score: nextWon ? nextState.guesses.length : undefined,
      });
      setResultOpen(true);
    }
  }

  const silhouetteLabel = over
    ? `Silhouette of ${nameFor(activePuzzle.code, countryData.names)}`
    : "Mystery country silhouette";

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-5">
        {silhouette && (
          <Silhouette d={silhouette.d} viewBox={silhouette.viewBox} label={silhouetteLabel} />
        )}

        <p className="text-sm text-game-muted">
          Guess {state.guesses.length}/{MAX_GUESSES}
        </p>

        {!over && (
          <CountryAutocomplete
            names={countryData.names}
            excludeCodes={state.guesses}
            onSelect={(code) => void handleSelect(code)}
            label="Guess a country"
          />
        )}

        {state.guesses.length > 0 && (
          <ul className="flex w-full max-w-sm flex-col gap-2">
            {feedbacks.map((fb, i) => (
              <GuessRow key={`${fb.code}-${i}`} feedback={fb} name={nameFor(fb.code, countryData.names)} index={i} />
            ))}
          </ul>
        )}

        {over && !resultOpen && (
          <Button onClick={() => setResultOpen(true)}>{won ? "You got it! 🎉" : "See result"}</Button>
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        {helpContent}
      </HelpModal>

      {over && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={won}
          summary={buildSummary(state, activePuzzle.code, puzzleNumber, countryData.centroids)}
          puzzleNumber={puzzleNumber}
          extraContent={
            <div className="flex items-center justify-center gap-3 text-lg font-semibold">
              <span className={`fi fi-${activePuzzle.code.toLowerCase()} text-2xl`} aria-hidden="true" />
              {nameFor(activePuzzle.code, countryData.names)}
            </div>
          }
          friendsBoardProps={{ sortByScoreAscending: true, formatScore: formatGuesses }}
        />
      )}
    </GameLayout>
  );
}
