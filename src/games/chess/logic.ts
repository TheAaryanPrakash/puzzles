// Pure functions only — no React, no chess.js side effects beyond reading a position, no
// localStorage, no Worker. See RESEARCH.md for why each numeric choice below is what it is.
import { Chess, type Square } from "chess.js";

/** Scans the board for the given colour's king — used to highlight it while in check. Shared by
 *  the computer-mode and friend-mode boards rather than duplicated in each. */
export function kingSquare(chess: Chess, color: "w" | "b"): Square | null {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === color) return cell.square;
    }
  }
  return null;
}

export type Difficulty = "easy" | "medium" | "hard";
export type Side = "white" | "black";
export type SideChoice = Side | "random";
export type ClockPreset = "off" | "3+2" | "5+0" | "10+0" | "15+10";
export type GameStatus = "in_progress" | "won" | "lost" | "drawn";
export type EndReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fifty-move"
  | "insufficient-material"
  | "resignation"
  | "flag"
  // Friend-mode-only endings — see RESEARCH.md "Multiplayer". Never produced by classifyEnd();
  // the friends-mode RPCs (respond_draw, claim_abandoned) set these directly.
  | "draw-agreement"
  | "abandoned";

/** How many of the *engine's own* moves get MultiPV variety treatment before it just always plays
 *  the engine's best line. Not plies — the count only advances when it's the engine's move. */
export const VARIETY_ENGINE_MOVES = 10;

export interface EngineOptions {
  skillLevel: number; // 0-20, UCI "Skill Level"
  limitStrength: boolean; // UCI_LimitStrength
  elo?: number; // UCI_Elo, only meaningful when limitStrength is true
  movetimeMs: number;
  /** MultiPV variety margin, in centipawns, applied only for the engine's first
   *  VARIETY_ENGINE_MOVES moves. Chosen well under a pawn's ~100cp value on every tier, which is
   *  the actual mechanism that keeps the picker from ever choosing a move that loses material
   *  outright — a candidate losing a whole pawn or more for nothing scores at least ~100cp worse
   *  than the best move and is excluded by the margin itself, no second heuristic needed. */
  marginCp: number;
}

const BASE_ENGINE_OPTIONS: Record<Difficulty, Omit<EngineOptions, "movetimeMs">> = {
  easy: { skillLevel: 1, limitStrength: false, marginCp: 70 },
  medium: { skillLevel: 20, limitStrength: true, elo: 1500, marginCp: 45 },
  hard: { skillLevel: 20, limitStrength: false, marginCp: 25 },
};

// Untimed games (clock "off") use these short, snappy budgets purely for a responsive "engine is
// thinking" UX — there's no clock to respect, so there's no reason to make the player wait longer.
const UNTIMED_MOVETIME_MS: Record<Difficulty, number> = { easy: 250, medium: 700, hard: 1200 };

// Timed games scale movetime off the engine's own remaining clock instead, so it actually spends a
// visible, believable share of its time over a game rather than barely touching the clock (a flat
// untimed-style budget against a 3-10 minute clock would use well under a minute across an entire
// game). The engine is never credited increment (see commitMove in index.tsx), so these ceilings
// only need to pace how much of its own time it visibly spends — not "break even" against any
// particular preset's increment, which was the previous (fragile) rationale here: it quietly broke
// the moment a bigger-increment preset (Rapid, 15+10) was added, since Hard's old 2000ms ceiling was
// tuned only against 3+2's 2000ms increment. The floor exists so a near-empty clock can't make a
// single move think long enough to flag itself.
const TIMED_MOVETIME_CEILING_MS: Record<Difficulty, number> = { easy: 600, medium: 1200, hard: 2000 };
const TIMED_MOVETIME_FLOOR_MS = 300;
const TIMED_MOVETIME_CLOCK_DIVISOR = 20;

/** `remainingMs` is the engine's own clock time left (not the player's), or `null` with no clock. */
export function engineOptionsFor(difficulty: Difficulty, remainingMs: number | null = null): EngineOptions {
  const base = BASE_ENGINE_OPTIONS[difficulty];
  if (remainingMs === null) {
    return { ...base, movetimeMs: UNTIMED_MOVETIME_MS[difficulty] };
  }
  const scaled = Math.floor(remainingMs / TIMED_MOVETIME_CLOCK_DIVISOR);
  const ceiling = TIMED_MOVETIME_CEILING_MS[difficulty];
  return { ...base, movetimeMs: Math.max(TIMED_MOVETIME_FLOOR_MS, Math.min(ceiling, scaled)) };
}

export interface EngineCandidate {
  /** UCI long algebraic, e.g. "e2e4" or "e7e8q" — whatever the engine's own `pv` gives. */
  move: string;
  /** Centipawn score from the side-to-move's own perspective; higher is better for them. */
  cp: number;
}

/**
 * Picks among MultiPV candidates within `marginCp` of the best, uniformly at random, for the
 * engine's first VARIETY_ENGINE_MOVES moves; after that (or with only one candidate) it always
 * plays the best one. `engineMoveCount` is how many moves the engine has already made *before*
 * this one (0 for its first move).
 */
export function pickEngineMove(
  candidates: EngineCandidate[],
  marginCp: number,
  engineMoveCount: number,
  rng: () => number = Math.random,
): EngineCandidate {
  if (candidates.length === 0) throw new Error("pickEngineMove: no candidates");
  const sorted = [...candidates].sort((a, b) => b.cp - a.cp);
  const best = sorted[0];
  if (engineMoveCount >= VARIETY_ENGINE_MOVES) return best;
  const within = sorted.filter((c) => best.cp - c.cp <= marginCp);
  return within[Math.floor(rng() * within.length)];
}

export function resolveSide(choice: SideChoice, rng: () => number = Math.random): Side {
  if (choice !== "random") return choice;
  return rng() < 0.5 ? "white" : "black";
}

export function otherSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}

// ───────────────────────────── Friend-mode timing ─────────────────────────────
// Pure mirrors of the SQL in 0005_chess.sql (chess_challenges.expires_at, claim_abandoned's
// 7-day check) — used client-side for countdown/claim-button UI, not as the actual authority
// (the server re-checks both independently; see RESEARCH.md "Multiplayer").

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Mirrors `expires_at < now()` — a challenge created `days` days before `nowMs` has expired. */
export function isExpired(createdAtIso: string, nowMs: number, days: number): boolean {
  return nowMs - new Date(createdAtIso).getTime() > days * MS_PER_DAY;
}

/** Mirrors `claim_abandoned`'s `now() - last_move_at > interval '7 days'`. */
export function isAbandonable(lastMoveAtIso: string, nowMs: number, days = 7): boolean {
  return nowMs - new Date(lastMoveAtIso).getTime() > days * MS_PER_DAY;
}

// ───────────────────────────── Clock ─────────────────────────────

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
}

const CLOCK_PRESETS: Record<Exclude<ClockPreset, "off">, { minutes: number; incrementMs: number }> = {
  "3+2": { minutes: 3, incrementMs: 2000 },
  "5+0": { minutes: 5, incrementMs: 0 },
  "10+0": { minutes: 10, incrementMs: 0 },
  // chess.com's own default Rapid time control (their "Rapid" button on the new-game widget).
  "15+10": { minutes: 15, incrementMs: 10_000 },
};

export function clockForPreset(preset: ClockPreset): ClockState | null {
  if (preset === "off") return null;
  const { minutes, incrementMs } = CLOCK_PRESETS[preset];
  const ms = minutes * 60_000;
  return { whiteMs: ms, blackMs: ms, incrementMs };
}

/** Subtracts elapsed thinking time from the side currently on the move. Never goes below 0. */
export function tickClock(clock: ClockState, side: Side, elapsedMs: number): ClockState {
  const key = side === "white" ? "whiteMs" : "blackMs";
  return { ...clock, [key]: Math.max(0, clock[key] - elapsedMs) };
}

/** Applied to the side that just *finished* moving (after their move lands, not before it). */
export function applyIncrement(clock: ClockState, side: Side): ClockState {
  if (clock.incrementMs === 0) return clock;
  const key = side === "white" ? "whiteMs" : "blackMs";
  return { ...clock, [key]: clock[key] + clock.incrementMs };
}

export function isFlagged(clock: ClockState, side: Side): boolean {
  return (side === "white" ? clock.whiteMs : clock.blackMs) <= 0;
}

/**
 * The side whose clock hit 0 loses on time — *unless* the position is already one where the
 * opponent has no way to ever deliver checkmate, which is a draw instead (FIDE Art. 6.9). This is
 * the same "insufficient material" the dead-position draw rule checks: if neither side's pieces
 * can force mate, that's symmetric regardless of whose clock ran out, so `chess.isInsufficientMaterial()`
 * — already the correct check for the ordinary draw case — is also the correct check here.
 */
export function flagOutcome(chess: Chess): "draw" | "flagged-loses" {
  return chess.isInsufficientMaterial() ? "draw" : "flagged-loses";
}

// ───────────────────────────── Game state ─────────────────────────────

export interface ChessSettings {
  difficulty: Difficulty;
  side: SideChoice;
  clockPreset: ClockPreset;
}

export const DEFAULT_SETTINGS: ChessSettings = { difficulty: "medium", side: "random", clockPreset: "off" };

export interface GameResult {
  status: "won" | "lost" | "drawn";
  reason: EndReason;
}

export interface GameState {
  fen: string;
  pgn: string;
  settings: ChessSettings;
  playerSide: Side;
  clock: ClockState | null;
  assisted: boolean;
  status: GameStatus;
  result?: GameResult;
  engineMoveCount: number;
}

export function createFreshGame(settings: ChessSettings, rng: () => number = Math.random): GameState {
  const chess = new Chess();
  return {
    fen: chess.fen(),
    pgn: "",
    settings,
    playerSide: resolveSide(settings.side, rng),
    clock: clockForPreset(settings.clockPreset),
    assisted: false,
    status: "in_progress",
    engineMoveCount: 0,
  };
}

export function markAssisted(state: GameState): GameState {
  return state.assisted ? state : { ...state, assisted: true };
}

/** Undo reaches back one full round (the player's last move, then the engine's reply before it) —
 *  only possible with at least two plies played, and never while a clock is running. */
export function canUndo(state: GameState): boolean {
  if (state.clock !== null) return false;
  if (state.status !== "in_progress") return false;
  const chess = new Chess();
  chess.loadPgn(state.pgn);
  return chess.history().length >= 2;
}

/** Pops exactly two plies (mine, then the engine's) off a fresh `Chess` loaded from `state.pgn`
 *  and returns the resulting fen/pgn — caller merges this into the rest of `GameState` and marks
 *  it assisted. Returns `null` if there's nothing to undo (mirrors `canUndo`, kept separate so
 *  `canUndo` stays side-effect-free for the UI to call on every render). */
export function undoLastRound(state: GameState): { fen: string; pgn: string } | null {
  if (!canUndo(state)) return null;
  const chess = new Chess();
  chess.loadPgn(state.pgn);
  chess.undo();
  chess.undo();
  return { fen: chess.fen(), pgn: chess.pgn() };
}

/** Checkmate / stalemate / threefold / 50-move / insufficient-material, from `playerSide`'s point
 *  of view. Resignation and flagging aren't chess.js-detectable states, so callers build those
 *  `GameResult`s directly instead of going through this. Returns `null` while the game continues. */
export function classifyEnd(chess: Chess, playerSide: Side): GameResult | null {
  if (chess.isCheckmate()) {
    // The side to move is the one checkmated — the other side won.
    const winner: Side = chess.turn() === "w" ? "black" : "white";
    return { status: winner === playerSide ? "won" : "lost", reason: "checkmate" };
  }
  if (chess.isStalemate()) return { status: "drawn", reason: "stalemate" };
  if (chess.isThreefoldRepetition()) return { status: "drawn", reason: "threefold" };
  if (chess.isDrawByFiftyMoves()) return { status: "drawn", reason: "fifty-move" };
  if (chess.isInsufficientMaterial()) return { status: "drawn", reason: "insufficient-material" };
  return null;
}

// ───────────────────────────── Save / restore ─────────────────────────────

function isValidGameState(v: unknown): v is GameState {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Record<string, unknown>;
  if (typeof g.fen !== "string" || typeof g.pgn !== "string") return false;
  try {
    new Chess(g.fen);
  } catch {
    return false;
  }
  if (typeof g.assisted !== "boolean") return false;
  if (!["in_progress", "won", "lost", "drawn"].includes(g.status as string)) return false;
  if (typeof g.engineMoveCount !== "number") return false;
  if (g.playerSide !== "white" && g.playerSide !== "black") return false;
  const s = g.settings as Record<string, unknown> | undefined;
  if (!s || !["easy", "medium", "hard"].includes(s.difficulty as string)) return false;
  return true;
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

/** `null` input or anything that fails to parse/validate (corrupt storage, an old shape from a
 *  future version) returns `null` rather than throwing — callers fall back to a fresh game. */
export function deserializeGame(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
