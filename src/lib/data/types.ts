// FROZEN — see CLAUDE.md "Data layer". Only the human changes this file.

export type PlayStatus = "in_progress" | "won" | "lost";

export interface Play<S = unknown> {
  gameId: string;
  date: string;
  variant: "main" | "reserve";
  status: PlayStatus;
  state: S;
  summary?: string;
  score?: number;
}

/** The birthday finale's content — see `messages.content` in supabase/migrations/0001_init.sql.
 *  `photos`/`video` are paths within the private "finale" Storage bucket, under the recipient's
 *  own user-id folder (`<user_id>/<file>`) — never public URLs. */
export interface FinaleMessage {
  title: string;
  body: string;
  photos: string[];
  video: string | null;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  isCreator: boolean;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  isCreator: boolean;
}

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  isMe: boolean;
}

export interface DataSource {
  getPuzzle<T>(gameId: string, date: string): Promise<{ main: T; reserve?: T } | null>; // null = missing or not released
  getPlay<S>(gameId: string, date: string): Promise<Play<S> | null>;
  startPlay(gameId: string, date: string, variant?: "main" | "reserve"): Promise<Play>;
  savePlay<S>(
    gameId: string,
    date: string,
    patch: Partial<Pick<Play<S>, "state" | "variant">>,
  ): Promise<void>;
  finishPlay(
    gameId: string,
    date: string,
    result: { won: boolean; state: unknown; summary: string; score?: number },
  ): Promise<void>;
  getStats(): Promise<
    Record<string, { played: number; won: number; currentStreak: number; maxStreak: number }>
  >;
  /** `groupId` scopes the board to one friend group — every member sees a different board
   *  depending on which group is active (see `src/lib/groups.ts`'s `useActiveGroup`). */
  getFriendsResults(
    gameId: string,
    date: string,
    groupId: string,
  ): Promise<{ name: string; status: PlayStatus; summary: string; score?: number }[]>;
  listPlays(gameId: string): Promise<{ date: string; status: PlayStatus; score?: number }[]>;
  /** Null until the signed-in member is the message's recipient, it's `unlock_date`, and they've
   *  finished `required_games` different games that day — all enforced server-side, not just here. */
  getMessage(): Promise<FinaleMessage | null>;

  /** Every group the signed-in member belongs to, most recently created first. */
  listMyGroups(): Promise<Group[]>;
  /** Creates a new group (the member becomes its creator and first member). Up to 3 per creator. */
  createGroup(name: string): Promise<{ id: string; inviteCode: string }>;
  /** Joins a group by invite code — the member's existing display name, if any, is kept.
   *  Returns the joined group's id and name (e.g. to say "You joined <name>"). */
  joinGroup(code: string): Promise<{ id: string; name: string }>;
  /** Looks a group up by invite code without joining it — for "you're about to join <name>". */
  previewGroup(code: string): Promise<{ id: string; name: string } | null>;
  /** Leaves a group. Refuses to leave the member's last remaining group. */
  leaveGroup(groupId: string): Promise<void>;
  /** Creator-only: renames the group. */
  renameGroup(groupId: string, name: string): Promise<void>;
  /** Creator-only: rotates the invite code; the old code stops working immediately. */
  regenerateInviteCode(groupId: string): Promise<string>;
  /** Everyone currently in a group — to show a roster, and (creator-only) to pick whom to remove. */
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  /** Creator-only: removes another member from the group (not the creator themself). */
  removeMember(groupId: string, userId: string): Promise<void>;
  /** `scope: "global"` ranks every member and ignores `groupId`; `scope: "group"` requires it.
   *  `date` defaults to today; a `"week"` period is the India-time Sunday–Saturday week containing it. */
  getLeaderboard(
    scope: "group" | "global",
    opts: { groupId?: string; period: "day" | "week"; date?: string },
  ): Promise<LeaderboardRow[]>;
}
