import { Modal } from "./Modal";
import type { HelpModalProps } from "./types";

export function HelpModal({ open, onClose, title = "How to play", children }: HelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3 text-sm leading-relaxed text-game-fg">{children}</div>
    </Modal>
  );
}
