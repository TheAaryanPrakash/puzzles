// FROZEN — see CLAUDE.md "Parallel work rules". Only the human changes this file.
// Prop types for every shared component. Prefer optional props and children slots: 13 game
// agents build against this at once and none of them can extend it mid-build.
import type { ReactNode } from "react";
import type { PlayStatus } from "../lib/data/types";

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Rendered after the title, before children (e.g. a subtitle or puzzle number). */
  headerExtra?: ReactNode;
  closeOnBackdropClick?: boolean; // default true
  className?: string;
  labelledBy?: string; // override the element id used for aria-labelledby
}

export interface SiteHeaderProps {
  title?: string; // defaults to the site name
  backTo?: string; // e.g. "/" to return to the Hub; omit to render no back link
  rightSlot?: ReactNode; // e.g. profile avatar, sign-out
}

export interface GameLayoutProps {
  /** meta.id — also set as the `data-game` attribute that theme.css keys off of. */
  game: string;
  title: string;
  onHelp?: () => void;
  onStats?: () => void;
  /** Extra header icons/buttons specific to this game (e.g. "skip to reserve"). */
  headerActions?: ReactNode;
  children: ReactNode;
}

export interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  title?: string; // defaults to "How to play"
  children: ReactNode;
}

export interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  title?: string; // defaults to "Statistics"
  /** Game-specific extra content below the played/won/streak row (e.g. a guess distribution). */
  extraContent?: ReactNode;
}

export interface ResultModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  date: string; // puzzle date, "YYYY-MM-DD"
  won: boolean;
  /** Headline, e.g. "Nice!" / "Next time". Defaults based on `won`. */
  title?: string;
  /** Spoiler-free share text; also what the ShareButton shares. Must never contain the answer. */
  summary: string;
  score?: number;
  puzzleNumber: number; // dayIndex + 1, shown as "#123"
  /** Game-specific result visualization (solved grid, map, etc.) shown above stats. */
  extraContent?: ReactNode;
  /** Extra content for StatsModal's row, e.g. a guess distribution. */
  statsExtraContent?: ReactNode;
  children?: ReactNode;
}

export interface FriendsBoardProps {
  gameId: string;
  date: string;
  /** Custom renderer for a friend's row; defaults to name + status glyph + score. */
  renderEntry?: (entry: {
    name: string;
    status: PlayStatus;
    summary: string;
    score?: number;
  }) => ReactNode;
  emptyMessage?: string;
}

export type KeyState = "correct" | "present" | "absent" | "unused";

export interface KeyboardProps {
  onKey: (key: string) => void;
  /** Per-key visual state. A game with several boards (Quordle) may pass an array of states. */
  keyStates?: Record<string, KeyState | KeyState[]>;
  /** Rows of key labels; special keys use their name ("Enter", "Backspace"). Defaults to QWERTY + Enter/Backspace. */
  layout?: string[][];
  renderKey?: (key: string, state: KeyState | KeyState[] | undefined) => ReactNode;
  disabled?: boolean;
  /** Listen for the physical keyboard too (default true). Off if a game hosts its own listener. */
  physicalKeys?: boolean;
}

export interface ShareButtonProps {
  text: string; // spoiler-free summary; share.ts handles the Web Share API / clipboard fallback
  label?: string; // default "Share"
  sharedLabel?: string; // label shown briefly after a successful copy, default "Copied!"
  className?: string;
}

export interface NextPuzzleCountdownProps {
  label?: string; // default "Next puzzle in"
  className?: string;
}

export interface NoPuzzleTodayProps {
  gameTitle?: string;
  message?: string;
}

export interface ArchivePickerProps {
  gameId: string;
  /** Dates ("YYYY-MM-DD") the member has already played, so they can be marked and disabled. */
  playedDates: string[];
  onSelect: (date: string) => void;
  title?: string;
}

export interface AlreadyPlayedProps {
  status: PlayStatus;
  message?: string;
  children?: ReactNode;
}
