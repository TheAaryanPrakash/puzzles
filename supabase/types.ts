// Hand-written Database type mirroring supabase/migrations/0001_init.sql through 0005_chess.sql.
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
      chess_challenges: {
        Row: {
          id: string;
          created_by: string;
          recipient_id: string | null;
          token: string;
          creator_side: "white" | "black";
          status: "pending" | "accepted" | "declined" | "cancelled";
          expires_at: string;
          game_id: string | null;
          rematch_of: string | null;
          created_at: string;
        };
        Insert: never; // every write goes through the RPCs in supabase/migrations/0005_chess.sql
        Update: never;
        Relationships: [];
      };
      chess_games: {
        Row: {
          id: string;
          white_id: string;
          black_id: string;
          fen: string;
          pgn: string;
          last_move_uci: string | null;
          last_move_san: string | null;
          ply: number;
          status: "active" | "finished";
          result: "white_won" | "black_won" | "draw" | null;
          reason:
            | "checkmate"
            | "stalemate"
            | "threefold"
            | "fifty-move"
            | "insufficient-material"
            | "resignation"
            | "draw-agreement"
            | "abandoned"
            | null;
          draw_offer_by: string | null;
          last_move_at: string;
          rematch_of: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
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
      create_challenge: {
        Args: { p_recipient_id?: string | null; p_side?: "white" | "black" | "random" };
        Returns: { id: string; token: string }[];
      };
      create_rematch: {
        Args: { p_game_id: string };
        Returns: { id: string; token: string }[];
      };
      challenge_preview: {
        Args: { p_token: string };
        Returns: { id: string; creator_name: string; side: "white" | "black" }[];
      };
      accept_challenge: {
        Args: { p_id?: string | null; p_token?: string | null };
        Returns: { game_id: string }[];
      };
      decline_challenge: { Args: { p_id: string }; Returns: undefined };
      cancel_challenge: { Args: { p_id: string }; Returns: undefined };
      make_move: {
        Args: {
          p_game_id: string;
          p_uci: string;
          p_san: string;
          p_fen: string;
          p_pgn: string;
          p_expected_ply: number;
          p_result?: "white_won" | "black_won" | "draw" | null;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      resign: { Args: { p_game_id: string }; Returns: undefined };
      offer_draw: { Args: { p_game_id: string }; Returns: undefined };
      respond_draw: { Args: { p_game_id: string; p_accept: boolean }; Returns: undefined };
      claim_abandoned: { Args: { p_game_id: string }; Returns: undefined };
      chess_opponents: {
        Args: Record<PropertyKey, never>;
        Returns: { user_id: string; display_name: string; group_name: string }[];
      };
      my_chess_games: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          white_id: string;
          white_name: string;
          black_id: string;
          black_name: string;
          fen: string;
          pgn: string;
          last_move_san: string | null;
          ply: number;
          status: "active" | "finished";
          result: "white_won" | "black_won" | "draw" | null;
          reason: string | null;
          draw_offer_by: string | null;
          last_move_at: string;
          rematch_of: string | null;
          created_at: string;
          is_my_turn: boolean;
        }[];
      };
      my_chess_badge: {
        Args: Record<PropertyKey, never>;
        Returns: { your_turn_count: number; incoming_challenge_count: number }[];
      };
      my_chess_record: {
        Args: Record<PropertyKey, never>;
        Returns: { opponent_id: string | null; opponent_name: string; wins: number; losses: number; draws: number }[];
      };
    };
  };
}
