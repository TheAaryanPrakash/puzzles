export interface HardModeToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Locked once the first guess is in — hard mode is fixed for the rest of the play. */
  locked: boolean;
}

export function HardModeToggle({ checked, onChange, locked }: HardModeToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-game-muted">
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(e) => {
          onChange(e.target.checked);
          // The shared Keyboard component ignores physical keystrokes while focus sits on any
          // <input> (it can't tell this one apart from a real text field) — blur so typing the
          // first guess works right away, without an extra click elsewhere first.
          e.target.blur();
        }}
        className="h-4 w-4 accent-game-accent disabled:cursor-not-allowed"
      />
      Hard Mode
      {locked && <span className="sr-only"> (locked after your first guess)</span>}
    </label>
  );
}
