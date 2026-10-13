import { useState } from "react";
import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import JellyRadio from "../../../components/fx/JellyRadio";
import type { ChessSettings, Difficulty, SideChoice, ClockPreset } from "../logic";

export interface SettingsModalProps {
  open: boolean;
  initial: ChessSettings;
  onClose: () => void;
  onStart: (settings: ChessSettings) => void;
  /** false before any game has ever started — there's nothing yet to cancel back to. */
  canCancel: boolean;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
const SIDES: { value: SideChoice; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "random", label: "Random" },
];
const CLOCKS: { value: ClockPreset; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "3+2", label: "3+2" },
  { value: "5+0", label: "5+0" },
  { value: "10+0", label: "10+0" },
  // chess.com's own default Rapid time control — labeled by name (unlike the others) since that's
  // the recognizable thing about it, not the raw numbers.
  { value: "15+10", label: "Rapid" },
];

export function SettingsModal({ open, initial, onClose, onStart, canCancel }: SettingsModalProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [side, setSide] = useState<SideChoice>(initial.side);
  const [clockPreset, setClockPreset] = useState<ClockPreset>(initial.clockPreset);

  return (
    <Modal
      open={open}
      onClose={canCancel ? onClose : () => {}}
      closeOnBackdropClick={canCancel}
      title={canCancel ? "New game" : "Set up your game"}
    >
      <div className="space-y-5">
        <Picker label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        <Picker label="Play as" options={SIDES} value={side} onChange={setSide} />
        <Picker label="Clock" options={CLOCKS} value={clockPreset} onChange={setClockPreset} />
        <div className="flex justify-end gap-2 pt-2">
          {canCancel && (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button onClick={() => onStart({ difficulty, side, clockPreset })}>Start game</Button>
        </div>
      </div>
    </Modal>
  );
}

// Contrast re-derived against this game's own tokens (src/games/chess/theme.css), not eyeballed:
// --game-fg on --game-surface (unselected chip text) 15.60:1; --game-accent-fg on --game-accent
// (selected chip text, same pair brand.css documents as accentFg-on-accent) 4.66:1 — both pass AA.
function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-game-muted">{label}</p>
      <div className="overflow-x-auto">
        <JellyRadio
          items={options}
          value={value}
          onChange={(v) => onChange(v as T)}
          ariaLabel={label}
          size="sm"
          chipColor="var(--game-surface)"
          activeColor="var(--game-accent)"
          textColor="var(--game-fg)"
          activeTextColor="var(--game-accent-fg)"
        />
      </div>
    </div>
  );
}
