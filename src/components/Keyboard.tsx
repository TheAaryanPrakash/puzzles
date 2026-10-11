import { useEffect } from "react";
import type { KeyboardProps, KeyState } from "./types";

const DEFAULT_LAYOUT = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Enter", "Z", "X", "C", "V", "B", "N", "M", "Backspace"],
];

const STATE_CLASSES: Record<KeyState, string> = {
  correct: "bg-tile-correct text-white shadow-brand-sm",
  present: "bg-tile-present text-white shadow-brand-sm",
  absent: "bg-tile-absent text-white",
  unused: "bg-game-surface-2 text-game-fg hover:bg-game-border",
};

const STATE_PRIORITY: KeyState[] = ["correct", "present", "absent", "unused"];

function primaryState(state: KeyState | KeyState[] | undefined): KeyState {
  if (!state) return "unused";
  if (!Array.isArray(state)) return state;
  return STATE_PRIORITY.find((s) => state.includes(s)) ?? "unused";
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  // Belt-and-suspenders over `isContentEditable` (which some test environments don't compute):
  // the nearest `contenteditable` attribute is "true" or "" (an enumerated attribute — the empty
  // string also means true), as opposed to an explicit "false".
  const editableAncestor = target.closest("[contenteditable]");
  return editableAncestor !== null && editableAncestor.getAttribute("contenteditable") !== "false";
}

/** On-screen keyboard that also listens for the physical keyboard (unless `physicalKeys` is false). */
export function Keyboard({
  onKey,
  keyStates,
  layout = DEFAULT_LAYOUT,
  renderKey,
  disabled,
  physicalKeys = true,
}: KeyboardProps) {
  useEffect(() => {
    if (disabled || !physicalKeys) return;
    function onPhysicalKey(e: globalThis.KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "Enter") onKey("Enter");
      else if (e.key === "Backspace") onKey("Backspace");
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    }
    window.addEventListener("keydown", onPhysicalKey);
    return () => window.removeEventListener("keydown", onPhysicalKey);
  }, [onKey, disabled, physicalKeys]);

  return (
    <div className="flex flex-col items-center gap-1.5" role="group" aria-label="Keyboard">
      {layout.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map((key) => {
            const state = keyStates?.[key];
            const wide = key === "Enter" || key === "Backspace";
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onKey(key)}
                aria-label={key}
                className={`flex h-12 min-w-9 touch-manipulation items-center justify-center rounded-brand-sm font-brand text-sm font-semibold uppercase transition-[background-color,transform] duration-brand-fast active:scale-95 disabled:opacity-60 ${wide ? "px-3" : "w-9"} ${STATE_CLASSES[primaryState(state)]}`}
              >
                {renderKey ? renderKey(key, state) : key === "Backspace" ? "⌫" : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
