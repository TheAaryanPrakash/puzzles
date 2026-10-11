// Production DataSource — Supabase Postgres + RLS. See docs/research/backend.md for the research
// behind the choices here (PKCE auth, error mapping, the (select auth.uid()) RLS rewrite in
// 0002_rls_performance.sql). All rules that matter (released puzzles only, one play each, streaks)
// live in the database (supabase/migrations) — this file only shapes requests/responses to match
// the frozen `DataSource` interface.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types";
import type { DataSource, FinaleMessage, Group, GroupMember, LeaderboardRow, Play, PlayStatus } from "./types";

// Created lazily, not at module load: this module is imported unconditionally by
// src/lib/data/index.ts (so the `local` adapter's import graph includes it too), and every game
// agent's dev server runs with VITE_DATA_SOURCE=local and no Supabase env vars at all. A top-level
// createClient() call would throw for all of them before a single game page could render.
let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to use VITE_DATA_SOURCE=supabase " +
        "(see .env.example).",
    );
  }
  client = createClient<Database>(url, anonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/**
 * Maps a Postgres/PostgREST error to a message a member can read. The schema enforces every rule
 * (release gating, one play each, reserve switching, invite codes) itself, so by the time a call
 * fails there's always a specific, known reason — never a generic 500 to explain away.
 */
export function friendlyError(error: { message: string; code?: string }): Error {
  const msg = error.message;
  if (error.code === "23505" || /duplicate key value/.test(msg)) {
    return new Error("You've already played this one.");
  }
  if (/row-level security policy/.test(msg)) {
    return new Error("This puzzle isn't available yet.");
  }
  if (/invalid invite code/.test(msg)) {
    return new Error("That invite code isn't right.");
  }
  if (/profiles_display_name_check/.test(msg)) {
    return new Error("Name must be between 1 and 30 characters.");
  }
  if (/groups_name_check/.test(msg)) {
    return new Error("Name must be between 1 and 40 characters.");
  }
  if (/cannot switch to the reserve puzzle/.test(msg)) {
    return new Error("You can only switch to the reserve puzzle before your first move.");
  }
  if (/you can create at most 3 groups/.test(msg)) {
    return new Error("You can create at most 3 groups.");
  }
  if (/only the creator can/.test(msg)) {
    return new Error("Only the group's creator can do that.");
  }
  if (/use leave_group to remove yourself/.test(msg)) {
    return new Error('Use "Leave group" instead of removing yourself.');
  }
  if (/cannot leave your last group/.test(msg)) {
    return new Error("You can't leave your last group.");
  }
  if (/not a member of this group/.test(msg)) {
    return new Error("You're not a member of that group.");
  }
  if (/not signed in|members only/.test(msg)) {
    return new Error("Sign in and join to play.");
  }
  return new Error("Something went wrong. Please try again.");
}

function toPlay<S>(row: Database["public"]["Tables"]["plays"]["Row"]): Play<S> {
  return {
    gameId: row.game_id,
    date: row.puzzle_date,
    variant: row.variant,
    status: row.status,
    state: row.state as S,
    summary: row.summary ?? undefined,
    score: row.score ?? undefined,
  };
}

/** True once a play row exists and is no longer `in_progress` — used to word a 0-row update's error. */
async function isAlreadyFinished(
  db: SupabaseClient<Database>,
  gameId: string,
  date: string,
): Promise<boolean> {
  const { data } = await db
    .from("plays")
    .select("status")
    .eq("game_id", gameId)
    .eq("puzzle_date", date)
    .maybeSingle();
  return data !== null && data.status !== "in_progress";
}

export const supabaseDataSource: DataSource = {
  async getPuzzle<T>(gameId: string, date: string): Promise<{ main: T; reserve?: T } | null> {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("puzzles")
      .select("payload, reserve")
      .eq("game_id", gameId)
      .eq("puzzle_date", date)
      .maybeSingle();
    if (error) throw friendlyError(error);
    if (!data) return null; // RLS hides future rows, and this also covers "doesn't exist"
    return { main: data.payload as T, reserve: (data.reserve as T | null) ?? undefined };
  },

  async getPlay<S>(gameId: string, date: string): Promise<Play<S> | null> {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("plays")
      .select("*")
      .eq("game_id", gameId)
      .eq("puzzle_date", date)
      .maybeSingle();
    if (error) throw friendlyError(error);
    return data ? toPlay<S>(data) : null;
  },

  async startPlay(gameId: string, date: string, variant: "main" | "reserve" = "main"): Promise<Play> {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("plays")
      .insert({ game_id: gameId, puzzle_date: date, variant })
      .select("*")
      .single();
    if (error) throw friendlyError(error);
    return toPlay(data);
  },

  async savePlay<S>(
    gameId: string,
    date: string,
    patch: Partial<Pick<Play<S>, "state" | "variant">>,
  ): Promise<void> {
    const db = getSupabaseClient();
    const update: Database["public"]["Tables"]["plays"]["Update"] = {};
    if (patch.state !== undefined) update.state = patch.state;
    if (patch.variant !== undefined) update.variant = patch.variant;
    const { data, error } = await db
      .from("plays")
      .update(update)
      .eq("game_id", gameId)
      .eq("puzzle_date", date)
      .select("game_id");
    if (error) throw friendlyError(error);
    if (!data || data.length === 0) {
      // The RLS `using` clause silently excludes a finished play's row instead of erroring, so a
      // 0-row update needs its own check to tell "already played" apart from "never started".
      const finished = await isAlreadyFinished(db, gameId, date);
      throw new Error(
        finished ? "You've already played this one." : "No play to save — start the puzzle first.",
      );
    }
  },

  async finishPlay(
    gameId: string,
    date: string,
    result: { won: boolean; state: unknown; summary: string; score?: number },
  ): Promise<void> {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("plays")
      .update({
        status: result.won ? "won" : "lost",
        state: result.state,
        summary: result.summary,
        score: result.score ?? null,
      })
      .eq("game_id", gameId)
      .eq("puzzle_date", date)
      .select("game_id");
    if (error) throw friendlyError(error);
    if (!data || data.length === 0) {
      const finished = await isAlreadyFinished(db, gameId, date);
      throw new Error(
        finished ? "You've already played this one." : "No play to finish — start the puzzle first.",
      );
    }
  },

  async getStats() {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("my_stats");
    if (error) throw friendlyError(error);
    const result: Record<
      string,
      { played: number; won: number; currentStreak: number; maxStreak: number }
    > = {};
    for (const row of data ?? []) {
      result[row.game_id] = {
        played: row.played,
        won: row.won,
        currentStreak: row.current_streak,
        maxStreak: row.max_streak,
      };
    }
    return result;
  },

  async getFriendsResults(
    gameId: string,
    date: string,
    groupId: string,
  ): Promise<{ name: string; status: PlayStatus; summary: string; score?: number }[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("friends_results", {
      p_game: gameId,
      p_group_id: groupId,
      p_date: date,
    });
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      name: row.display_name,
      status: row.status,
      summary: row.summary ?? "",
      score: row.score ?? undefined,
    }));
  },

  async listPlays(gameId: string): Promise<{ date: string; status: PlayStatus; score?: number }[]> {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("plays")
      .select("puzzle_date, status, score")
      .eq("game_id", gameId)
      .order("puzzle_date", { ascending: true });
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      date: row.puzzle_date,
      status: row.status,
      score: row.score ?? undefined,
    }));
  },

  async getMessage(): Promise<FinaleMessage | null> {
    const db = getSupabaseClient();
    // No filters beyond RLS: "recipient reads unlocked messages" already restricts this to rows
    // where the signed-in member is the recipient, it's unlock_date or later, and they've finished
    // required_games distinct games that day — nothing left to check client-side.
    const { data, error } = await db
      .from("messages")
      .select("content")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw friendlyError(error);
    return data ? (data.content as FinaleMessage) : null;
  },

  async listMyGroups(): Promise<Group[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("my_groups");
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      memberCount: row.member_count,
      isCreator: row.is_creator,
    }));
  },

  async createGroup(name: string): Promise<{ id: string; inviteCode: string }> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("create_group", { name });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    if (!row) throw new Error("Something went wrong. Please try again.");
    return { id: row.id, inviteCode: row.invite_code };
  },

  async joinGroup(code: string): Promise<{ id: string; name: string }> {
    const db = getSupabaseClient();
    // join_with_invite's `name` only becomes the profile's display name the first time a profile
    // is created; this placeholder is never stored for a call made by an existing member, which is
    // the only way the UI calls joinGroup (the very first join goes through useAuth().joinWithInvite,
    // which collects the real name on the Join form).
    const { data, error } = await db.rpc("join_with_invite", { code, name: "Member" });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    if (!row) throw new Error("That invite code isn't right.");
    return { id: row.group_id, name: row.group_name };
  },

  async previewGroup(code: string): Promise<{ id: string; name: string } | null> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("group_preview", { code });
    if (error) throw friendlyError(error);
    const row = data?.[0];
    return row ? { id: row.id, name: row.name } : null;
  },

  async leaveGroup(groupId: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("leave_group", { p_group_id: groupId });
    if (error) throw friendlyError(error);
  },

  async renameGroup(groupId: string, name: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("rename_group", { p_group_id: groupId, p_name: name });
    if (error) throw friendlyError(error);
  },

  async regenerateInviteCode(groupId: string): Promise<string> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("regenerate_invite_code", { p_group_id: groupId });
    if (error) throw friendlyError(error);
    return data as string;
  },

  async listGroupMembers(groupId: string): Promise<GroupMember[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("list_group_members", { p_group_id: groupId });
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      isCreator: row.is_creator,
    }));
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.rpc("remove_member", { p_group_id: groupId, p_user_id: userId });
    if (error) throw friendlyError(error);
  },

  async getLeaderboard(
    scope: "group" | "global",
    opts: { groupId?: string; period: "day" | "week"; date?: string },
  ): Promise<LeaderboardRow[]> {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc("leaderboard", {
      p_scope: scope,
      p_group_id: opts.groupId ?? null,
      p_period: opts.period,
      p_date: opts.date ?? null,
    });
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => ({
      rank: row.rank,
      displayName: row.display_name,
      points: row.points,
      wins: row.wins,
      gamesPlayed: row.games_played,
      isMe: row.is_me,
    }));
  },
};
