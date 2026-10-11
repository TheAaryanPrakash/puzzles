import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface InvalidWordToastProps {
  message: string | null;
}

/** A brief toast above the board, e.g. "Not in word list" or a hard-mode violation message. */
export function InvalidWordToast({ message }: InvalidWordToastProps) {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-brand-sm bg-game-fg px-4 py-2 text-sm font-semibold text-game-bg shadow-lg"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
