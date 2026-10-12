// Pure functions only — no React, no chess.js side effects beyond reading a position, no
// localStorage, no Worker. See RESEARCH.md for why each numeric choice below is what it is.
import { Chess } from "chess.js";

export type Difficulty = "easy" | "medium" | "hard";
export type Side = "white" | "black";
export type SideChoice = Side | "random";
export type ClockPreset = "off" | "3+2" | "5+0" | "10+0";
export type GameStatus = "in_progress" | "won" | "lost" | "drawn";
export type EndReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fifty-move"
  | "insufficient-material"
  | "resignation"
  | "flag";

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

const HARD_MOVETIME_MS = 1200;
const HARD_MOVETIME_FLOOR_MS = 200;
/** The engine's own remaining clock time gets divided by this to cap how much of it one "hard"
 *  move may spend, so a low clock can't make the engine flag itself on a single slow think. */
const HARD_MOVETIME_CLOCK_DIVISOR = 30;

/**
 * `remainingMs` is the engine's own clock time left (not the player's), or `null` with no clock.
 * Only "hard" scales down — easy/medium's movetimes are already short enough never to matter.
 */
export function engineOptionsFor(difficulty: Difficulty, remainingMs: number | null = null): EngineOptions {
  const base = BASE_ENGINE_OPTIONS[difficulty];
  if (difficulty !== "hard" || remainingMs === null) {
    return { ...base, movetimeMs: difficulty === "easy" ? 250 : difficulty === "medium" ? 700 : HARD_MOVETIME_MS };
  }
  const scaled = Math.floor(remainingMs / HARD_MOVETIME_CLOCK_DIVISOR);
  return { ...base, movetimeMs: Math.max(HARD_MOVETIME_FLOOR_MS, Math.min(HARD_MOVETIME_MS, scaled)) };
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
