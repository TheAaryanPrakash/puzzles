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
import { meta } from "./meta";
import {
  MAX_GUESSES,
  DEFAULT_STATE,
  alreadyGuessed,
  buildSummary,
  feedbackFor,
  hiddenTiles,
  isOver,
  isWon,
} from "./logic";
import type { FlaglePuzzle, FlagleState } from "./logic";
import { useFlagleAssets } from "./useFlagleAssets";
import { FlagTiles } from "./components/FlagTiles";
import { CountryAutocomplete } from "./components/CountryAutocomplete";
import { GuessHistory, type GuessRow } from "./components/GuessHistory";

export default function Flagle() {
  const { date, puzzle, status } = usePuzzle<FlaglePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<FlagleState>(meta.id, date);
  const { options, centroids, loading: assetsLoading } = useFlagleAssets();
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  if (status === "loading" || loading || assetsLoading) return null;

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
  // See DEFAULT_STATE's comment: merge, don't `??`, so the moment right after start() (state={})
  // doesn't crash the render.
  const state: FlagleState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, activePuzzle.code);
  const won = isWon(state, activePuzzle.code);
  const puzzleNumber = dayIndex(date) + 1;

  const rows: GuessRow[] = state.guesses.map((code) => ({
    code,
    option: options.find((o) => o.code === code),
    feedback: feedbackFor(code, activePuzzle.code, centroids),
  }));

  async function handleGuess(code: string) {
    if (over || alreadyGuessed(state, code)) return;
    if (!play) await start();
    const nextState: FlagleState = { guesses: [...state.guesses, code] };
    save({ state: nextState });

    if (isOver(nextState, activePuzzle.code)) {
      await finish({
        won: isWon(nextState, activePuzzle.code),
        state: nextState,
        summary: buildSummary(nextState, activePuzzle.code, puzzleNumber),
        score: isWon(nextState, activePuzzle.code) ? nextState.guesses.length : undefined,
      });
      setResultOpen(true);
    }
  }

  const targetOption = options.find((o) => o.code === activePuzzle.code);

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-sm">
          <FlagTiles code={activePuzzle.code} hidden={hiddenTiles(state, date)} revealed={over} />
        </div>

        <p className="text-sm text-game-muted">
          Guess {state.guesses.length + (over ? 0 : 1)} of {MAX_GUESSES}
        </p>

        {!over && (
          <div className="w-full max-w-sm">
            <CountryAutocomplete
              options={options}
              excludeCodes={state.guesses}
              onGuess={(code) => void handleGuess(code)}
            />
          </div>
        )}

        {over && (
          <Button onClick={() => setResultOpen(true)}>
            {won ? "You got it! 🎉" : "See result"}
          </Button>
        )}

        <div className="w-full max-w-sm">
          <GuessHistory rows={rows} />
        </div>
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
          summary={buildSummary(state, activePuzzle.code, puzzleNumber)}
          score={won ? state.guesses.length : undefined}
          puzzleNumber={puzzleNumber}
          extraContent={
            <div className="flex flex-col items-center gap-2">
              <div className="w-40">
                <FlagTiles code={activePuzzle.code} hidden={[]} revealed />
              </div>
              <p className="font-brand text-lg font-semibold text-game-fg">
                {targetOption?.name ?? activePuzzle.code}
              </p>
            </div>
          }
        />
      )}
    </GameLayout>
  );
}

function HelpContent() {
  return (
    <>
      <p>
        Guess today's flag in {MAX_GUESSES} tries. The flag starts almost entirely covered — every
        wrong guess lifts one more tile.
      </p>
      <p>
        Type a country's name (or its ISO code) and pick it from the list. Each guess shows how far
        away it was, which direction to go, and a closeness percentage — just like Worldle.
      </p>
    </>
  );
}
