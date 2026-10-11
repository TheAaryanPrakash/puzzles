import { Tile, FLIP_STAGGER, type TileVisualState } from "./Tile";
import { rowFeedback, MAX_GUESSES, WORD_LENGTH } from "../logic";

export interface BoardProps {
  guesses: string[];
  currentGuess: string;
  answer: string;
  /** Index of the row currently playing its flip-reveal animation, or null. */
  revealingRow: number | null;
  onRevealComplete: () => void;
  /** The in-progress (not yet submitted) row should shake — an invalid or hard-mode-rejected guess. */
  shakeCurrentRow: boolean;
}

export function Board({
  guesses,
  currentGuess,
  answer,
  revealingRow,
  onRevealComplete,
  shakeCurrentRow,
}: BoardProps) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => i);

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Game board">
      {rows.map((rowIndex) => {
        const guess = guesses[rowIndex];
        const isCurrentRow = rowIndex === guesses.length;
        const letters = guess ? guess.split("") : isCurrentRow ? currentGuess.split("") : [];
        const feedback = guess ? rowFeedback(guess, answer) : null;
        const isRevealing = rowIndex === revealingRow;
        const lastColumn = WORD_LENGTH - 1;

        return (
          <div key={rowIndex} className="flex gap-1.5">
            {Array.from({ length: WORD_LENGTH }, (_, col) => {
              const letter = letters[col] ?? "";
              const tileState: TileVisualState = feedback ? feedback[col] : letter ? "filled" : "empty";
              return (
                <Tile
                  key={col}
                  letter={letter}
                  state={tileState}
                  flip={isRevealing}
                  delay={col * FLIP_STAGGER}
                  shake={isCurrentRow && shakeCurrentRow}
                  onRevealed={isRevealing && col === lastColumn ? onRevealComplete : undefined}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
