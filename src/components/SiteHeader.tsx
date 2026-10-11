import { Link } from "react-router";
import type { SiteHeaderProps } from "./types";

export function SiteHeader({ title = "Sansita's Puzzles", backTo, rightSlot }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-brand-border bg-brand-surface px-4 py-3">
      <div className="flex items-center gap-2">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-brand-full text-lg text-brand-fg transition-colors duration-brand-fast hover:bg-brand-surface-2 hover:text-brand-accent"
          >
            ←
          </Link>
        )}
        <span className="font-brand text-lg font-semibold tracking-tight">{title}</span>
      </div>
      {rightSlot}
    </header>
  );
}
