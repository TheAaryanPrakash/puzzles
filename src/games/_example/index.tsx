import { useState } from "react";
import "@fontsource/inter/400.css";
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
import { meta } from "./meta";
import { MAX_GUESSES, DEFAULT_STATE, feedbackFor, isOver, isWon, buildSummary } from "./logic";
import type { ExamplePuzzle, ExampleState } from "./logic";

export default function ExampleGame() {
  const { date, puzzle, status } = usePuzzle<ExamplePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<ExampleState>(meta.id, date);
  const [guessInput, setGuessInput] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          <p>Guess the secret number in {MAX_GUESSES} tries.</p>
        </HelpModal>
      </GameLayout>
    );
  }

  const activePuzzle = puzzle; // narrowed once, non-null for the rest of this render + closures
  // See DEFAULT_STATE's comment: merge, don't `??`, so the moment right after start() (state={})
  // doesn't crash the render.
  const state: ExampleState = { ...DEFAULT_STATE, ...play?.state };
  const over = isOver(state, activePuzzle.secret);
  const won = isWon(state, activePuzzle.secret);
  const puzzleNumber = dayIndex(date) + 1;

  async function handleGuess() {
    const value = Number(guessInput);
    if (!Number.isInteger(value) || value < 1 || value > activePuzzle.max) return;
    setGuessInput("");

    if (!play) await start();
    const nextState: ExampleState = { guesses: [...state.guesses, value] };
    save({ state: nextState });

    if (isOver(nextState, activePuzzle.secret)) {
      await finish({
        won: isWon(nextState, activePuzzle.secret),
        state: nextState,
        summary: buildSummary(nextState, activePuzzle.secret, puzzleNumber),
      });
      setResultOpen(true);
    }
  }

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
      {play && play.status !== "in_progress" && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-4">
        <p className="text-game-muted">Guess a number from 1 to {activePuzzle.max}.</p>
        <ul className="flex flex-wrap gap-2">
          {state.guesses.map((g, i) => (
            <li
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-tile border border-game-border bg-game-surface font-game"
            >
              {g}
              <span className="sr-only">{feedbackFor(g, activePuzzle.secret)}</span>
            </li>
          ))}
        </ul>
        {!over && (
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={activePuzzle.max}
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              className="w-24 rounded-brand-sm border border-game-border bg-game-surface p-2 text-center"
              aria-label="Your guess"
            />
            <Button onClick={() => void handleGuess()}>Guess</Button>
          </div>
        )}
        {over && (
          <Button onClick={() => setResultOpen(true)}>
            {won ? "You got it! 🎉" : "See result"}
          </Button>
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <p>
          Guess the secret number between 1 and {activePuzzle.max} in {MAX_GUESSES} tries.
        </p>
      </HelpModal>

      {over && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={won}
          summary={buildSummary(state, activePuzzle.secret, puzzleNumber)}
          puzzleNumber={puzzleNumber}
        />
      )}
    </GameLayout>
  );
}
