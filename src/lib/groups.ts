import { useCallback, useEffect, useState } from "react";
import { dataSource } from "./data";
import type { Group } from "./data/types";
import { useAuth } from "./auth";

function activeGroupKey(userId: string): string {
  return `sansitas-puzzles:active-group:${userId}`;
}

function readStoredGroupId(userId: string): string | null {
  try {
    return localStorage.getItem(activeGroupKey(userId));
  } catch {
    return null;
  }
}

// Every `useActiveGroup()` call (the header switcher, FriendsBoard, the Hub's leaderboard card,
// /leaderboard itself) owns its own independent useState — localStorage alone only reaches a new
// mount, not instances already on screen. This event fans a change out to all of them immediately,
// the same tab included (unlike the browser's own `storage` event, which only fires in *other* tabs).
const ACTIVE_GROUP_CHANGED_EVENT = "sansitas-puzzles:active-group-changed";

function writeStoredGroupId(userId: string, groupId: string): void {
  try {
    localStorage.setItem(activeGroupKey(userId), groupId);
  } catch {
    // Unavailable (private browsing, disabled storage) — the choice just won't persist.
  }
  window.dispatchEvent(
    new CustomEvent<{ userId: string; groupId: string }>(ACTIVE_GROUP_CHANGED_EVENT, {
      detail: { userId, groupId },
    }),
  );
}

export interface UseActiveGroupResult {
  groups: Group[];
  activeGroupId: string | null;
  activeGroup: Group | null;
  setActiveGroupId: (id: string) => void;
  loading: boolean;
  refresh: () => void;
}

/**
 * Every group the member belongs to, plus which one is "active" — the group the friends board and
 * leaderboard default to. Remembered per user (localStorage), and falls back to the first group if
 * nothing's remembered yet, or the remembered one was left/removed.
 */
export function useActiveGroup(): UseActiveGroupResult {
  const { member } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void dataSource.listMyGroups().then((gs) => {
      if (cancelled) return;
      setGroups(gs);
      const stored = member ? readStoredGroupId(member.userId) : null;
      setActiveGroupIdState(stored && gs.some((g) => g.id === stored) ? stored : (gs[0]?.id ?? null));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [member, tick]);

  useEffect(() => {
    if (!member) return;
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<{ userId: string; groupId: string }>).detail;
      if (detail.userId === member?.userId) setActiveGroupIdState(detail.groupId);
    }
    window.addEventListener(ACTIVE_GROUP_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ACTIVE_GROUP_CHANGED_EVENT, onChanged);
  }, [member]);

  const setActiveGroupId = useCallback(
    (id: string) => {
      setActiveGroupIdState(id);
      if (member) writeStoredGroupId(member.userId, id);
    },
    [member],
  );

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return {
    groups,
    activeGroupId,
    activeGroup: groups.find((g) => g.id === activeGroupId) ?? null,
    setActiveGroupId,
    loading,
    refresh,
  };
}
