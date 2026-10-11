import { Keyboard } from "../../../components/Keyboard";
import type { KeyState } from "../../../components/types";

interface QuordleKeyboardProps {
  onKey: (key: string) => void;
  keyStates: Record<string, KeyState[]>;
  disabled: boolean;
}

const QUAD_CLASS: Record<KeyState, string> = {
  correct: "bg-tile-correct",
  present: "bg-tile-present",
  absent: "bg-tile-absent",
  unused: "bg-game-surface-2",
};

/**
 * Renders each letter key as a 2x2 grid of quadrants — one per board, in board order — so the
 * keyboard mirrors the four boards above it (the "quadrant keyboard" from the task's research
 * focus). Enter/Backspace fall back to plain text since `keyStates` never covers them.
 */
function renderQuadrantKey(key: string, state: KeyState | KeyState[] | undefined) {
  if (key === "Backspace") return <span aria-hidden>⌫</span>;
  if (key === "Enter") return <span aria-hidden>Enter</span>;
  if (!Array.isArray(state)) return <span aria-hidden>{key}</span>;

  return (
    <span className="relative grid h-full w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-[0.3rem] bg-game-border">
      {state.map((s, i) => (
        <span key={i} aria-hidden className={QUAD_CLASS[s]} />
      ))}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-brand-full bg-game-surface px-1 text-[0.65rem] font-bold leading-tight text-game-fg shadow-sm">
          {key}
        </span>
      </span>
    </span>
  );
}

export function QuordleKeyboard({ onKey, keyStates, disabled }: QuordleKeyboardProps) {
  return (
    <Keyboard onKey={onKey} keyStates={keyStates} disabled={disabled} renderKey={renderQuadrantKey} />
  );
}
