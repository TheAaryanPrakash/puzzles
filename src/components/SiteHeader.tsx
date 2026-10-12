import { Link } from "react-router";
import { GroupSwitcher } from "./GroupSwitcher";
import type { SiteHeaderProps } from "./types";

export function SiteHeader({ title = "Sansita's Puzzles", backTo, rightSlot }: SiteHeaderProps) {
  return (
    // 3-column grid (redesign, 2026-10 — same fix as GameLayout's header): the title is centered
    // to the page, not to whatever space is left over between the back link and the right slot,
    // which can be very unequal (no back link at all on the Hub vs. a back link + GroupSwitcher +
    // rightSlot on an inner page).
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-brand-border bg-brand-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-brand-full text-lg text-brand-fg transition-colors duration-brand-fast hover:bg-brand-surface-2 hover:text-brand-accent"
          >
            ←
          </Link>
        )}
      </div>
      <span className="truncate text-center font-brand text-lg font-semibold tracking-tight justify-self-center">
        {title}
      </span>
      <div className="flex shrink-0 items-center justify-end gap-2 justify-self-end">
        <GroupSwitcher />
        {rightSlot}
      </div>
    </header>
  );
}
