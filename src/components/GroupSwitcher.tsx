import { useState } from "react";
import { Link } from "react-router";
import { useActiveGroup } from "../lib/groups";

/** Lets a member switch which friend group the friends board (and leaderboard default) show.
 *  Hidden entirely for a member with only one group — nothing to switch between. */
export function GroupSwitcher() {
  const { groups, activeGroupId, activeGroup, setActiveGroupId, loading } = useActiveGroup();
  const [open, setOpen] = useState(false);

  if (loading || groups.length === 0) return null;

  if (groups.length === 1) {
    return (
      <span className="hidden max-w-[9rem] truncate text-sm font-medium text-brand-muted sm:inline">
        {activeGroup?.name}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[9rem] items-center gap-1 rounded-brand-full border border-brand-border bg-brand-surface px-3 py-1.5 text-sm font-medium text-brand-fg transition-colors duration-brand-fast hover:bg-brand-surface-2 sm:max-w-[12rem]"
      >
        <span className="truncate">{activeGroup?.name ?? "Choose a group"}</span>
        <span aria-hidden className="shrink-0 text-xs text-brand-muted">
          ▾
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Active group"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-brand-md border border-brand-border bg-brand-surface py-1 shadow-brand-md"
          >
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={g.id === activeGroupId}
                  onClick={() => {
                    setActiveGroupId(g.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-brand-fast hover:bg-brand-surface-2 ${
                    g.id === activeGroupId ? "font-semibold text-brand-accent" : "text-brand-fg"
                  }`}
                >
                  <span className="min-w-0 truncate">{g.name}</span>
                  {g.id === activeGroupId && <span aria-hidden>✓</span>}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-brand-border pt-1">
              <Link
                to="/groups"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-brand-accent hover:underline"
              >
                Manage groups
              </Link>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
