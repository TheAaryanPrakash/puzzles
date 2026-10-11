// Hand-written Database type mirroring supabase/migrations/0001_init.sql through 0004_groups.sql.
//
// There's no live Supabase project for this worktree to run the real generator against (see
// docs/research/backend.md), so this is maintained by hand for now. Once a project exists, the
// human should run:
//   pnpm supabase gen types typescript --project-id <project-ref> > supabase/types.ts
// and reconcile any drift — the shapes below (column names, nullability, RPC args/returns) must
// match the migrations exactly, since nothing checks them against the real schema.

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { user_id: string; display_name: string; joined_at: string };
        Insert: { user_id?: string; display_name: string; joined_at?: string };
        Update: { user_id?: string; display_name?: string; joined_at?: string };
        Relationships: [];
      };
      puzzles: {
        Row: {
          game_id: string;
          puzzle_date: string;
          payload: unknown;
          reserve: unknown | null;
        };
        Insert: {
          game_id: string;
          puzzle_date: string;
          payload: unknown;
          reserve?: unknown | null;
        };
        Update: {
          game_id?: string;
          puzzle_date?: string;
          payload?: unknown;
          reserve?: unknown | null;
        };
        Relationships: [];
      };
      plays: {
        Row: {
          user_id: string;
          game_id: string;
          puzzle_date: string;
          variant: "main" | "reserve";
          status: "in_progress" | "won" | "lost";
          state: unknown;
          summary: string | null;
          score: number | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          user_id?: string;
          game_id: string;
          puzzle_date: string;
          variant?: "main" | "reserve";
          status?: "in_progress" | "won" | "lost";
          state?: unknown;
          summary?: string | null;
          score?: number | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          user_id?: string;
          game_id?: string;
          puzzle_date?: string;
          variant?: "main" | "reserve";
          status?: "in_progress" | "won" | "lost";
          state?: unknown;
          summary?: string | null;
          score?: number | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      groups: {
        Row: { id: string; name: string; invite_code: string; created_by: string; created_at: string };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: { group_id: string; user_id: string; joined_at: string };
        Insert: { group_id: string; user_id: string; joined_at?: string };
        Update: { group_id?: string; user_id?: string; joined_at?: string };
        Relationships: [];
      };
      messages: {
        Row: {
          id: number;
          recipient: string;
          unlock_date: string;
          required_games: number;
          content: unknown;
        };
        Insert: {
          id?: number;
          recipient: string;
          unlock_date: string;
          required_games?: number;
          content: unknown;
        };
        Update: {
          id?: number;
          recipient?: string;
          unlock_date?: string;
          required_games?: number;
          content?: unknown;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_with_invite: {
        Args: { code: string; name: string };
        Returns: { group_id: string; group_name: string }[];
      };
      my_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          game_id: string;
          played: number;
          won: number;
          current_streak: number;
          max_streak: number;
        }[];
      };
      friends_results: {
        Args: { p_game: string; p_group_id: string; p_date?: string | null };
        Returns: {
          display_name: string;
          status: "in_progress" | "won" | "lost";
          summary: string | null;
          score: number | null;
          completed_at: string | null;
        }[];
      };
      group_preview: {
        Args: { code: string };
        Returns: { id: string; name: string }[];
      };
      create_group: {
        Args: { name: string };
        Returns: { id: string; invite_code: string }[];
      };
      my_groups: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          invite_code: string;
          member_count: number;
          is_creator: boolean;
          created_at: string;
        }[];
      };
      list_group_members: {
        Args: { p_group_id: string };
        Returns: { user_id: string; display_name: string; joined_at: string; is_creator: boolean }[];
      };
      rename_group: { Args: { p_group_id: string; p_name: string }; Returns: undefined };
      regenerate_invite_code: { Args: { p_group_id: string }; Returns: string };
      remove_member: { Args: { p_group_id: string; p_user_id: string }; Returns: undefined };
      leave_group: { Args: { p_group_id: string }; Returns: undefined };
      leaderboard: {
        Args: {
          p_scope: "group" | "global";
          p_group_id?: string | null;
          p_period?: "day" | "week";
          p_date?: string | null;
        };
        Returns: {
          rank: number;
          display_name: string;
          points: number;
          wins: number;
          games_played: number;
          is_me: boolean;
        }[];
      };
    };
  };
}
