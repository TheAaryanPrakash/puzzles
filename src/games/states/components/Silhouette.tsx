import { motion, useReducedMotion } from "motion/react";
import { noSwipeProps } from "../../../lib/noSwipe";

export type SilhouetteStatus = "playing" | "won" | "lost";

export interface SilhouetteProps {
  path: string;
  viewBox: string;
  status: SilhouetteStatus;
  /** Shown as a caption once the puzzle is over; must stay undefined while `status === "playing"`. */
  name?: string;
}

const FILL_VAR: Record<SilhouetteStatus, string> = {
  playing: "var(--states-silhouette)",
  won: "var(--states-silhouette-won)",
  lost: "var(--states-silhouette-lost)",
};

/** The mystery state's own shape, filled with a color that only changes once the puzzle is over —
 *  a quiet "paint fills the outline" reveal rather than a flashy one, so it reads well even under
 *  reduced motion (the color still changes; only the transition's duration drops to ~0). */
export function Silhouette({ path, viewBox, status, name }: SilhouetteProps) {
  const reduceMotion = useReducedMotion();

  return (
    <figure className="mx-auto flex max-w-[280px] flex-col items-center gap-2" {...noSwipeProps}>
      <svg
        viewBox={viewBox}
        className="w-full drop-shadow-sm"
        role="img"
        aria-label={status === "playing" ? "Mystery state or union territory silhouette" : (name ?? "")}
      >
        <motion.path
          d={path}
          initial={false}
          animate={{
            fill: FILL_VAR[status],
            scale: status === "won" ? 1.04 : 1,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.5, ease: [0.22, 1, 0.36, 1], scale: { type: "spring", stiffness: 260, damping: 16 } }
          }
          style={{ transformOrigin: "center" }}
        />
      </svg>
      {name && (
        <motion.figcaption
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.25 }}
          className="font-brand text-lg font-semibold text-game-fg"
        >
          {name}
        </motion.figcaption>
      )}
    </figure>
  );
}
