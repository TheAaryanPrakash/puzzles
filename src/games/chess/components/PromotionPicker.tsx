import type { Color, PieceSymbol } from "chess.js";
import { Modal } from "../../../components/Modal";
import { Piece } from "./Piece";

const CHOICES: PieceSymbol[] = ["q", "r", "b", "n"];
const NAMES: Record<PieceSymbol, string> = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "", k: "" };

export interface PromotionPickerProps {
  open: boolean;
  color: Color;
  onChoose: (piece: PieceSymbol) => void;
  onCancel: () => void;
}

/** chess.js lists one legal move per promotion choice for the same from/to — this is shown
 *  whenever a pawn move resolves to more than one of those. The engine always auto-promotes to
 *  its own choice (never shown this picker). */
export function PromotionPicker({ open, color, onChoose, onCancel }: PromotionPickerProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Promote to">
      <div className="grid grid-cols-4 gap-3">
        {CHOICES.map((piece) => (
          <button
            key={piece}
            type="button"
            autoFocus={piece === "q"}
            onClick={() => onChoose(piece)}
            aria-label={`Promote to ${NAMES[piece]}`}
            className="flex flex-col items-center gap-1 rounded-brand-md border border-game-border bg-game-surface-2 p-3 transition-colors duration-brand-fast hover:border-game-accent"
          >
            <Piece type={piece} color={color} className="h-10 w-10" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
