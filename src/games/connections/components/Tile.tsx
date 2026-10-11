import { motion } from "motion/react";

export interface TileProps {
  word: string;
  selected: boolean;
  disabled: boolean;
  shake: boolean;
  reduceMotion: boolean;
}

export function Tile({ word, selected, disabled, shake, reduceMotion, onClick }: TileProps & { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      layout={!reduceMotion && !shake}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      animate={shake && !reduceMotion ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
      transition={
        shake && !reduceMotion
          ? { duration: 0.32, ease: "easeInOut" }
          : { layout: { type: "spring", stiffness: 500, damping: 32 } }
      }
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.85 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      className={`flex h-16 items-center justify-center rounded-tile border-2 px-1 text-center text-[11px] font-bold uppercase tracking-wide sm:text-sm ${
        selected
          ? "border-game-fg bg-game-fg text-game-bg"
          : "border-game-border bg-tile-filled text-tile-fg hover:border-game-accent"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {word}
    </motion.button>
  );
}
