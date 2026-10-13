import { Link } from "react-router";
import { GroupSwitcher } from "./GroupSwitcher";
import type { SiteHeaderProps } from "./types";

export function SiteHeader({ title = "Sansita's Puzzles", backTo, rightSlot }: SiteHeaderProps) {
  return (
    // minmax(0,1fr) side tracks, auto center — not grid-cols-3 (equal thirds): GameLayout.tsx's
    // header uses equal thirds because every game page has a GlideSelect switcher that already
    // shows the game name, so the h1 can hide below sm with nothing lost. SiteHeader's title is the
    // *only* visible label on these pages — forcing it into an equal third truncated "Sansita's
    // Puzzles" to "Sansita's Pu…" on the Hub even though the (empty-on-Hub) side columns had room to
    // spare (confirmed live). None of this component's 5 call sites (Hub/Profile/Leaderboard/
    // Finale/Groups) come anywhere close to needing all three columns truncated at once — worst
    // case is one 44px back icon + one ~95px rightSlot button, well under the ~315px budget the
    // full title + both needs at 375px — so auto (size to content, don't force a cap) is the right
    // choice here, unlike GameLayout.
    // No justify-self-start/-center/-end on any of the three children: setting justify-self to
    // anything but the default `stretch` makes a grid item size to its own content regardless of
    // its track's width, which silently defeats minmax(0,1fr)'s whole point (confirmed live — the
    // side columns measured identically regardless of the grid-template-columns value, until this
    // was removed). Each side stretches to its track and uses its own internal flex justify-* to
    // align content within it.
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-brand-border bg-brand-surface px-4 py-3">
      <div className="flex min-w-0 items-center justify-start gap-2">
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
      {/* min-w-0: truncate's ellipsis only engages once the element can shrink below its own
          content width — a grid item's (post-blockification) default min-width is `auto` (its own
          content size) regardless of the grid-cols-3 fix above, the same "truncate silently does
          nothing" gotcha GameLayout's header has. */}
      <span className="min-w-0 truncate text-center font-brand text-lg font-semibold tracking-tight">
        {title}
      </span>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
        <GroupSwitcher />
        {rightSlot}
      </div>
    </header>
  );
}
