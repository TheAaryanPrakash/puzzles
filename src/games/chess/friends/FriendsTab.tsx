import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../../../components/Button";
import { HelpModal } from "../../../components/HelpModal";
import {
  chessDataSource,
  type ChessChallenge,
  type ChessGame,
  type ChessRecordRow,
} from "../../../lib/data/chess";
import { clearChallengeToken, readChallengeToken } from "../../../lib/auth";
import { meta } from "../meta";
import { ChessTabs } from "../components/ChessTabs";
import { GameView } from "./GameView";
import { NewChallengeModal } from "./NewChallengeModal";

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-brand-full text-lg transition-colors duration-brand-fast hover:bg-game-surface-2";

function gameLabel(game: ChessGame): string {
  const opponent = game.myColor === "white" ? game.blackName : game.myColor === "black" ? game.whiteName : null;
  if (!opponent) return `Watching ${game.whiteName} vs ${game.blackName}`;
  if (game.status !== "active") return `Finished · vs ${opponent}`;
  return game.isMyTurn ? `Your turn · vs ${opponent} · move ${Math.ceil((game.ply + 1) / 2)}` : `Waiting for ${opponent}`;
}

export function FriendsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const gameId = searchParams.get("game");

  const [games, setGames] = useState<ChessGame[]>([]);
  const [challenges, setChallenges] = useState<{ outgoing: ChessChallenge[]; incoming: ChessChallenge[] }>({
    outgoing: [],
    incoming: [],
  });
  const [record, setRecord] = useState<ChessRecordRow[]>([]);
  const [newChallengeOpen, setNewChallengeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tokenPreview, setTokenPreview] = useState<{ token: string; creatorName: string } | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    void Promise.all([chessDataSource.listMyGames(), chessDataSource.listMyChallenges(), chessDataSource.myRecord()])
      .then(([g, c, r]) => {
        setGames(g);
        setChallenges(c);
        setRecord(r);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    const token = searchParams.get("challenge") ?? readChallengeToken();
    if (!token) return;
    void chessDataSource.previewChallenge(token).then((preview) => {
      if (preview) setTokenPreview({ token, creatorName: preview.creatorName });
      else clearChallengeToken();
    });
  }, [searchParams]);

  function openGame(id: string) {
    setSearchParams({ tab: "friends", game: id });
  }

  function backToList() {
    setSearchParams({ tab: "friends" });
    refresh();
  }

  async function acceptToken() {
    if (!tokenPreview) return;
    setTokenBusy(true);
    setError(null);
    try {
      const { gameId: newGameId } = await chessDataSource.acceptChallenge({ token: tokenPreview.token });
      clearChallengeToken();
      setTokenPreview(null);
      openGame(newGameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setTokenBusy(false);
    }
  }

  function dismissToken() {
    clearChallengeToken();
    setTokenPreview(null);
  }

  async function accept(id: string) {
    setError(null);
    try {
      const { gameId: newGameId } = await chessDataSource.acceptChallenge({ id });
      openGame(newGameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function decline(id: string) {
    setError(null);
    try {
      await chessDataSource.declineChallenge(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function cancel(id: string) {
    setError(null);
    try {
      await chessDataSource.cancelChallenge(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function rematch(finishedGameId: string) {
    setError(null);
    try {
      await chessDataSource.createRematch(finishedGameId);
      backToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  const overall = record.find((r) => r.opponentId === null);

  return (
    <div data-game={meta.id} className="min-h-screen bg-game-bg font-game text-game-fg">
      <a
        href="#main-content"
        className="sr-only rounded-brand-sm bg-game-accent px-4 py-2 font-semibold text-game-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      {/* grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] + justify-self-*, not flex
          justify-between, and not bare 1fr either — see the same note on
          src/games/chess/index.tsx's header. sticky top-0 for the same reason too: this is the
          only back-to-games-list control while actually viewing a game (GameView's own `onBack`
          is wired to this same backToList, but only ever rendered in its "game not found" branch —
          see that file — so during an active game this header is the only way back, and needs to
          stay reachable without scrolling up past the board/clocks/move list). */}
      <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-game-border bg-game-surface px-3 py-2.5">
        {/* flex justify-start, not justify-self-start — see the other two header comments in this
            file's folder for why. */}
        <div className="flex justify-start">
          {gameId ? (
            <button type="button" onClick={backToList} aria-label="Back to games" className={`${ICON_BUTTON} text-game-fg hover:text-game-accent`}>
              ←
            </button>
          ) : (
            <Link to="/" aria-label="Back to hub" className={`${ICON_BUTTON} text-game-fg hover:text-game-accent`}>
              ←
            </Link>
          )}
        </div>
        <ChessTabs active="friends" />
        <div className="flex items-center justify-end gap-1">
          {!gameId && (
            <button type="button" onClick={() => setNewChallengeOpen(true)} aria-label="New challenge" className={ICON_BUTTON}>
              ➕
            </button>
          )}
          <button type="button" onClick={() => setHelpOpen(true)} aria-label="How to play" className={ICON_BUTTON}>
            ❓
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-6">
        {error && (
          <div role="alert" className="flex w-full max-w-[min(94vw,32rem)] items-center justify-between gap-2 rounded-brand-md bg-game-surface-2 px-3 py-2 text-sm">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {gameId ? (
          <GameView gameId={gameId} onBack={backToList} onRematch={rematch} />
        ) : (
          <>
            {tokenPreview && (
              <div className="w-full max-w-[min(94vw,32rem)] rounded-brand-md border border-game-accent bg-game-surface-2 p-3">
                <p className="text-sm">
                  <strong>{tokenPreview.creatorName}</strong> challenged you to chess.
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={dismissToken}>Dismiss</Button>
                  <Button size="sm" disabled={tokenBusy} onClick={() => void acceptToken()}>Accept</Button>
                </div>
              </div>
            )}

            <Button fullWidth onClick={() => setNewChallengeOpen(true)}>New challenge</Button>

            {loading ? (
              <p className="py-10 text-center text-game-muted">Loading…</p>
            ) : (
              <>
                {challenges.incoming.length > 0 && (
                  <Section title="Incoming challenges">
                    {challenges.incoming.map((c) => (
                      <Row key={c.id}>
                        <span>{c.createdByName} challenged you ({c.creatorSide === "white" ? "you'd be black" : "you'd be white"})</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => void decline(c.id)}>Decline</Button>
                          <Button size="sm" onClick={() => void accept(c.id)}>Accept</Button>
                        </div>
                      </Row>
                    ))}
                  </Section>
                )}

                {challenges.outgoing.length > 0 && (
                  <Section title="Outgoing challenges">
                    {challenges.outgoing.map((c) => (
                      <Row key={c.id}>
                        <span>{c.recipientName ? `Waiting for ${c.recipientName}` : "Link challenge — waiting for someone to accept"}</span>
                        <Button size="sm" variant="ghost" onClick={() => void cancel(c.id)}>Cancel</Button>
                      </Row>
                    ))}
                  </Section>
                )}

                <Section title="Games">
                  {games.length === 0 ? (
                    <p className="w-full py-6 text-center text-sm text-game-muted">No games yet — challenge a friend to start one.</p>
                  ) : (
                    games.map((g) => (
                      <Row key={g.id}>
                        <button type="button" onClick={() => openGame(g.id)} className="flex-1 text-left">
                          {gameLabel(g)}
                        </button>
                      </Row>
                    ))
                  )}
                </Section>

                {overall && (overall.wins > 0 || overall.losses > 0 || overall.draws > 0) && (
                  <div className="w-full max-w-[min(94vw,32rem)] rounded-brand-md border border-game-border bg-game-surface-2 p-3 text-sm">
                    <p className="mb-2 font-semibold text-game-muted">Your record (wins-losses-draws)</p>
                    <p className="tabular-nums">{overall.wins}-{overall.losses}-{overall.draws}</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <NewChallengeModal open={newChallengeOpen} onClose={() => setNewChallengeOpen(false)} onCreated={refresh} />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <p>Play untimed chess by mail against anyone who shares a group with you, or send a link.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>No undo, no hints — just the real game, at whatever pace suits you both.</li>
          <li>Either player can offer or accept a draw at any time; resigning ends the game immediately.</li>
          <li>If your opponent goes quiet for 7 days, you can claim the win.</li>
          <li>Anyone who shares a group with both players can watch a game live, read-only.</li>
          <li>This mode is just for fun — never scored, never affects streaks or the leaderboard.</li>
        </ul>
      </HelpModal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[min(94vw,32rem)] space-y-2">
      <h2 className="text-sm font-semibold text-game-muted">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-brand-md border border-game-border bg-game-surface px-3 py-2 text-sm">
      {children}
    </div>
  );
}
