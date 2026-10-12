// The ONLY chess code that talks to a backend — see CLAUDE.md "Chess" and
// src/games/chess/RESEARCH.md "Multiplayer". Deliberately separate from the frozen
// src/lib/data/types.ts DataSource: chess stays structurally unscored, so friends-mode UI under
// src/games/chess/** imports this file and nothing else under src/lib/data (enforced by
// src/games/chess/no-datasource.test.ts).
//
// Picks an adapter from VITE_DATA_SOURCE, exactly like src/lib/data/index.ts does for the scored
// DataSource — see that file's comment for why the switch is a plain module-level ternary rather
// than anything more dynamic.
import { getSupabaseClient, friendlyError } from "./supabase";
import { getDevMember } from "../auth";
import { readGroups, readMembers } from "./local";
import type { EndReason, Side, SideChoice } from "../../games/chess/logic";
import { otherSide } from "../../games/chess/logic";

export type ChessResult = "white_won" | "black_won" | "draw";
export type ChessChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface ChessOpponent {
  userId: string;
  displayName: string;
  groupName: string;
}

export interface ChessChallenge {
  id: string;
  token: string | null;
  createdBy: string;
  createdByName: string;
  recipientId: string | null;
  recipientName: string | null;
  creatorSide: Side;
  status: ChessChallengeStatus;
  expiresAt: string;
  createdAt: string;
  rematchOf: string | null;
}

export interface ChessGame {
  id: string;
  whiteId: string;
  whiteName: string;
  blackId: string;
  blackName: string;
  fen: string;
  pgn: string;
  lastMoveSan: string | null;
  ply: number;
  status: "active" | "finished";
  result: ChessResult | null;
  reason: EndReason | null;
  drawOfferBy: string | null;
  lastMoveAt: string;
  rematchOf: string | null;
  createdAt: string;
  myColor: Side | null; // null for a spectator
  isMyTurn: boolean;
}

export interface ChessRecordRow {
  opponentId: string | null; // null = the synthetic "Overall" row
  opponentName: string;
  wins: number;
  losses: number;
  draws: number;
}

export interface ChessBadge {
  yourTurnCount: number;
  incomingChallengeCount: number;
}

export interface ChessDataSource {
  listOpponents(): Promise<ChessOpponent[]>;
  createChallenge(opts: { recipientId?: string; side: SideChoice }): Promise<{ id: string; token: string | null }>;
  createRematch(gameId: string): Promise<{ id: string; token: string | null }>;
  previewChallenge(token: string): Promise<{ creatorName: string; side: Side } | null>;
  acceptChallenge(opts: { id?: string; token?: string }): Promise<{ gameId: string }>;
  declineChallenge(id: string): Promise<void>;
  cancelChallenge(id: string): Promise<void>;
  listMyChallenges(): Promise<{ outgoing: ChessChallenge[]; incoming: ChessChallenge[] }>;
  listMyGames(): Promise<ChessGame[]>;
  getGame(id: string): Promise<ChessGame | null>;
  subscribeToGame(id: string, onChange: (game: ChessGame | null) => void): () => void;
  makeMove(opts: {
    gameId: string;
    uci: string;
    san: string;
    fen: string;
    pgn: string;
    expectedPly: number;
    result?: ChessResult;
    reason?: EndReason;
  }): Promise<void>;
  resign(gameId: string): Promise<void>;
  offerDraw(gameId: string): Promise<void>;
  respondDraw(gameId: string, accept: boolean): Promise<void>;
  claimAbandoned(gameId: string): Promise<void>;
  myRecord(): Promise<ChessRecordRow[]>;
  myBadge(): Promise<ChessBadge>;
}

// ═══════════════════════════ Supabase adapter ═══════════════════════════

function toResultSide(result: ChessResult | null): "white" | "black" | "draw" | null {
  if (result === "white_won") return "white";
  if (result === "black_won") return "black";
  return result; // "draw" | null
}

async function getUid(): Promise<string> {
  const db = getSupabaseClient();
  const { data } = await db.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sign in and join to play.");
  return uid;
}

function myColorFor(whiteId: string, blackId: string, uid: string): Side | null {
  if (whiteId === uid) return "white";
  if (blackId === uid) return "black";
  return null;
}

interface ChessGameRow {
  id: string;
  white_id: string;
  black_id: string;
  fen: string;
  pgn: string;
  last_move_san: string | null;
  ply: number;
  status: "active" | "finished";
  result: ChessResult | null;
  reason: EndReason | null;
  draw_offer_by: string | null;
  last_move_at: string;
  rematch_of: string | null;
  created_at: string;
}

async function hydrateGame(row: ChessGameRow, uid: string): Promise<ChessGame> {
  const db = getSupabaseClient();
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", [row.white_id, row.black_id]);
  const nameOf = (id: string) => profiles?.find((p) => p.user_id === id)?.display_name ?? "?";
  const myColor = myColorFor(row.white_id, row.black_id, uid);
  return {
    id: row.id,
    whiteId: row.white_id,
    whiteName: nameOf(row.white_id),
    blackId: row.black_id,
    blackName: nameOf(row.black_id),
    fen: row.fen,
    pgn: row.pgn,
    lastMoveSan: row.last_move_san,
    ply: row.ply,
    status: row.status,
    result: row.result,
    reason: row.reason,
    drawOfferBy: row.draw_offer_by,
    lastMoveAt: row.last_move_at,
    rematchOf: row.rematch_of,
    createdAt: row.created_at,
    myColor,
    isMyTurn:
      row.status === "active" &&
      myColor !== null &&
      myColor === (row.ply % 2 === 0 ? "white" : "black"),
  };
}

const supabaseChessDataSource: ChessDataSource = {
  async listOpponents(): Promise<ChessOpponent[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("chess_opponents");
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      groupName: row.group_name,
    }));
  },

  async createChallenge({ recipientId, side }): Promise<{ id: string; token: string | null }> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("create_challenge", {
      p_recipient_id: recipientId ?? null,
      p_side: side,
    });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    if (!row) throw new Error("Something went wrong. Please try again.");
    return { id: row.id, token: row.token };
  },

  async createRematch(gameId: string): Promise<{ id: string; token: string | null }> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("create_rematch", { p_game_id: gameId });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    if (!row) throw new Error("Something went wrong. Please try again.");
    return { id: row.id, token: row.token };
  },

  async previewChallenge(token: string): Promise<{ creatorName: string; side: Side } | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("challenge_preview", { p_token: token });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    return row ? { creatorName: row.creator_name, side: row.side as Side } : null;
  },

  async acceptChallenge({ id, token }): Promise<{ gameId: string }> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("accept_challenge", { p_id: id ?? null, p_token: token ?? null });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    if (!row) throw new Error("This challenge is no longer available.");
    return { gameId: row.game_id };
  },

  async declineChallenge(id: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("decline_challenge", { p_id: id });
    if (error) throw friendlyError(error);
  },

  async cancelChallenge(id: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("cancel_challenge", { p_id: id });
    if (error) throw friendlyError(error);
  },

  async listMyChallenges(): Promise<{ outgoing: ChessChallenge[]; incoming: ChessChallenge[] }> {
    const db = getSupabaseClient();
    const uid = await getUid();
    const { data, error } = await db
      .from("chess_challenges")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw friendlyError(error);
    const rows = data ?? [];
    const otherIds = [
      ...new Set(
        rows.map((r) => (r.created_by === uid ? r.recipient_id : r.created_by)).filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: profiles } = otherIds.length
      ? await db.from("profiles").select("user_id, display_name").in("user_id", otherIds)
      : { data: [] as { user_id: string; display_name: string }[] };
    const nameOf = (id: string | null) => (id ? profiles?.find((p) => p.user_id === id)?.display_name ?? null : null);

    const toChallenge = (r: (typeof rows)[number]): ChessChallenge => ({
      id: r.id,
      token: r.token,
      createdBy: r.created_by,
      createdByName: r.created_by === uid ? "You" : nameOf(r.created_by) ?? "?",
      recipientId: r.recipient_id,
      recipientName: r.recipient_id === uid ? "You" : nameOf(r.recipient_id),
      creatorSide: r.creator_side as Side,
      status: r.status as ChessChallengeStatus,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      rematchOf: r.rematch_of,
    });

    return {
      outgoing: rows.filter((r) => r.created_by === uid).map(toChallenge),
      incoming: rows.filter((r) => r.recipient_id === uid).map(toChallenge),
    };
  },

  async listMyGames(): Promise<ChessGame[]> {
    const db = getSupabaseClient();
    const uid = await getUid();
    const { data, error } = await db.rpc("my_chess_games");
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => {
      const myColor = myColorFor(row.white_id, row.black_id, uid);
      return {
        id: row.id,
        whiteId: row.white_id,
        whiteName: row.white_name,
        blackId: row.black_id,
        blackName: row.black_name,
        fen: row.fen,
        pgn: row.pgn,
        lastMoveSan: row.last_move_san,
        ply: row.ply,
        status: row.status as "active" | "finished",
        result: row.result as ChessResult | null,
        reason: row.reason as EndReason | null,
        drawOfferBy: row.draw_offer_by,
        lastMoveAt: row.last_move_at,
        rematchOf: row.rematch_of,
        createdAt: row.created_at,
        myColor,
        isMyTurn: row.is_my_turn,
      };
    });
  },

  async getGame(id: string): Promise<ChessGame | null> {
    const db = getSupabaseClient();
    const uid = await getUid();
    const { data, error } = await db.from("chess_games").select("*").eq("id", id).maybeSingle();
    if (error) throw friendlyError(error);
    if (!data) return null;
    return hydrateGame(data as ChessGameRow, uid);
  },

  subscribeToGame(id: string, onChange: (game: ChessGame | null) => void): () => void {
    const db = getSupabaseClient();
    let cancelled = false;

    async function refetch() {
      try {
        const game = await supabaseChessDataSource.getGame(id);
        if (!cancelled) onChange(game);
      } catch {
        // A transient read failure leaves the last-known state on screen; the next realtime
        // event or focus refetch will catch it back up.
      }
    }

    const channel = db
      .channel(`chess_game_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_games", filter: `id=eq.${id}` }, () => {
        void refetch();
      })
      .subscribe();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refetch();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refetch);

    return () => {
      cancelled = true;
      void db.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refetch);
    };
  },

  async makeMove({ gameId, uci, san, fen, pgn, expectedPly, result, reason }): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("make_move", {
      p_game_id: gameId,
      p_uci: uci,
      p_san: san,
      p_fen: fen,
      p_pgn: pgn,
      p_expected_ply: expectedPly,
      p_result: result ?? null,
      p_reason: reason ?? null,
    });
    if (error) throw friendlyError(error);
  },

  async resign(gameId: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("resign", { p_game_id: gameId });
    if (error) throw friendlyError(error);
  },

  async offerDraw(gameId: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("offer_draw", { p_game_id: gameId });
    if (error) throw friendlyError(error);
  },

  async respondDraw(gameId: string, accept: boolean): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("respond_draw", { p_game_id: gameId, p_accept: accept });
    if (error) throw friendlyError(error);
  },

  async claimAbandoned(gameId: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("claim_abandoned", { p_game_id: gameId });
    if (error) throw friendlyError(error);
  },

  async myRecord(): Promise<ChessRecordRow[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("my_chess_record");
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      opponentId: row.opponent_id,
      opponentName: row.opponent_name,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    }));
  },

  async myBadge(): Promise<ChessBadge> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("my_chess_badge");
    if (error) throw friendlyError(error);
    const row = data?.[0];
    return { yourTurnCount: row?.your_turn_count ?? 0, incomingChallengeCount: row?.incoming_challenge_count ?? 0 };
  },
};

// ═══════════════════════════ Local (dev) adapter ═══════════════════════════
//
// localStorage for all rows, BroadcastChannel so a second tab (acting as a different fake member
// via auth.tsx's getDevMember()) sees the other tab's writes without a page reload — the same
// shape Supabase Realtime gives the real adapter above. Enforces the same cap/turn/expiry/
// abandonment rules in plain TS, so this is a faithful stand-in, not a permissive stub.

const LOCAL_CHALLENGES_KEY = "sansitas-puzzles:chess-mp:challenges";
const LOCAL_GAMES_KEY = "sansitas-puzzles:chess-mp:games";
const BROADCAST_CHANNEL_NAME = "sansitas-puzzles-chess-mp";
const CHALLENGE_EXPIRY_DAYS = 3;
const ABANDON_DAYS = 7;
const MAX_SLOTS = 5;

interface LocalChallenge {
  id: string;
  token: string;
  createdBy: string;
  recipientId: string | null;
  creatorSide: Side;
  status: ChessChallengeStatus;
  expiresAt: string;
  gameId: string | null;
  rematchOf: string | null;
  createdAt: string;
}

interface LocalGame {
  id: string;
  whiteId: string;
  blackId: string;
  fen: string;
  pgn: string;
  lastMoveUci: string | null;
  lastMoveSan: string | null;
  ply: number;
  status: "active" | "finished";
  result: ChessResult | null;
  reason: EndReason | null;
  drawOfferBy: string | null;
  lastMoveAt: string;
  rematchOf: string | null;
  createdAt: string;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function readLocalChallenges(): LocalChallenge[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHALLENGES_KEY);
    return raw ? (JSON.parse(raw) as LocalChallenge[]) : [];
  } catch {
    return [];
  }
}

function writeLocalChallenges(rows: LocalChallenge[]): void {
  try {
    localStorage.setItem(LOCAL_CHALLENGES_KEY, JSON.stringify(rows));
  } catch {
    // Unavailable — the write is dropped; the caller's own state is unaffected until reload.
  }
  broadcast();
}

function readLocalGames(): LocalGame[] {
  try {
    const raw = localStorage.getItem(LOCAL_GAMES_KEY);
    return raw ? (JSON.parse(raw) as LocalGame[]) : [];
  } catch {
    return [];
  }
}

function writeLocalGames(rows: LocalGame[]): void {
  try {
    localStorage.setItem(LOCAL_GAMES_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
  broadcast();
}

let localChannel: BroadcastChannel | null = null;
function broadcast(): void {
  try {
    localChannel ??= new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    localChannel.postMessage({ at: Date.now() });
  } catch {
    // BroadcastChannel unavailable — other tabs simply won't live-update until they refocus.
  }
}

function randomToken(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

function localDisplayName(userId: string): string {
  for (const group of readGroups()) {
    const member = readMembers(group.id).find((m) => m.userId === userId);
    if (member) return member.displayName;
  }
  return "?";
}

function sharesAnyGroup(a: string, b: string): boolean {
  return readGroups().some((g) => {
    const members = readMembers(g.id).map((m) => m.userId);
    return members.includes(a) && members.includes(b);
  });
}

function slotCount(userId: string): number {
  const activeGames = readLocalGames().filter((g) => g.status === "active" && (g.whiteId === userId || g.blackId === userId)).length;
  const pendingChallenges = readLocalChallenges().filter(
    (c) => c.createdBy === userId && c.status === "pending" && new Date(c.expiresAt).getTime() > Date.now(),
  ).length;
  return activeGames + pendingChallenges;
}

function toChessGame(row: LocalGame, uid: string): ChessGame {
  const myColor = myColorFor(row.whiteId, row.blackId, uid);
  return {
    id: row.id,
    whiteId: row.whiteId,
    whiteName: localDisplayName(row.whiteId),
    blackId: row.blackId,
    blackName: localDisplayName(row.blackId),
    fen: row.fen,
    pgn: row.pgn,
    lastMoveSan: row.lastMoveSan,
    ply: row.ply,
    status: row.status,
    result: row.result,
    reason: row.reason,
    drawOfferBy: row.drawOfferBy,
    lastMoveAt: row.lastMoveAt,
    rematchOf: row.rematchOf,
    createdAt: row.createdAt,
    myColor,
    isMyTurn: row.status === "active" && myColor !== null && myColor === (row.ply % 2 === 0 ? "white" : "black"),
  };
}

function toChessChallenge(row: LocalChallenge, uid: string): ChessChallenge {
  return {
    id: row.id,
    token: row.token,
    createdBy: row.createdBy,
    createdByName: row.createdBy === uid ? "You" : localDisplayName(row.createdBy),
    recipientId: row.recipientId,
    recipientName: row.recipientId ? (row.recipientId === uid ? "You" : localDisplayName(row.recipientId)) : null,
    creatorSide: row.creatorSide,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    rematchOf: row.rematchOf,
  };
}

function resolveLocalSide(choice: SideChoice): Side {
  if (choice !== "random") return choice;
  return Math.random() < 0.5 ? "white" : "black";
}

function insertChallenge(opts: { createdBy: string; recipientId: string | null; side: SideChoice; rematchOf: string | null }): LocalChallenge {
  if (slotCount(opts.createdBy) >= MAX_SLOTS) {
    throw new Error("You already have 5 games or pending challenges — finish or cancel one first.");
  }
  if (opts.recipientId) {
    if (opts.recipientId === opts.createdBy) throw new Error("You can't challenge yourself.");
    if (!sharesAnyGroup(opts.createdBy, opts.recipientId)) {
      throw new Error("You can only challenge someone who shares a group with you.");
    }
  }
  const row: LocalChallenge = {
    id: randomToken(),
    token: randomToken(),
    createdBy: opts.createdBy,
    recipientId: opts.recipientId,
    creatorSide: resolveLocalSide(opts.side),
    status: "pending",
    expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    gameId: null,
    rematchOf: opts.rematchOf,
    createdAt: new Date().toISOString(),
  };
  writeLocalChallenges([...readLocalChallenges(), row]);
  return row;
}

function findChallenge(opts: { id?: string; token?: string }): LocalChallenge | undefined {
  return readLocalChallenges().find((c) => (opts.id && c.id === opts.id) || (opts.token && c.token === opts.token));
}

const localChessDataSource: ChessDataSource = {
  async listOpponents(): Promise<ChessOpponent[]> {
    const me = getDevMember().userId;
    const seen = new Set<string>();
    const result: ChessOpponent[] = [];
    for (const group of readGroups()) {
      const members = readMembers(group.id);
      if (!members.some((m) => m.userId === me)) continue;
      for (const m of members) {
        if (m.userId === me || seen.has(m.userId)) continue;
        seen.add(m.userId);
        result.push({ userId: m.userId, displayName: m.displayName, groupName: group.name });
      }
    }
    return result;
  },

  async createChallenge({ recipientId, side }): Promise<{ id: string; token: string | null }> {
    const me = getDevMember().userId;
    const row = insertChallenge({ createdBy: me, recipientId: recipientId ?? null, side, rematchOf: null });
    return { id: row.id, token: row.token };
  },

  async createRematch(gameId: string): Promise<{ id: string; token: string | null }> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === gameId);
    if (!game || game.status !== "finished") throw new Error("Can only offer a rematch for a finished game.");
    const mySide = myColorFor(game.whiteId, game.blackId, me);
    if (!mySide) throw new Error("Only a player in this game can offer a rematch.");
    const opponent = mySide === "white" ? game.blackId : game.whiteId;
    const row = insertChallenge({ createdBy: me, recipientId: opponent, side: otherSide(mySide), rematchOf: gameId });
    return { id: row.id, token: row.token };
  },

  async previewChallenge(token: string): Promise<{ creatorName: string; side: Side } | null> {
    const challenge = findChallenge({ token });
    if (!challenge || challenge.status !== "pending" || new Date(challenge.expiresAt).getTime() <= Date.now()) return null;
    return { creatorName: localDisplayName(challenge.createdBy), side: challenge.creatorSide };
  },

  async acceptChallenge({ id, token }): Promise<{ gameId: string }> {
    const me = getDevMember().userId;
    const challenge = findChallenge({ id, token });
    if (!challenge || challenge.status !== "pending" || new Date(challenge.expiresAt).getTime() <= Date.now()) {
      throw new Error("This challenge is no longer available.");
    }
    if (challenge.createdBy === me) throw new Error("You can't accept your own challenge.");
    if (challenge.recipientId && challenge.recipientId !== me) throw new Error("This challenge is not for you.");
    if (slotCount(me) >= MAX_SLOTS) {
      throw new Error("You already have 5 games or pending challenges — finish or cancel one first.");
    }
    const whiteId = challenge.creatorSide === "white" ? challenge.createdBy : me;
    const blackId = challenge.creatorSide === "white" ? me : challenge.createdBy;
    const game: LocalGame = {
      id: randomToken(),
      whiteId,
      blackId,
      fen: START_FEN,
      pgn: "",
      lastMoveUci: null,
      lastMoveSan: null,
      ply: 0,
      status: "active",
      result: null,
      reason: null,
      drawOfferBy: null,
      lastMoveAt: new Date().toISOString(),
      rematchOf: challenge.rematchOf,
      createdAt: new Date().toISOString(),
    };
    writeLocalGames([...readLocalGames(), game]);
    writeLocalChallenges(
      readLocalChallenges().map((c) => (c.id === challenge.id ? { ...c, status: "accepted", gameId: game.id } : c)),
    );
    return { gameId: game.id };
  },

  async declineChallenge(id: string): Promise<void> {
    const me = getDevMember().userId;
    const challenge = findChallenge({ id });
    if (!challenge || challenge.recipientId !== me || challenge.status !== "pending") {
      throw new Error("This challenge cannot be declined.");
    }
    writeLocalChallenges(readLocalChallenges().map((c) => (c.id === id ? { ...c, status: "declined" } : c)));
  },

  async cancelChallenge(id: string): Promise<void> {
    const me = getDevMember().userId;
    const challenge = findChallenge({ id });
    if (!challenge || challenge.createdBy !== me || challenge.status !== "pending") {
      throw new Error("This challenge cannot be cancelled.");
    }
    writeLocalChallenges(readLocalChallenges().map((c) => (c.id === id ? { ...c, status: "cancelled" } : c)));
  },

  async listMyChallenges(): Promise<{ outgoing: ChessChallenge[]; incoming: ChessChallenge[] }> {
    const me = getDevMember().userId;
    const pending = readLocalChallenges().filter((c) => c.status === "pending");
    return {
      outgoing: pending.filter((c) => c.createdBy === me).map((c) => toChessChallenge(c, me)),
      incoming: pending.filter((c) => c.recipientId === me).map((c) => toChessChallenge(c, me)),
    };
  },

  async listMyGames(): Promise<ChessGame[]> {
    const me = getDevMember().userId;
    return readLocalGames()
      .filter((g) => g.whiteId === me || g.blackId === me)
      .map((g) => toChessGame(g, me))
      .sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return new Date(b.lastMoveAt).getTime() - new Date(a.lastMoveAt).getTime();
      });
  },

  async getGame(id: string): Promise<ChessGame | null> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === id);
    if (!game) return null;
    if (game.whiteId !== me && game.blackId !== me && !(sharesAnyGroup(me, game.whiteId) && sharesAnyGroup(me, game.blackId))) {
      return null;
    }
    return toChessGame(game, me);
  },

  subscribeToGame(id: string, onChange: (game: ChessGame | null) => void): () => void {
    let cancelled = false;
    async function refetch() {
      const game = await localChessDataSource.getGame(id);
      if (!cancelled) onChange(game);
    }
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = () => void refetch();
    } catch {
      // Unavailable — falls back to the focus/visibility refetches below only.
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refetch();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refetch);
    return () => {
      cancelled = true;
      channel?.close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refetch);
    };
  },

  async makeMove({ gameId, uci, san, fen, pgn, expectedPly, result, reason }): Promise<void> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === gameId);
    if (!game) throw new Error("Not a player in this game.");
    if (game.whiteId !== me && game.blackId !== me) throw new Error("Not a player in this game.");
    if (game.status !== "active") throw new Error("This game has already finished.");
    const mover = game.ply % 2 === 0 ? game.whiteId : game.blackId;
    if (mover !== me) throw new Error("Not your turn.");
    if (game.ply !== expectedPly) throw new Error("Stale move — refresh and try again.");
    const updated: LocalGame = {
      ...game,
      fen,
      pgn,
      lastMoveUci: uci,
      lastMoveSan: san,
      ply: game.ply + 1,
      lastMoveAt: new Date().toISOString(),
      drawOfferBy: null,
      status: result ? "finished" : "active",
      result: result ?? null,
      reason: reason ?? null,
    };
    writeLocalGames(readLocalGames().map((g) => (g.id === gameId ? updated : g)));
  },

  async resign(gameId: string): Promise<void> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === gameId && g.status === "active");
    if (!game || (game.whiteId !== me && game.blackId !== me)) throw new Error("Not an active game you are playing.");
    const result: ChessResult = game.whiteId === me ? "black_won" : "white_won";
    writeLocalGames(
      readLocalGames().map((g) => (g.id === gameId ? { ...g, status: "finished", result, reason: "resignation" } : g)),
    );
  },

  async offerDraw(gameId: string): Promise<void> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === gameId && g.status === "active");
    if (!game || (game.whiteId !== me && game.blackId !== me)) throw new Error("Not an active game you are playing.");
    writeLocalGames(readLocalGames().map((g) => (g.id === gameId ? { ...g, drawOfferBy: me } : g)));
  },

  async respondDraw(gameId: string, accept: boolean): Promise<void> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === gameId && g.status === "active");
    if (!game || (game.whiteId !== me && game.blackId !== me)) throw new Error("Not an active game you are playing.");
    if (!game.drawOfferBy || game.drawOfferBy === me) throw new Error("No draw offer to respond to.");
    writeLocalGames(
      readLocalGames().map((g) =>
        g.id === gameId
          ? accept
            ? { ...g, status: "finished", result: "draw", reason: "draw-agreement" }
            : { ...g, drawOfferBy: null }
          : g,
      ),
    );
  },

  async claimAbandoned(gameId: string): Promise<void> {
    const me = getDevMember().userId;
    const game = readLocalGames().find((g) => g.id === gameId && g.status === "active");
    if (!game || (game.whiteId !== me && game.blackId !== me)) throw new Error("Not an active game you are playing.");
    const mover = game.ply % 2 === 0 ? game.whiteId : game.blackId;
    if (mover === me) throw new Error("You are the one to move — nothing to claim.");
    if (Date.now() - new Date(game.lastMoveAt).getTime() <= ABANDON_DAYS * 24 * 60 * 60 * 1000) {
      throw new Error("Not abandoned yet.");
    }
    const result: ChessResult = game.whiteId === me ? "white_won" : "black_won";
    writeLocalGames(
      readLocalGames().map((g) => (g.id === gameId ? { ...g, status: "finished", result, reason: "abandoned" } : g)),
    );
  },

  async myRecord(): Promise<ChessRecordRow[]> {
    const me = getDevMember().userId;
    const finished = readLocalGames().filter((g) => g.status === "finished" && (g.whiteId === me || g.blackId === me));
    const byOpponent = new Map<string, { wins: number; losses: number; draws: number }>();
    let wins = 0, losses = 0, draws = 0;
    for (const g of finished) {
      const opponentId = g.whiteId === me ? g.blackId : g.whiteId;
      const side = toResultSide(g.result);
      const outcome: "win" | "loss" | "draw" = side === "draw" ? "draw" : side === myColorFor(g.whiteId, g.blackId, me) ? "win" : "loss";
      if (outcome === "win") wins++;
      else if (outcome === "loss") losses++;
      else draws++;
      const row = byOpponent.get(opponentId) ?? { wins: 0, losses: 0, draws: 0 };
      if (outcome === "win") row.wins++;
      else if (outcome === "loss") row.losses++;
      else row.draws++;
      byOpponent.set(opponentId, row);
    }
    const rows: ChessRecordRow[] = [{ opponentId: null, opponentName: "Overall", wins, losses, draws }];
    for (const [opponentId, rec] of byOpponent) {
      rows.push({ opponentId, opponentName: localDisplayName(opponentId), ...rec });
    }
    return rows;
  },

  async myBadge(): Promise<ChessBadge> {
    const me = getDevMember().userId;
    const yourTurnCount = readLocalGames().filter(
      (g) => g.status === "active" && myColorFor(g.whiteId, g.blackId, me) !== null && myColorFor(g.whiteId, g.blackId, me) === (g.ply % 2 === 0 ? "white" : "black"),
    ).length;
    const incomingChallengeCount = readLocalChallenges().filter(
      (c) => c.recipientId === me && c.status === "pending" && new Date(c.expiresAt).getTime() > Date.now(),
    ).length;
    return { yourTurnCount, incomingChallengeCount };
  },
};

export const chessDataSource: ChessDataSource =
  import.meta.env.VITE_DATA_SOURCE === "supabase" ? supabaseChessDataSource : localChessDataSource;
