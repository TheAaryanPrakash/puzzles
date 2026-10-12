import { Link } from "react-router";

export interface ChessTabsProps {
  active: "computer" | "friends";
}

const TAB_CLASS = "rounded-brand-full px-3 py-1.5 text-sm font-semibold transition-colors duration-brand-fast";

/** The Computer/Friends switcher shared by both chess/index.tsx (computer mode) and
 *  chess/friends/FriendsTab.tsx — a plain navigation (via `?tab=`), not lifted React state, so
 *  the two modes stay fully independent components that mount/unmount on switch. */
export function ChessTabs({ active }: ChessTabsProps) {
  return (
    <div role="tablist" aria-label="Chess mode" className="flex items-center gap-1 rounded-brand-full bg-game-surface-2 p-1">
      <Link
        to="/chess?tab=computer"
        role="tab"
        aria-selected={active === "computer"}
        className={`${TAB_CLASS} ${active === "computer" ? "bg-game-accent text-game-accent-fg" : "text-game-muted hover:text-game-fg"}`}
      >
        Computer
      </Link>
      <Link
        to="/chess?tab=friends"
        role="tab"
        aria-selected={active === "friends"}
        className={`${TAB_CLASS} ${active === "friends" ? "bg-game-accent text-game-accent-fg" : "text-game-muted hover:text-game-fg"}`}
      >
        Friends
      </Link>
    </div>
  );
}
