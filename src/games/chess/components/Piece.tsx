import type { PieceSymbol, Color } from "chess.js";

export interface PieceProps {
  type: PieceSymbol;
  color: Color;
  draggable?: boolean;
  dragging?: boolean;
  className?: string;
}

/** Renders one of the 12 RhosGFX SVGs (public/assets/chess/pieces/, CC0) by piece/colour code. */
export function Piece({ type, color, draggable = false, dragging = false, className = "" }: PieceProps) {
  const code = `${color}${type.toUpperCase()}`;
  return (
    <img
      src={`/assets/chess/pieces/${code}.svg`}
      alt=""
      draggable={false}
      className={`chess-piece ${className}`}
      data-draggable={draggable}
      data-dragging={dragging}
    />
  );
}
