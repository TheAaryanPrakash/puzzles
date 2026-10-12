import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  engineOptionsFor,
  pickEngineMove,
  resolveSide,
  clockForPreset,
  tickClock,
  applyIncrement,
  isFlagged,
  flagOutcome,
  createFreshGame,
  markAssisted,
  canUndo,
  undoLastRound,
  classifyEnd,
  serializeGame,
  deserializeGame,
  DEFAULT_SETTINGS,
  VARIETY_ENGINE_MOVES,
  type EngineCandidate,
  type GameState,
} from "./logic";

describe("engineOptionsFor", () => {
  it("easy: low skill level, no strength limit, short movetime", () => {
    const o = engineOptionsFor("easy");
    expect(o.skillLevel).toBeLessThanOrEqual(3);
    expect(o.limitStrength).toBe(false);
    expect(o.movetimeMs).toBeLessThan(500);
  });

  it("medium: UCI_LimitStrength + UCI_Elo in the 1400-1600 band", () => {
    const o = engineOptionsFor("medium");
    expect(o.limitStrength).toBe(true);
    expect(o.elo).toBeGreaterThanOrEqual(1400);
    expect(o.elo).toBeLessThanOrEqual(1600);
  });

  it("hard: full strength, ~1-1.5s per move with no clock", () => {
    const o = engineOptionsFor("hard", null);
    expect(o.limitStrength).toBe(false);
    expect(o.movetimeMs).toBeGreaterThanOrEqual(1000);
    expect(o.movetimeMs).toBeLessThanOrEqual(1500);
  });

  it("hard: movetime shrinks when the engine's own clock is low, with a floor", () => {
    const plenty = engineOptionsFor("hard", 60_000);
    const low = engineOptionsFor("hard", 1_000);
    expect(low.movetimeMs).toBeLessThan(plenty.movetimeMs);
    expect(low.movetimeMs).toBeGreaterThanOrEqual(200);
  });

  it("every tier scales movetime off a low clock, not just hard", () => {
    for (const tier of ["easy", "medium", "hard"] as const) {
      const plenty = engineOptionsFor(tier, 60_000);
      const low = engineOptionsFor(tier, 1_000);
      expect(low.movetimeMs).toBeLessThan(plenty.movetimeMs);
    }
  });

  it("a timed game uses noticeably more time per move than an untimed one with a healthy clock", () => {
    // Otherwise the engine barely touches a 3-10 minute clock over a whole game — see the
    // "computer's clock visibly gaining time against 3+2" fix this guards against regressing.
    for (const tier of ["easy", "medium", "hard"] as const) {
      expect(engineOptionsFor(tier, 180_000).movetimeMs).toBeGreaterThan(engineOptionsFor(tier, null).movetimeMs);
    }
  });

  it("hard's timed movetime roughly breaks even against the 3+2 preset's 2000ms increment", () => {
    const { movetimeMs } = engineOptionsFor("hard", 180_000);
    expect(movetimeMs).toBeGreaterThanOrEqual(1800);
    expect(movetimeMs).toBeLessThanOrEqual(2200);
  });

  it("every tier's margin stays under a pawn's ~100cp value", () => {
    for (const tier of ["easy", "medium", "hard"] as const) {
      expect(engineOptionsFor(tier).marginCp).toBeLessThan(100);
    }
  });
});

describe("pickEngineMove", () => {
  const candidates: EngineCandidate[] = [
    { move: "best1", cp: 100 },
    { move: "close1", cp: 90 },
    { move: "close2", cp: 80 },
    { move: "farloss", cp: -50 },
  ];

  it("only includes candidates within the margin of the best", () => {
    for (let i = 0; i < 50; i++) {
      const picked = pickEngineMove(candidates, 25, 0, () => i / 50);
      expect(["best1", "close1", "close2"]).toContain(picked.move);
      expect(picked.move).not.toBe("farloss");
    }
  });

  it("can return every in-margin candidate across enough draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickEngineMove(candidates, 25, 0, () => i / 100).move);
    expect(seen).toEqual(new Set(["best1", "close1", "close2"]));
  });

  it("always plays the best move once past VARIETY_ENGINE_MOVES", () => {
    const picked = pickEngineMove(candidates, 25, VARIETY_ENGINE_MOVES, () => 0.99);
    expect(picked.move).toBe("best1");
  });

  it("a margin of 0 always plays the best move", () => {
    const picked = pickEngineMove(candidates, 0, 0, () => 0.99);
    expect(picked.move).toBe("best1");
  });

  it("a single candidate is always returned regardless of margin", () => {
    expect(pickEngineMove([{ move: "only", cp: -999 }], 10, 0).move).toBe("only");
  });
});

describe("resolveSide", () => {
  it("passes through an explicit choice", () => {
    expect(resolveSide("white")).toBe("white");
    expect(resolveSide("black")).toBe("black");
  });

  it("resolves 'random' using the given rng", () => {
    expect(resolveSide("random", () => 0)).toBe("white");
    expect(resolveSide("random", () => 0.99)).toBe("black");
  });
});

describe("clock", () => {
  it("clockForPreset: off is null, others have the right minutes/increment", () => {
    expect(clockForPreset("off")).toBeNull();
    expect(clockForPreset("3+2")).toEqual({ whiteMs: 180_000, blackMs: 180_000, incrementMs: 2000 });
    expect(clockForPreset("5+0")).toEqual({ whiteMs: 300_000, blackMs: 300_000, incrementMs: 0 });
    expect(clockForPreset("10+0")).toEqual({ whiteMs: 600_000, blackMs: 600_000, incrementMs: 0 });
  });

  it("tickClock subtracts from only the side on move, floored at 0", () => {
    const c = clockForPreset("3+2")!;
    const after = tickClock(c, "white", 200_000);
    expect(after.whiteMs).toBe(0);
    expect(after.blackMs).toBe(180_000);
  });

  it("applyIncrement adds to the side that just moved, after the move", () => {
    const c = clockForPreset("3+2")!;
    const after = applyIncrement(tickClock(c, "white", 1000), "white");
    expect(after.whiteMs).toBe(180_000 - 1000 + 2000);
  });

  it("applyIncrement is a no-op with no increment", () => {
    const c = clockForPreset("5+0")!;
    expect(applyIncrement(c, "white")).toEqual(c);
  });

  it("isFlagged true only once that side's time hits 0", () => {
    const c = clockForPreset("3+2")!;
    expect(isFlagged(c, "white")).toBe(false);
    expect(isFlagged(tickClock(c, "white", 200_000), "white")).toBe(true);
  });

  it("flagOutcome is a draw when the opponent has insufficient mating material", () => {
    const chess = new Chess("7k/8/8/4K3/8/8/8/3B4 w - - 0 1"); // K+B vs K
    expect(flagOutcome(chess)).toBe("draw");
  });

  it("flagOutcome is a loss for the flagged side otherwise", () => {
    expect(flagOutcome(new Chess())).toBe("flagged-loses");
  });
});

describe("createFreshGame / assisted / undo", () => {
  it("creates a game at the starting position, untouched, not assisted", () => {
    const g = createFreshGame(DEFAULT_SETTINGS, () => 0);
    expect(g.fen).toBe(new Chess().fen());
    expect(g.pgn).toBe("");
    expect(g.assisted).toBe(false);
    expect(g.status).toBe("in_progress");
    expect(g.engineMoveCount).toBe(0);
    expect(g.playerSide).toBe("white");
  });

  it("markAssisted sets the flag and is idempotent", () => {
    const g = createFreshGame(DEFAULT_SETTINGS);
    const marked = markAssisted(g);
    expect(marked.assisted).toBe(true);
    expect(markAssisted(marked)).toEqual(marked);
  });

  function playRounds(n: number): GameState {
    const chess = new Chess();
    const moves = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"];
    for (let i = 0; i < n * 2 && i < moves.length; i++) chess.move(moves[i]);
    return { ...createFreshGame({ ...DEFAULT_SETTINGS, clockPreset: "off" }), fen: chess.fen(), pgn: chess.pgn() };
  }

  it("canUndo is false with fewer than two plies played", () => {
    expect(canUndo(playRounds(0))).toBe(false);
  });

  it("canUndo is true with at least one full round played, clock off", () => {
    expect(canUndo(playRounds(1))).toBe(true);
  });

  it("canUndo is false while a clock is running", () => {
    const g = { ...playRounds(1), clock: clockForPreset("5+0") };
    expect(canUndo(g)).toBe(false);
  });

  it("canUndo is false once the game has ended", () => {
    const g = { ...playRounds(1), status: "won" as const };
    expect(canUndo(g)).toBe(false);
  });

  it("undoLastRound pops exactly two plies (mine, then the engine's)", () => {
    const g = playRounds(2); // e4 e5 Nf3 Nc6 — 4 plies
    const undone = undoLastRound(g);
    expect(undone).not.toBeNull();
    const chess = new Chess();
    chess.loadPgn(undone!.pgn);
    expect(chess.history()).toEqual(["e4", "e5"]); // the last round (Nf3, Nc6) is gone
  });

  it("undoLastRound returns null when canUndo is false", () => {
    expect(undoLastRound(playRounds(0))).toBeNull();
  });
});

describe("classifyEnd", () => {
  it("checkmate: the checkmated side's opponent won", () => {
    // Fool's mate — black delivers checkmate on move 2.
    const chess = new Chess();
    for (const m of ["f3", "e5", "g4", "Qh4"]) chess.move(m);
    expect(chess.isCheckmate()).toBe(true);
    expect(classifyEnd(chess, "white")).toEqual({ status: "lost", reason: "checkmate" });
    expect(classifyEnd(chess, "black")).toEqual({ status: "won", reason: "checkmate" });
  });

  it("stalemate is a draw for both sides", () => {
    const chess = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(chess.isStalemate()).toBe(true);
    expect(classifyEnd(chess, "white")).toEqual({ status: "drawn", reason: "stalemate" });
    expect(classifyEnd(chess, "black")).toEqual({ status: "drawn", reason: "stalemate" });
  });

  it("threefold repetition", () => {
    const chess = new Chess();
    for (const m of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]) chess.move(m);
    expect(chess.isThreefoldRepetition()).toBe(true);
    expect(classifyEnd(chess, "white")).toEqual({ status: "drawn", reason: "threefold" });
  });

  it("50-move rule", () => {
    // King-shuffle-only FEN already sitting at the 50-move boundary (halfmove clock 100 = 50 full moves).
    const chess = new Chess("7k/8/8/4K3/8/8/8/8 w - - 100 80");
    expect(chess.isDrawByFiftyMoves()).toBe(true);
    expect(classifyEnd(chess, "black")).toEqual({ status: "drawn", reason: "fifty-move" });
  });

  it("insufficient material: K+N vs K", () => {
    const chess = new Chess("7k/8/8/4K3/8/8/8/3N4 w - - 0 1");
    expect(classifyEnd(chess, "white")).toEqual({ status: "drawn", reason: "insufficient-material" });
  });

  it("insufficient material: same-colour bishops is a draw, opposite-colour is not", () => {
    const sameColour = new Chess("b6k/8/8/4K3/8/8/8/7B w - - 0 1");
    const oppositeColour = new Chess("b6k/8/8/4K3/8/8/8/B7 w - - 0 1");
    expect(classifyEnd(sameColour, "white")?.reason).toBe("insufficient-material");
    expect(classifyEnd(oppositeColour, "white")).toBeNull();
  });

  it("returns null while the game continues", () => {
    expect(classifyEnd(new Chess(), "white")).toBeNull();
  });
});

describe("rules via chess.js (promotion, castling through check, en passant)", () => {
  it("promotion offers all four pieces and defaults update the board", () => {
    const chess = new Chess("8/P7/8/8/4k3/8/8/4K3 w - - 0 1");
    const moves = chess.moves({ verbose: true }).filter((m) => m.from === "a7");
    expect(new Set(moves.map((m) => m.promotion))).toEqual(new Set(["q", "r", "b", "n"]));
    chess.move({ from: "a7", to: "a8", promotion: "q" });
    expect(chess.get("a8")?.type).toBe("q");
  });

  it("castling through check is illegal", () => {
    const chess = new Chess("5r1k/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(chess.moves().includes("O-O")).toBe(false);
  });

  it("castling into check is illegal", () => {
    const chess = new Chess("6rk/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(chess.moves().includes("O-O")).toBe(false);
  });

  it("castling with the king already in check is illegal", () => {
    const chess = new Chess("4r2k/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(chess.moves().includes("O-O")).toBe(false);
  });

  it("castling is legal once the path and landing/king squares are all safe", () => {
    const chess = new Chess("7k/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(chess.moves().includes("O-O")).toBe(true);
  });

  it("en passant is available immediately after a two-square pawn push and nowhere else", () => {
    const chess = new Chess();
    for (const m of ["e4", "a6", "e5", "d5"]) chess.move(m);
    expect(chess.moves().includes("exd6")).toBe(true);
    const result = chess.move("exd6");
    expect(result.flags).toContain("e");
    expect(chess.get("d5")).toBeFalsy(); // the captured pawn is gone from its origin square
  });
});

describe("serialize / deserialize", () => {
  it("round-trips an in-progress game to an identical GameState", () => {
    const chess = new Chess();
    chess.move("e4");
    const state: GameState = {
      ...createFreshGame({ difficulty: "hard", side: "white", clockPreset: "3+2" }),
      fen: chess.fen(),
      pgn: chess.pgn(),
      assisted: true,
      engineMoveCount: 1,
    };
    const restored = deserializeGame(serializeGame(state));
    expect(restored).toEqual(state);
  });

  it("null input returns null", () => {
    expect(deserializeGame(null)).toBeNull();
  });

  it("garbage JSON falls back to null instead of throwing", () => {
    expect(deserializeGame("{not valid json")).toBeNull();
  });

  it("well-formed JSON with the wrong shape falls back to null", () => {
    expect(deserializeGame(JSON.stringify({ hello: "world" }))).toBeNull();
    expect(deserializeGame(JSON.stringify({ fen: "not a real fen", pgn: "" }))).toBeNull();
  });
});
