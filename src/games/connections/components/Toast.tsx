import { AnimatePresence, motion } from "motion/react";

export interface ToastProps {
  message: string | null;
  reduceMotion: boolean;
}

/** Transient "One away…" / "Already guessed!" banner. Not part of game state — never saved. */
export function Toast({ message, reduceMotion }: ToastProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
            transition={{ duration: reduceMotion ? 0.001 : 0.18 }}
            className="rounded-brand-full bg-game-fg px-4 py-2 text-sm font-semibold text-game-bg shadow-lg"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
