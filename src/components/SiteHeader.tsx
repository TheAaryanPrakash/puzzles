import { Link } from "react-router";
import { GroupSwitcher } from "./GroupSwitcher";
import type { SiteHeaderProps } from "./types";

export function SiteHeader({ title = "Sansita's Puzzles", backTo, rightSlot }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-brand-border bg-brand-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-brand-full text-lg text-brand-fg transition-colors duration-brand-fast hover:bg-brand-surface-2 hover:text-brand-accent"
          >
            ←
          </Link>
        )}
        <span className="truncate font-brand text-lg font-semibold tracking-tight">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <GroupSwitcher />
        {rightSlot}
      </div>
    </header>
  );
}
