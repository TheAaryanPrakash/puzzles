import type { Move, PieceSymbol, Color } from "chess.js";
import { Piece } from "./Piece";

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function capturedBy(history: Move[], capturer: Color): PieceSymbol[] {
  return history.filter((m) => m.color === capturer && m.captured).map((m) => m.captured as PieceSymbol);
}

export interface CapturedPiecesProps {
  history: Move[];
}

/** The pieces each side has captured, plus the material difference (positive favours White). */
export function CapturedPieces({ history }: CapturedPiecesProps) {
  const byWhite = capturedBy(history, "w"); // black pieces White has taken
  const byBlack = capturedBy(history, "b"); // white pieces Black has taken
  const diff = byWhite.reduce((sum, p) => sum + VALUES[p], 0) - byBlack.reduce((sum, p) => sum + VALUES[p], 0);

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <Row pieces={byWhite} color="b" />
      {diff !== 0 && (
        <span className="shrink-0 font-semibold text-game-muted">{diff > 0 ? `+${diff}` : diff}</span>
      )}
      <Row pieces={byBlack} color="w" />
    </div>
  );
}

function Row({ pieces, color }: { pieces: PieceSymbol[]; color: Color }) {
  const sorted = [...pieces].sort((a, b) => VALUES[b] - VALUES[a]);
  return (
    <div className="flex min-h-6 flex-wrap gap-0.5" aria-label={`${sorted.length} pieces captured`}>
      {sorted.map((p, i) => (
        <Piece key={i} type={p} color={color} className="h-5 w-5" />
      ))}
    </div>
  );
}
