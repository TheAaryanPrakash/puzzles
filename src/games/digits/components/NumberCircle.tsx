import { motion, useReducedMotion } from "motion/react";

export interface NumberCircleProps {
  value: number;
  selected?: boolean;
  disabled?: boolean;
  dim?: boolean; // closest-to-target highlight dims everything else
  highlight?: boolean; // the closest-to-target tile
  onClick?: () => void;
  label?: string;
}

/** One pastel number circle — the tap target for selecting an operand. */
export function NumberCircle({
  value,
  selected,
  disabled,
  dim,
  highlight,
  onClick,
  label,
}: NumberCircleProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: dim ? 0.55 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.92 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 30 }
      }
      onClick={onClick}
      disabled={disabled}
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      aria-label={label ?? `Number ${value}`}
      className={`digits-circle flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold shadow-sm transition-colors duration-brand-fast disabled:cursor-not-allowed sm:h-[4.5rem] sm:w-[4.5rem] sm:text-2xl ${
        highlight ? "ring-4 ring-game-accent ring-offset-2 ring-offset-game-surface" : ""
      }`}
    >
      {value}
    </motion.button>
  );
}
