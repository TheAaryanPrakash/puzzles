import { useState } from "react";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/700.css";
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
  DEFAULT_STATE,
  appendGuess,
  buildSummary,
  closestSoFar,
  colorForGuess,
  hasGuessed,
  isOver,
  UNGUESSED_COLOR,
  type GloblePuzzle,
  type GlobleState,
} from "./logic";
import { useWorldData } from "./worldData";
import { Globe } from "./components/Globe";
import { GuessInput } from "./components/GuessInput";
import { GuessList } from "./components/GuessList";

const HELP_CONTENT = (
  <>
    <p>A new country is hidden every day — everyone sees the same one.</p>
    <p>
      Guess any country. The globe colors it in by how close its <strong>border</strong> is to
      the secret country's border — pale for far, deep red for close. Two countries that share a
      land border always score as close as it gets.
    </p>
    <p>Unlimited guesses. Keep going until you find it — your closest guess so far is tracked below.</p>
  </>
);

export default function GlobleGame() {
  const { date, puzzle, status } = usePuzzle<GloblePuzzle>(meta.id);
  const { play, loading: playLoading, start, save, finish } = usePlay<GlobleState>(meta.id, date);
  const { status: worldStatus, data: world } = useWorldData();
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  if (status === "loading" || playLoading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          {HELP_CONTENT}
        </HelpModal>
      </GameLayout>
    );
  }

  const activePuzzle = puzzle; // narrowed once, non-null for the rest of this render + closures
  // See DEFAULT_STATE's comment: merge, don't `??`, so the moment right after start() (state={})
  // doesn't crash the render.
  const state: GlobleState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, activePuzzle.code);
  const puzzleNumber = dayIndex(date) + 1;
  const sorted = closestSoFar(state);
  const guessedCodes = new Set(state.guesses.map((g) => g.code));

  async function handleGuess(code: string) {
    if (!world || hasGuessed(state, code)) return;
    if (!play) await start();
    const km = world.distanceKm(code, activePuzzle.code);
    const nextState = appendGuess(state, { code, km });
    if (nextState === state) return;
    save({ state: nextState });

    if (isOver(nextState, activePuzzle.code)) {
      await finish({
        won: true,
        state: nextState,
        summary: buildSummary(nextState, activePuzzle.code, puzzleNumber),
        score: nextState.guesses.length,
      });
      setResultOpen(true);
    }
  }

  function fillForCode(code: string): string {
    const guess = state.guesses.find((g) => g.code === code);
    if (!guess) return UNGUESSED_COLOR;
    return colorForGuess(guess, activePuzzle.code);
  }

  const secretName = world?.names[activePuzzle.code]?.name;

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-6">
        {worldStatus === "error" && (
          <p className="text-sm text-game-muted">
            Couldn't load the globe's map data. Try refreshing the page.
          </p>
        )}

        {world ? (
          <Globe countries={world.countries} fillForCode={fillForCode} />
        ) : (
          <div className="flex aspect-square w-full max-w-[520px] items-center justify-center text-game-muted">
            Loading the globe…
          </div>
        )}

        {!over && world && (
          <GuessInput
            codes={world.codes}
            names={world.names}
            guessedCodes={guessedCodes}
            onGuess={(code) => void handleGuess(code)}
          />
        )}

        {over && (
          <Button onClick={() => setResultOpen(true)}>
            Solved in {state.guesses.length} {state.guesses.length === 1 ? "guess" : "guesses"} 🎉
          </Button>
        )}

        {world && <GuessList guesses={sorted} names={world.names} secretCode={activePuzzle.code} />}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        {HELP_CONTENT}
      </HelpModal>

      {over && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won
          summary={buildSummary(state, activePuzzle.code, puzzleNumber)}
          score={state.guesses.length}
          puzzleNumber={puzzleNumber}
          extraContent={
            secretName && (
              <div className="flex items-center justify-center gap-3 rounded-brand-md bg-game-surface-2 p-4">
                <span
                  aria-hidden
                  className={`fi fi-${activePuzzle.code.toLowerCase()} rounded-brand-sm text-2xl`}
                />
                <p className="font-brand text-lg">
                  It was <strong>{secretName}</strong>!
                </p>
              </div>
            )
          }
        />
      )}
    </GameLayout>
  );
}
