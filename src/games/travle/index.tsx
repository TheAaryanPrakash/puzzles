import { useState } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
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
import { useCountryGeo } from "./useCountryGeo";
import { Map } from "./components/Map";
import { CountryCombobox } from "./components/CountryCombobox";
import { GuessList } from "./components/GuessList";
import {
  DEFAULT_STATE,
  classifyGuesses,
  isOver,
  isWon,
  rejectReasonFor,
  buildSummary,
  flagEmoji,
  type TravlePuzzle,
  type TravleState,
  type GuessRejectReason,
} from "./logic";

const REJECT_MESSAGE: Record<GuessRejectReason, string> = {
  "unknown-country": "Not a country we recognise — check the spelling?",
  "is-endpoint": "That's already one of the endpoints.",
  duplicate: "Already guessed.",
};

export default function TravleGame() {
  const { date, puzzle, status } = usePuzzle<TravlePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<TravleState>(meta.id, date);
  const { adjacency, features, names, loading: geoLoading } = useCountryGeo();
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

  if (status === "loading" || loading || geoLoading) return null;

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
  // See logic.ts's DEFAULT_STATE comment: merge, don't `??`, so the moment right after start()
  // (state={}) doesn't crash the render.
  const state: TravleState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, activePuzzle, adjacency);
  const won = isWon(state, activePuzzle, adjacency);
  const categories = classifyGuesses(state, activePuzzle, adjacency);
  const puzzleNumber = dayIndex(date) + 1;

  async function handleGuess(code: string) {
    const reason = rejectReasonFor(code, state, activePuzzle);
    if (reason) {
      setRejectMessage(REJECT_MESSAGE[reason]);
      return;
    }
    setRejectMessage(null);

    if (!play) await start();
    const nextState: TravleState = { guesses: [...state.guesses, code] };
    save({ state: nextState });

    if (isOver(nextState, activePuzzle, adjacency)) {
      const nextWon = isWon(nextState, activePuzzle, adjacency);
      await finish({
        won: nextWon,
        state: nextState,
        summary: buildSummary(nextState, activePuzzle, adjacency, puzzleNumber),
        score: nextWon ? nextState.guesses.length : undefined,
      });
      setResultOpen(true);
    }
  }

  const excludeCodes = new Set([activePuzzle.start, activePuzzle.end, ...state.guesses]);

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-brand-md bg-game-surface-2 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="text-xl">
              {flagEmoji(activePuzzle.start)}
            </span>
            {names[activePuzzle.start]?.name ?? activePuzzle.start}
          </span>
          <span aria-hidden className="text-game-muted">
            ➜
          </span>
          <span className="flex items-center gap-2 font-semibold">
            {names[activePuzzle.end]?.name ?? activePuzzle.end}
            <span aria-hidden className="text-xl">
              {flagEmoji(activePuzzle.end)}
            </span>
          </span>
        </div>

        <Map puzzle={activePuzzle} features={features} categories={categories} />

        <p className="text-center text-sm text-game-muted">
          {state.guesses.length} / {activePuzzle.allowedGuesses} guesses used
        </p>

        {!over && (
          <div>
            <CountryCombobox
              countryNames={names}
              excludeCodes={excludeCodes}
              onSubmit={(code) => void handleGuess(code)}
            />
            {rejectMessage && (
              <p role="alert" className="mt-2 text-sm text-brand-danger">
                {rejectMessage}
              </p>
            )}
          </div>
        )}

        <GuessList guesses={state.guesses} categories={categories} countryNames={names} />

        {over && (
          <Button onClick={() => setResultOpen(true)}>
            {won ? "You made it! 🎉" : "See result"}
          </Button>
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
          summary={buildSummary(state, activePuzzle, adjacency, puzzleNumber)}
          score={won ? state.guesses.length : undefined}
          puzzleNumber={puzzleNumber}
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
        Get from the start country to the end country by naming every country you'd pass through,
        in order, travelling by land.
      </p>
      <p>
        Each guess is coloured by how useful it is: <strong>green</strong> means it's part of a
        connected chain back to the start or the end, <strong>orange</strong> means it borders
        another guess but isn't linked up to either end yet, and <strong>red</strong> means it
        isn't connected to anything you've guessed so far.
      </p>
      <p>You win once the start and end are joined by one complete chain — within your guess allowance.</p>
    </>
  );
}
