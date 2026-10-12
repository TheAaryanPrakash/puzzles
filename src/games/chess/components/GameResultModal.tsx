import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import { ShareButton } from "../../../components/ShareButton";
import type { Difficulty, EndReason, GameStatus } from "../logic";

export interface GameResultModalProps {
  open: boolean;
  onClose: () => void;
  status: Exclude<GameStatus, "in_progress">;
  reason: EndReason;
  difficulty: Difficulty;
  moveCount: number;
  assisted: boolean;
  pgn: string;
  onNewGame: () => void;
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
};

/** Chess's own result modal, not the shared ResultModal — see RESEARCH.md's "Chosen design" for
 *  why: the shared one pulls in useStats/FriendsBoard/NextPuzzleCountdown, all DataSource- or
 *  daily-puzzle-coupled in ways chess must never touch. Styled the same way (Modal + Button +
 *  ShareButton, the same stat-tile layout) without those pieces. */
export function GameResultModal({ open, onClose, status, reason, difficulty, moveCount, assisted, pgn, onNewGame }: GameResultModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={HEADLINE[status]}>
      <div className="space-y-4">
        <p className="text-center text-game-muted">{REASON_LABEL[reason]}</p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Moves" value={String(moveCount)} />
          <Stat label="Difficulty" value={difficulty} />
          <Stat label="Assisted" value={assisted ? "Yes" : "No"} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-game-border pt-4">
          <ShareButton text={pgn} label="Copy PGN" />
          <Button onClick={onNewGame}>New game</Button>
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
