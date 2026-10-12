import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import { ShareButton } from "../../../components/ShareButton";
import type { Difficulty, EndReason, GameStatus } from "../logic";

// Computer-mode-only and friend-mode-only fields are each optional, and a component only ever
// receives one set fully populated — see the branches in the body below. Generalized rather than
// forked per CLAUDE.md/the task: this stays chess's one result modal for both modes.
export interface GameResultModalProps {
  open: boolean;
  onClose: () => void;
  status: Exclude<GameStatus, "in_progress">;
  reason: EndReason;
  moveCount: number;
  pgn: string;
  /** Computer mode only. */
  difficulty?: Difficulty;
  assisted?: boolean;
  onNewGame?: () => void;
  /** Friend mode only. */
  opponentName?: string;
  onRematch?: () => void;
}

const HEADLINE: Record<Exclude<GameStatus, "in_progress">, string> = {
  won: "You won!",
  lost: "Next time",
  drawn: "Draw",
};

const REASON_LABEL: Record<EndReason, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  threefold: "Draw by threefold repetition",
  "fifty-move": "Draw by the 50-move rule",
  "insufficient-material": "Draw — insufficient material",
  resignation: "Resigned",
  flag: "Out of time",
  "draw-agreement": "Draw by agreement",
  abandoned: "Won by abandonment",
};

/** Chess's own result modal, not the shared ResultModal — see RESEARCH.md's "Chosen design" for
 *  why: the shared one pulls in useStats/FriendsBoard/NextPuzzleCountdown, all DataSource- or
 *  daily-puzzle-coupled in ways chess must never touch. Styled the same way (Modal + Button +
 *  ShareButton, the same stat-tile layout) without those pieces. */
export function GameResultModal({
  open,
  onClose,
  status,
  reason,
  moveCount,
  pgn,
  difficulty,
  assisted,
  onNewGame,
  opponentName,
  onRematch,
}: GameResultModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={HEADLINE[status]}>
      <div className="space-y-4">
        <p className="text-center text-game-muted">{REASON_LABEL[reason]}</p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Moves" value={String(moveCount)} />
          {difficulty ? (
            <>
              <Stat label="Difficulty" value={difficulty} />
              <Stat label="Assisted" value={assisted ? "Yes" : "No"} />
            </>
          ) : (
            <Stat label="Opponent" value={opponentName ?? "?"} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-game-border pt-4">
          <ShareButton text={pgn} label="Copy PGN" />
          {onNewGame ? <Button onClick={onNewGame}>New game</Button> : onRematch ? <Button onClick={onRematch}>Offer rematch</Button> : null}
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand-md bg-game-surface-2 px-2 py-3">
      <div className="font-brand text-sm font-bold capitalize text-game-fg">{value}</div>
      <div className="mt-0.5 text-xs text-game-muted">{label}</div>
    </div>
  );
}
