import type { SlotSpring } from "../../../components/fx/useSlotSpring";
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
  /** One shared row of typing springs (by column), driving every board's current row in lockstep —
   *  see index.tsx: the 4 boards show the same in-progress guess, so this is the same array
   *  instance for all of them, not 4 independent springs. */
  typingSlots: SlotSpring[];
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
  typingSlots,
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
            className="rounded-brand-full px-1.5 text-[0.6rem] font-bold"
            style={{
              backgroundColor: `var(--quordle-board-${boardIndex + 1})`,
              // Same fix as logic.ts's BOARD_COLORS_INK (recap badges): these tints are too light
              // for white text to clear 4.5:1 — dark ink instead.
              color: "#1c0f14",
            }}
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
              slotStyle={row.isCurrentRow ? typingSlots[c]?.style : undefined}
            />
          )),
        )}
      </div>
    </div>
  );
}
