import { useEffect, useState } from "react";
import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import { ShareButton } from "../../../components/ShareButton";
import { chessDataSource, type ChessOpponent } from "../../../lib/data/chess";
import type { SideChoice } from "../logic";

export interface NewChallengeModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a challenge or link is successfully created, so the caller can refresh its lists. */
  onCreated: () => void;
}

const SIDE_OPTIONS: { value: SideChoice; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "random", label: "Random" },
];

export function NewChallengeModal({ open, onClose, onCreated }: NewChallengeModalProps) {
  const [opponents, setOpponents] = useState<ChessOpponent[]>([]);
  const [side, setSide] = useState<SideChoice>("random");
  const [recipientId, setRecipientId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLinkUrl(null);
    setRecipientId("");
    void chessDataSource.listOpponents().then(setOpponents);
  }, [open]);

  async function challenge(targetRecipientId: string | undefined) {
    setError(null);
    setLoading(true);
    try {
      const { token } = await chessDataSource.createChallenge({ recipientId: targetRecipientId, side });
      if (!targetRecipientId && token) {
        setLinkUrl(`${window.location.origin}/chess?challenge=${encodeURIComponent(token)}`);
      } else {
        onCreated();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (linkUrl) onCreated(); // a link challenge was created even though the modal is closing from here
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="New challenge">
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-brand-danger">{error}</p>}

        {linkUrl ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-game-muted">Share this link — anyone signed in but you can accept it.</p>
            <p className="break-all rounded-brand-md bg-game-surface-2 px-3 py-2 text-xs">{linkUrl}</p>
            <div className="flex justify-center gap-2">
              <ShareButton text={linkUrl} label="Copy link" />
              <Button variant="ghost" onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="space-y-1">
              <legend className="text-sm font-semibold text-game-fg">Your side</legend>
              <div className="flex gap-2">
                {SIDE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={side === opt.value ? "primary" : "secondary"}
                    onClick={() => setSide(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-game-fg">Challenge a friend</p>
              {opponents.length === 0 ? (
                <p className="text-sm text-game-muted">Nobody in your groups yet — you can still make a link below.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {opponents.map((o) => (
                    <li key={o.userId}>
                      <button
                        type="button"
                        onClick={() => setRecipientId(o.userId)}
                        className={`flex w-full items-center justify-between rounded-brand-md border px-3 py-2 text-left text-sm transition-colors duration-brand-fast ${recipientId === o.userId ? "border-game-accent bg-game-surface-2" : "border-game-border hover:bg-game-surface-2"}`}
                      >
                        <span>{o.displayName}</span>
                        <span className="text-xs text-game-muted">{o.groupName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button fullWidth disabled={!recipientId || loading} onClick={() => void challenge(recipientId)}>
                Send challenge
              </Button>
            </div>

            <div className="border-t border-game-border pt-4">
              <Button variant="secondary" fullWidth disabled={loading} onClick={() => void challenge(undefined)}>
                Make a link instead
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
