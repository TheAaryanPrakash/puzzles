import { Link } from "react-router";
import type { SiteHeaderProps } from "./types";

export function SiteHeader({ title = "Sansita's Puzzles", backTo, rightSlot }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-brand-border bg-brand-surface px-4 py-3">
      <div className="flex items-center gap-3">
        {backTo && (
          <Link to={backTo} aria-label="Back" className="text-brand-fg hover:text-brand-accent">
            ←
          </Link>
        )}
        <span className="font-brand text-lg font-semibold">{title}</span>
      </div>
      {rightSlot}
    </header>
  );
}
