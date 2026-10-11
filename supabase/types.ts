// Hand-written Database type mirroring supabase/migrations/0001_init.sql + 0002_rls_performance.sql.
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
      join_with_invite: { Args: { code: string; name: string }; Returns: undefined };
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
        Args: { p_game: string; p_date?: string | null };
        Returns: {
          display_name: string;
          status: "in_progress" | "won" | "lost";
          summary: string | null;
          score: number | null;
          completed_at: string | null;
        }[];
      };
    };
  };
}
