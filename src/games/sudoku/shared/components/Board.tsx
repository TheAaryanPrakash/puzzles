import { useEffect, useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { type BoardConfig, type Grid, type NotesGrid, type Highlight, isGiven } from "../engine";

export interface BoardProps {
  /** aria-label for the grid; defaults to "Sudoku board" so sudoku needn't pass it. */
  label?: string;
  config: BoardConfig;
  puzzle: Grid;
  entries: Grid;
  notes: NotesGrid;
  selected: { row: number; col: number } | null;
  onSelect: (row: number, col: number) => void;
  /** Cells to flag as rule violations; pass an empty set when "check mistakes" is off. */
  conflicts: Set<string>;
  highlight: Highlight;
  solved: boolean;
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function Board({
  label = "Sudoku board",
  config,
  puzzle,
  entries,
  notes,
  selected,
  onSelect,
  conflicts,
  highlight,
  solved,
}: BoardProps) {
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduceMotion = useReducedMotion();
  const notesCols = Math.ceil(Math.sqrt(config.size));

  useEffect(() => {
    if (selected) cellRefs.current[cellKey(selected.row, selected.col)]?.focus();
  }, [selected]);

  function move(dr: number, dc: number) {
    const base = selected ?? { row: 0, col: 0 };
    const row = Math.min(config.size - 1, Math.max(0, base.row + dr));
    const col = Math.min(config.size - 1, Math.max(0, base.col + dc));
    onSelect(row, col);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        move(-1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        move(1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        move(0, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        move(0, 1);
        break;
      case "Home":
        e.preventDefault();
        onSelect((selected ?? { row: 0, col: 0 }).row, 0);
        break;
      case "End":
        e.preventDefault();
        onSelect((selected ?? { row: 0, col: 0 }).row, config.size - 1);
        break;
    }
  }

  return (
    <motion.div
      role="grid"
      aria-label={label}
      aria-rowcount={config.size}
      aria-colcount={config.size}
      onKeyDown={handleKeyDown}
      animate={solved && !reduceMotion ? { scale: [1, 1.015, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto grid w-full max-w-[min(92vw,28rem)] gap-[2px] rounded-tile bg-game-border p-[2px]"
      style={{
        gridTemplateColumns: `repeat(${config.size}, 1fr)`,
        gridTemplateRows: `repeat(${config.size}, 1fr)`,
        aspectRatio: "1 / 1",
      }}
    >
      {entries.map((rowVals, row) =>
        rowVals.map((value, col) => {
          const given = isGiven(puzzle, row, col);
          const key = cellKey(row, col);
          const isSelected = selected?.row === row && selected?.col === col;
          const isPeer = highlight.peers.has(key);
          const isSameValue = value !== 0 && highlight.sameValue.has(key);
          const isConflict = conflicts.has(key);
          const boxEdgeRight = (col + 1) % config.boxW === 0 && col !== config.size - 1;
          const boxEdgeBottom = (row + 1) % config.boxH === 0 && row !== config.size - 1;
          const cellNotes = notes[row][col];

          return (
            <motion.button
              key={key}
              ref={(el) => {
                cellRefs.current[key] = el;
              }}
              type="button"
              role="gridcell"
              aria-label={`Row ${row + 1}, column ${col + 1}${
                given ? `, given ${value}` : value !== 0 ? `, your entry ${value}` : ", empty"
              }${isConflict ? ", conflicts with another cell" : ""}`}
              aria-selected={isSelected}
              tabIndex={isSelected || (!selected && row === 0 && col === 0) ? 0 : -1}
              disabled={solved}
              onClick={() => onSelect(row, col)}
              whileTap={given || solved || reduceMotion ? undefined : { scale: 0.92 }}
              transition={{ duration: 0.1 }}
              style={{
                borderRightWidth: boxEdgeRight ? "2.5px" : "0.5px",
                borderBottomWidth: boxEdgeBottom ? "2.5px" : "0.5px",
              }}
              className={[
                "relative flex items-center justify-center border-game-border text-[min(4.2vw,1.35rem)] font-semibold outline-none",
                "focus-visible:ring-2 focus-visible:ring-game-accent focus-visible:ring-offset-1",
                given ? "bg-tile-filled text-tile-fg" : "bg-tile-empty text-game-accent",
                isSelected ? "z-10 ring-2 ring-tile-selected" : "",
                !isSelected && isSameValue ? "bg-game-accent/20" : !isSelected && isPeer ? "bg-game-surface-2" : "",
                isConflict ? "text-brand-danger" : "",
              ].join(" ")}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {value !== 0 ? (
                  <motion.span
                    key={`v-${value}`}
                    initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    {value}
                  </motion.span>
                ) : cellNotes.length > 0 ? (
                  <span
                    className="grid h-full w-full place-items-center gap-0 p-[8%] text-[0.42em] leading-none text-game-muted"
                    style={{ gridTemplateColumns: `repeat(${notesCols}, 1fr)` }}
                    aria-hidden
                  >
                    {cellNotes.map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </span>
                ) : null}
              </AnimatePresence>
            </motion.button>
          );
        }),
      )}
    </motion.div>
  );
}
