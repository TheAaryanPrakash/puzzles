import type { Direction, MiniClue } from "../logic";

export interface ClueBarProps {
  clue: MiniClue | undefined;
  direction: Direction;
  onPrev: () => void;
  onNext: () => void;
  onToggleDirection: () => void;
}

/** The active clue, with prev/next (steps to the adjacent clue) and a tap target to flip direction. */
export function ClueBar({ clue, direction, onPrev, onNext, onToggleDirection }: ClueBarProps) {
  return (
    <div className="mini-clue-bar">
      <button type="button" onClick={onPrev} aria-label="Previous clue">
        ‹
      </button>
      <button
        type="button"
        className="mini-clue-text"
        onClick={onToggleDirection}
        aria-label="Toggle across/down"
      >
        {clue && (
          <>
            <span className="mini-clue-number">
              {clue.number}
              {direction === "across" ? "A" : "D"}
            </span>
            <span className="mini-clue-label">{clue.clue}</span>
          </>
        )}
      </button>
      <button type="button" onClick={onNext} aria-label="Next clue">
        ›
      </button>
    </div>
  );
}
