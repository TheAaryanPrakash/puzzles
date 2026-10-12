import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./theme.css";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { useAuth } from "../../lib/auth";
import { celebrate } from "../../lib/celebrate";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { HelpModal } from "../../components/HelpModal";
import { meta } from "./meta";
import { Board, FILES } from "./components/Board";
import { Clock } from "./components/Clock";
import { MoveList } from "./components/MoveList";
import { CapturedPieces } from "./components/CapturedPieces";
import { PromotionPicker } from "./components/PromotionPicker";
import { SettingsModal } from "./components/SettingsModal";
import { GameResultModal } from "./components/GameResultModal";
import { ChessEngine } from "./lib/engine";
import { ChessTabs } from "./components/ChessTabs";
import { loadGame, saveGame, loadSettings, saveSettings, loadRecord, recordResult, type PersonalRecord } from "./lib/storage";
import {
  createFreshGame,
  markAssisted,
  canUndo,
  undoLastRound,
  classifyEnd,
  engineOptionsFor,
  pickEngineMove,
  tickClock,
  applyIncrement,
  isFlagged,
  flagOutcome,
  kingSquare,
  VARIETY_ENGINE_MOVES,
  type ChessSettings,
  type GameState,
  type GameStatus,
  type GameResult,
  type Side,
} from "./logic";
import { FriendsTab } from "./friends/FriendsTab";

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-brand-full text-lg transition-colors duration-brand-fast hover:bg-game-surface-2";

function ComputerTab() {
  const { member } = useAuth();
  const userId = member?.userId ?? "local-dev";

  const [settings, setSettings] = useState<ChessSettings>(() => loadSettings(userId));
  const [game, setGame] = useState<GameState | null>(() => loadGame(userId));
  const [record, setRecord] = useState<PersonalRecord>(() => loadRecord(userId));

  const [selected, setSelected] = useState<Square | null>(null);
  const [cursorSquare, setCursorSquare] = useState<Square | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [thinking, setThinking] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(() => loadGame(userId) === null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(Boolean(game && game.status !== "in_progress"));
  const [resignConfirmOpen, setResignConfirmOpen] = useState(false);

  const engineRef = useRef<ChessEngine | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  function getEngine(): ChessEngine {
    if (!engineRef.current) engineRef.current = new ChessEngine();
    return engineRef.current;
  }

  useEffect(() => {
    return () => engineRef.current?.terminate();
  }, []);

  // ───── derived, read-only view of the current position ─────
  const chess = useMemo(() => {
    const c = new Chess();
    if (game) c.loadPgn(game.pgn);
    return c;
  }, [game?.pgn]);

  const isPlayerTurn = Boolean(game) && chess.turn() === (game!.playerSide === "white" ? "w" : "b");
  const interactive =
    Boolean(game) &&
    game!.status === "in_progress" &&
    isPlayerTurn &&
    !thinking &&
    !pendingPromotion &&
    !resultOpen &&
    !settingsOpen &&
    !resignConfirmOpen;

  const legalTargets = selected ? chess.moves({ square: selected, verbose: true }).map((m) => m.to) : [];
  const checkSquare = chess.isCheck() ? kingSquare(chess, chess.turn()) : null;
  const historyVerbose = chess.history({ verbose: true });
  const lastMove =
    historyVerbose.length > 0
      ? { from: historyVerbose[historyVerbose.length - 1].from, to: historyVerbose[historyVerbose.length - 1].to }
      : null;
  const hintSquares = hintMove ? new Set<Square>([hintMove.from, hintMove.to]) : undefined;

  const playerMs = game?.clock ? (game.playerSide === "white" ? game.clock.whiteMs : game.clock.blackMs) : null;
  const opponentMs = game?.clock ? (game.playerSide === "white" ? game.clock.blackMs : game.clock.whiteMs) : null;

  // ───── committing a move (player or engine) ─────
  // `baseGame` is the state the caller started from — for an engine move, that's a snapshot taken
  // *before* `await engine.go(...)`, which can run for up to 1200ms. The clock interval keeps
  // ticking (via its own setGame calls) during that wait, so `baseGame.clock` can be stale by the
  // time this runs. Merging against `gameRef.current` (kept current by that same interval) instead
  // of `baseGame` means this doesn't clobber those ticks — only the increment is actually new here.
  function commitMove(c: Chess, moveResult: Move, baseGame: GameState, options: { isEngine: boolean }) {
    const current = gameRef.current ?? baseGame;
    const mover: Side = moveResult.color === "w" ? "white" : "black";
    const clock = current.clock ? applyIncrement(current.clock, mover) : null;
    const engineMoveCount = options.isEngine ? baseGame.engineMoveCount + 1 : baseGame.engineMoveCount;
    const end = classifyEnd(c, baseGame.playerSide);
    const status: GameStatus = end?.status ?? "in_progress";
    const next: GameState = { ...current, fen: c.fen(), pgn: c.pgn(), clock, engineMoveCount, status, result: end ?? undefined };

    setGame(next);
    saveGame(userId, next);
    setHintMove(null);

    if (status !== "in_progress") {
      settleGame(next);
    } else if (!options.isEngine) {
      void maybeTriggerEngine(next);
    }
  }

  function settleGame(ended: GameState) {
    if (!ended.result) return;
    setRecord(recordResult(userId, ended.settings.difficulty, ended.result.status, ended.assisted));
    if (ended.result.status === "won") celebrate();
    setResultOpen(true);
  }

  function isEngineTurnFor(g: GameState): boolean {
    const c = new Chess();
    c.loadPgn(g.pgn);
    const sideToMove: Side = c.turn() === "w" ? "white" : "black";
    return sideToMove !== g.playerSide;
  }

  async function maybeTriggerEngine(g: GameState) {
    if (g.status !== "in_progress" || !isEngineTurnFor(g)) return;
    await runEngineMove(g);
  }

  async function runEngineMove(g: GameState) {
    setThinking(true);
    try {
      const engine = getEngine();
      await engine.ready();
      const c = new Chess();
      c.loadPgn(g.pgn);
      const engineColor = c.turn();
      const remainingMs = g.clock ? (engineColor === "w" ? g.clock.whiteMs : g.clock.blackMs) : null;
      const options = engineOptionsFor(g.settings.difficulty, remainingMs);
      await engine.setOptions(options);
      const multipv = g.engineMoveCount < VARIETY_ENGINE_MOVES ? 4 : 1;
      const candidates = await engine.go({ fen: g.fen, movetimeMs: options.movetimeMs, multipv });
      const picked = pickEngineMove(candidates, options.marginCp, g.engineMoveCount);
      const from = picked.move.slice(0, 2) as Square;
      const to = picked.move.slice(2, 4) as Square;
      const promotion = picked.move.length > 4 ? (picked.move[4] as PieceSymbol) : undefined;
      const applied = c.move({ from, to, promotion });
      commitMove(c, applied, g, { isEngine: true });
    } finally {
      setThinking(false);
    }
  }

  // Resume an in-progress, restored game if it's the engine's move (e.g. the tab closed between
  // the player's move and the engine's reply) — runs once, against the game loaded at mount.
  useEffect(() => {
    if (game) void maybeTriggerEngine(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPlayerMove(move: Move) {
    if (!game) return;
    const c = new Chess();
    c.loadPgn(game.pgn);
    const applied = c.move({ from: move.from, to: move.to, promotion: move.promotion });
    setSelected(null);
    commitMove(c, applied, game, { isEngine: false });
  }

  function attemptMove(from: Square, to: Square) {
    if (!game || !interactive) return;
    const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (candidates.length === 0) {
      setSelected(null);
      return;
    }
    if (candidates.length > 1) {
      setPendingPromotion({ from, to });
      return;
    }
    applyPlayerMove(candidates[0]);
  }

  function activateSquare(square: Square) {
    if (!game || !interactive) return;
    if (selected === square) {
      setSelected(null);
      return;
    }
    if (selected && chess.moves({ square: selected, verbose: true }).some((m) => m.to === square)) {
      attemptMove(selected, square);
      return;
    }
    const piece = chess.get(square);
    const myColor = game.playerSide === "white" ? "w" : "b";
    setSelected(piece && piece.color === myColor && chess.turn() === myColor ? square : null);
  }

  function resolvePromotion(piece: PieceSymbol) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    const move = chess.moves({ square: from, verbose: true }).find((m) => m.to === to && m.promotion === piece);
    setPendingPromotion(null);
    if (move) applyPlayerMove(move);
  }

  function handleUndo() {
    if (!game || !canUndo(game)) return;
    const popped = undoLastRound(game);
    if (!popped) return;
    const next: GameState = { ...markAssisted(game), fen: popped.fen, pgn: popped.pgn, engineMoveCount: Math.max(0, game.engineMoveCount - 1) };
    setGame(next);
    saveGame(userId, next);
    setSelected(null);
    setHintMove(null);
  }

  async function handleHint() {
    if (!game || thinking || game.status !== "in_progress") return;
    setThinking(true);
    try {
      const engine = getEngine();
      await engine.ready();
      await engine.setOptions({ skillLevel: 20, limitStrength: false });
      const candidates = await engine.go({ fen: game.fen, movetimeMs: 1200, multipv: 1 });
      const best = candidates[0];
      if (best) setHintMove({ from: best.move.slice(0, 2) as Square, to: best.move.slice(2, 4) as Square });
      const marked = markAssisted(game);
      setGame(marked);
      saveGame(userId, marked);
    } finally {
      setThinking(false);
    }
  }

  function handleResign() {
    if (!game || game.status !== "in_progress") return;
    const result: GameResult = { status: "lost", reason: "resignation" };
    const next: GameState = { ...game, status: "lost", result };
    setGame(next);
    saveGame(userId, next);
    setResignConfirmOpen(false);
    settleGame(next);
  }

  function handleStartGame(newSettings: ChessSettings) {
    saveSettings(userId, newSettings);
    setSettings(newSettings);
    const fresh = createFreshGame(newSettings);
    setGame(fresh);
    saveGame(userId, fresh);
    setSelected(null);
    setCursorSquare(null);
    setHintMove(null);
    setSettingsOpen(false);
    setResultOpen(false);
    void maybeTriggerEngine(fresh);
  }

  // ───── the running clock ─────
  useEffect(() => {
    if (!game?.clock || game.status !== "in_progress") return;
    let last = Date.now();
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g?.clock || g.status !== "in_progress") return;
      const now = Date.now();
      if (document.visibilityState === "hidden") {
        last = now;
        return;
      }
      const elapsed = now - last;
      last = now;
      const c = new Chess();
      c.loadPgn(g.pgn);
      const mover: Side = c.turn() === "w" ? "white" : "black";
      const clock = tickClock(g.clock, mover, elapsed);
      if (isFlagged(clock, mover)) {
        const outcome = flagOutcome(c);
        const status: GameStatus = outcome === "draw" ? "drawn" : mover === g.playerSide ? "lost" : "won";
        const next: GameState = { ...g, clock, status, result: { status, reason: "flag" } };
        setGame(next);
        saveGame(userId, next);
        settleGame(next);
        return;
      }
      const next: GameState = { ...g, clock };
      setGame(next);
      saveGame(userId, next);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(game?.clock), game?.status, userId]);

  // ───── full physical-keyboard board navigation ─────
  useEffect(() => {
    function moveCursorVisual(dxScreen: number, dyScreen: number) {
      if (!game) return;
      const base = cursorSquare ?? ("e4" as Square);
      const fileIdx = FILES.indexOf(base[0] as (typeof FILES)[number]);
      const rank = Number(base[1]);
      const flip = game.playerSide === "black";
      const dFile = flip ? -dxScreen : dxScreen;
      const dRank = flip ? dyScreen : -dyScreen;
      const newFile = Math.min(7, Math.max(0, fileIdx + dFile));
      const newRank = Math.min(8, Math.max(1, rank + dRank));
      setCursorSquare(`${FILES[newFile]}${newRank}` as Square);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!game || document.querySelector('[role="dialog"]')) return;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveCursorVisual(0, -1);
          return;
        case "ArrowDown":
          e.preventDefault();
          moveCursorVisual(0, 1);
          return;
        case "ArrowLeft":
          e.preventDefault();
          moveCursorVisual(-1, 0);
          return;
        case "ArrowRight":
          e.preventDefault();
          moveCursorVisual(1, 0);
          return;
        case "Enter":
        case " ":
          e.preventDefault();
          if (cursorSquare) activateSquare(cursorSquare);
          return;
        case "Escape":
          e.preventDefault();
          setSelected(null);
          return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const moveCount = Math.ceil(historyVerbose.length / 2);

  return (
    <div data-game={meta.id} className="min-h-screen bg-game-bg font-game text-game-fg">
      <a
        href="#main-content"
        className="sr-only rounded-brand-sm bg-game-accent px-4 py-2 font-semibold text-game-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <header className="flex items-center justify-between border-b border-game-border bg-game-surface px-3 py-2.5">
        <Link to="/" aria-label="Back to hub" className={`${ICON_BUTTON} text-game-fg hover:text-game-accent`}>
          ←
        </Link>
        <ChessTabs active="computer" />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="New game" className={ICON_BUTTON}>
            🔄
          </button>
          <button type="button" onClick={() => setHelpOpen(true)} aria-label="How to play" className={ICON_BUTTON}>
            ❓
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-6">
        {game && (
          <>
            {game.clock && opponentMs !== null && <Clock ms={opponentMs} active={!isPlayerTurn} label="Computer" />}

            <Board
              fen={game.fen}
              orientation={game.playerSide}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              checkSquare={checkSquare}
              cursorSquare={cursorSquare}
              hintSquares={hintSquares}
              interactive={interactive}
              onActivateSquare={activateSquare}
              onAttemptMove={attemptMove}
            />

            {game.clock && playerMs !== null && <Clock ms={playerMs} active={isPlayerTurn} label="You" />}

            <p className="h-5 text-sm text-game-muted" aria-live="polite">
              {thinking ? "Computer is thinking…" : " "}
            </p>

            <CapturedPieces history={historyVerbose} />

            <div className="flex w-full max-w-[min(94vw,32rem)] flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleUndo} disabled={!canUndo(game)}>
                Undo
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void handleHint()} disabled={thinking || game.status !== "in_progress"}>
                Hint
              </Button>
              <Button variant="danger" size="sm" onClick={() => setResignConfirmOpen(true)} disabled={game.status !== "in_progress"}>
                Resign
              </Button>
            </div>

            <div className="w-full max-w-[min(94vw,32rem)]">
              <MoveList sanMoves={chess.history()} />
            </div>

            <RecordSummary record={record} />
          </>
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        initial={settings}
        canCancel={Boolean(game)}
        onClose={() => setSettingsOpen(false)}
        onStart={handleStartGame}
      />

      <PromotionPicker
        open={Boolean(pendingPromotion)}
        color={game?.playerSide === "white" ? "w" : "b"}
        onChoose={resolvePromotion}
        onCancel={() => {
          setPendingPromotion(null);
          setSelected(null);
        }}
      />

      {game && game.result && (
        <GameResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          status={game.status as Exclude<GameStatus, "in_progress">}
          reason={game.result.reason}
          difficulty={game.settings.difficulty}
          moveCount={moveCount}
          assisted={game.assisted}
          pgn={chess.pgn()}
          onNewGame={() => setSettingsOpen(true)}
        />
      )}

      <Modal open={resignConfirmOpen} onClose={() => setResignConfirmOpen(false)} title="Resign this game?">
        <div className="space-y-4">
          <p className="text-sm text-game-muted">This counts as a loss in your personal record.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResignConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleResign}>
              Resign
            </Button>
          </div>
        </div>
      </Modal>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <p>Play a full game of chess against the computer — tap or drag a piece to move it.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Full rules: castling, en passant, promotion, check, checkmate, stalemate, threefold repetition, the 50-move rule and insufficient material.</li>
          <li><strong>Undo</strong> takes back your last move and the computer's reply — unlimited with no clock, off once one's running.</li>
          <li><strong>Hint</strong> shows the computer's best move for you, unlimited. Using either marks the game "assisted" in your record.</li>
          <li>Arrow keys move a square cursor; Enter/Space selects and drops a piece; Esc cancels a selection.</li>
          <li>This game is just for fun — it's never scored, never affects streaks or the leaderboard, and isn't shared with friends.</li>
        </ul>
        <p className="text-xs text-game-muted">
          Engine: Stockfish (GPLv3),{" "}
          <a href="https://github.com/nmrugg/stockfish.js" className="underline" target="_blank" rel="noreferrer">
            source
          </a>
          . Pieces by{" "}
          <a href="https://rhosgfx.itch.io/vector-chess-pieces" className="underline" target="_blank" rel="noreferrer">
            RhosGFX
          </a>{" "}
          (CC0).
        </p>
      </HelpModal>
    </div>
  );
}

function RecordSummary({ record }: { record: PersonalRecord }) {
  const assistedTotal = (["easy", "medium", "hard"] as const).reduce(
    (sum, d) => sum + record.assisted[d].wins + record.assisted[d].losses + record.assisted[d].draws,
    0,
  );
  return (
    <div className="w-full max-w-[min(94vw,32rem)] rounded-brand-md border border-game-border bg-game-surface-2 p-3 text-sm">
      <p className="mb-2 font-semibold text-game-muted">Your record (wins-losses-draws, this device only)</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <div key={d}>
            <p className="font-semibold capitalize text-game-fg">{d}</p>
            <p className="tabular-nums text-game-muted">
              {record[d].wins}-{record[d].losses}-{record[d].draws}
            </p>
          </div>
        ))}
      </div>
      {assistedTotal > 0 && <p className="mt-2 text-xs text-game-muted">Plus {assistedTotal} assisted (undo/hint used).</p>}
    </div>
  );
}

/** The two modes are fully independent components, switched by `?tab=` (a plain navigation via
 *  ChessTabs, not lifted React state) rather than a shared parent that owns both — see
 *  ChessTabs.tsx's comment. Defaults to Friends when a challenge link brought her here, even
 *  before she's picked a tab explicitly. */
export default function ChessGame() {
  const [searchParams] = useSearchParams();
  const wantsFriends = searchParams.get("tab") === "friends" || searchParams.has("challenge");
  return wantsFriends ? <FriendsTab /> : <ComputerTab />;
}
