import { MAX_GUESSES, WORD_LENGTH, scoreForBoard } from "../logic";
import { Tile } from "./Tile";

interface BoardProps {
  answer: string;
  /** This board's own visible guesses — already frozen at the solving guess, if solved. */
  guesses: string[];
  currentGuess: string;
  /** Still unsolved and the game isn't over — shows the in-progress typed row. */
  active: boolean;
  solvedAt: number | null;
  /** 0-3, picks this board's accent tint (--quordle-board-1..4) and its share-grid position. */
  boardIndex: number;
  shake: boolean;
  reducedMotion: boolean;
}

export function Board({
  answer,
  guesses,
  currentGuess,
  active,
  solvedAt,
  boardIndex,
  shake,
  reducedMotion,
}: BoardProps) {
  const rows: { letters: string; scored: ReturnType<typeof scoreForBoard> | null; isCurrentRow: boolean }[] =
    guesses.map((guess) => ({ letters: guess, scored: scoreForBoard(guess, answer), isCurrentRow: false }));
  if (active) rows.push({ letters: currentGuess, scored: null, isCurrentRow: true });
  while (rows.length < MAX_GUESSES) rows.push({ letters: "", scored: null, isCurrentRow: false });

  return (
    <div
      className={`rounded-brand-sm border-2 bg-game-surface p-1 transition-opacity duration-brand-base sm:p-1.5 ${
        solvedAt !== null ? "opacity-60" : ""
      }`}
      style={{ borderColor: `var(--quordle-board-${boardIndex + 1})` }}
      data-board={boardIndex}
    >
      <div className="mb-0.5 flex h-4 items-center justify-center">
        {solvedAt !== null && (
          <span
            className="rounded-brand-full px-1.5 text-[0.6rem] font-bold text-white"
            style={{ backgroundColor: `var(--quordle-board-${boardIndex + 1})` }}
          >
            Solved in {solvedAt}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-[var(--quordle-tile-gap)]">
        {rows.map((row, r) =>
          Array.from({ length: WORD_LENGTH }).map((_, c) => (
            <Tile
              key={`${r}-${c}`}
              letter={row.letters[c] ?? ""}
              state={row.scored?.[c] ?? null}
              isCurrentRow={row.isCurrentRow}
              shake={row.isCurrentRow && shake}
              reducedMotion={reducedMotion}
              column={c}
            />
          )),
        )}
      </div>
    </div>
  );
}
