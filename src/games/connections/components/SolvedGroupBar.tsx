import { motion } from "motion/react";
import type { ConnectionsGroup } from "../logic";

const LEVEL_BG = [
  "bg-[var(--connections-level-0-bg)]",
  "bg-[var(--connections-level-1-bg)]",
  "bg-[var(--connections-level-2-bg)]",
  "bg-[var(--connections-level-3-bg)]",
];
const LEVEL_FG = [
  "text-[var(--connections-level-0-fg)]",
  "text-[var(--connections-level-1-fg)]",
  "text-[var(--connections-level-2-fg)]",
  "text-[var(--connections-level-3-fg)]",
];

export interface SolvedGroupBarProps {
  group: ConnectionsGroup;
  /** Stagger index for the entrance animation (solved order, or solved.length + reveal order). */
  index: number;
  reduceMotion: boolean;
}

export function SolvedGroupBar({ group, index, reduceMotion }: SolvedGroupBarProps) {
  return (
    <motion.div
      layout={!reduceMotion}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.001 : 0.3, delay: reduceMotion ? 0 : index * 0.12, ease: "easeOut" }}
      className={`col-span-4 flex flex-col items-center justify-center gap-1 rounded-tile px-2 py-3 text-center font-bold uppercase ${LEVEL_BG[group.level]} ${LEVEL_FG[group.level]}`}
    >
      <span className="text-xs sm:text-sm">{group.label}</span>
      <span className="text-[10px] font-normal tracking-wide opacity-90 sm:text-xs">
        {group.words.join(" · ")}
      </span>
    </motion.div>
  );
}
