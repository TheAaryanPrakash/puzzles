import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { Modal } from "./Modal";
import { ArchivePicker } from "./ArchivePicker";
import GlideSelect, { type GlideSelectOption } from "./fx/GlideSelect";
import { PrevIcon, NextIcon, ArchiveIcon, StatsIcon, HelpIcon } from "./icons";
import { usePlays, useTodayStatus } from "../lib/hooks";
import { resolvePuzzleDate, todayKey, dayIndex } from "../lib/daily";
import { useEdgeSwipe } from "../lib/useEdgeSwipe";
import { allGameMetas, scoredGameMetas } from "../routes";
import type { GameLayoutProps } from "./types";

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-brand-full text-lg transition-colors duration-brand-fast hover:bg-game-surface-2";

/** Hub order, with chess appended last for navigation purposes only — it's excluded from
 *  `scoredGameMetas` (it isn't a daily puzzle, see CLAUDE.md "Chess"), but still belongs in the
 *  prev/next and game-switcher cycle at the end. */
const NAV_GAMES = [...scoredGameMetas, ...allGameMetas.filter((m) => m.id === "chess")];

export function GameLayout({
  game,
  title,
  onHelp,
  onStats,
  headerActions,
  children,
}: GameLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { plays } = usePlays(game);
  const reduceMotion = useReducedMotion();
  const todayStatus = useTodayStatus(useMemo(() => NAV_GAMES.map((m) => m.id), []));

  const viewedDate = resolvePuzzleDate();
  const viewingPastDay = viewedDate !== todayKey();

  // Preserve any other query params (notably dev's `?date=` "today" override) when navigating.
  function hrefForDay(date: string | null): string {
    const params = new URLSearchParams(searchParams);
    if (date) params.set("day", date);
    else params.delete("day");
    const qs = params.toString();
    return `/${game}${qs ? `?${qs}` : ""}`;
  }

  function handleSelectDay(date: string) {
    setArchiveOpen(false);
    navigate(hrefForDay(date));
  }

  const navIndex = NAV_GAMES.findIndex((m) => m.id === game);
  function hrefForOffset(offset: number): string {
    if (navIndex === -1) return `/${game}`;
    const next = NAV_GAMES[(navIndex + offset + NAV_GAMES.length) % NAV_GAMES.length];
    return `/${next.id}`;
  }
  useEdgeSwipe(
    () => navigate(hrefForOffset(-1)),
    () => navigate(hrefForOffset(1)),
  );

  const switcherOptions: GlideSelectOption[] = NAV_GAMES.map((m) => ({
    value: m.id,
    label: todayStatus[m.id] === "won" || todayStatus[m.id] === "lost" ? `${m.title} ✓` : m.title,
  }));

  return (
    // bg-game-bg/85 (not a flat opaque bg-game-bg): AppShell's FluxLines is mounted once at the
    // route root, behind every page — a fully opaque page background here would paint over it
    // completely, which is what it did before this fix (verified: zero bleed-through at 95%, the
    // lines are thin/sparse enough that anything short of real translucency hides them). 85% is a
    // judgment call — visibly "calm" without touching legibility, since every actual content
    // surface (tiles, cards, modals) still uses its own fully opaque --game-surface/
    // --game-surface-2 token; worth the human's eye on the exact number.
    <div data-game={game} className="min-h-screen bg-game-bg/85 font-game text-game-fg">
      <a
        href="#main-content"
        className="sr-only rounded-brand-sm bg-game-accent px-4 py-2 font-semibold text-game-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      {/* grid-cols-3 (Tailwind's plain 3-equal-column utility — compiles to repeat(3,
          minmax(0,1fr)), not an arbitrary [1fr_auto_1fr]/[1fr_auto_auto]): the title stays
          genuinely page-centered only when all three tracks are equally flexible.
          - A bare `1fr` side track's minimum is its own content's max-content size, so when one
            side's icon cluster is wider than the other's (e.g. a game with headerActions, or "N
            left" text), two "equal" 1fr tracks end up unequal width and the center drifts toward
            the narrower side — measured live, ~25px off center on Quordle.
          - An `auto` (or even `minmax(0,auto)`) center track doesn't fix that either: CSS Grid
            gives non-flexible tracks their max-content size first and only shrinks the *flexible*
            (fr) tracks to make room, regardless of minmax(0,_)'s floor — so on a long title +
            headerActions at 375px (confirmed live on Connections: "Connections" + its Skip button)
            the center rendered at full size and visibly overlapped the right column instead of the
            h1's existing `truncate` ever engaging.
          Making the center `minmax(0,1fr)` too (i.e. grid-cols-3) puts all three tracks in the same
          flexible pool, so a real space deficit shrinks them together instead of one winning
          outright — confirmed live: title now truncates instead of overlapping, and still sits
          exactly page-centered for every normal-length title. */}
      <header className="grid grid-cols-3 items-center gap-2 border-b border-game-border bg-game-surface px-3 py-2.5">
        <div className="flex items-center gap-1 justify-self-start">
          <Link
            to="/"
            aria-label="Back to hub"
            className={`${ICON_BUTTON} text-game-fg hover:text-game-accent`}
          >
            ←
          </Link>
          <Link
            to={hrefForOffset(-1)}
            aria-label="Previous game"
            className={`${ICON_BUTTON} hidden text-game-fg hover:text-game-accent sm:flex`}
          >
            <PrevIcon className="h-5 w-5" />
          </Link>
        </div>

        {/* No justify-self-center here (left/right keep justify-self-start/-end on purpose, to hug
            their own edge) — a grid item's default justify-self is `stretch`, but *setting* it to
            start/center/end makes the item size to its own content (fit-content) instead,
            completely ignoring its track's actual width. With justify-self-center here, this div
            never received the grid's 111px-ish track constraint at all — it just grew to fit
            content, which is why min-w-0 and `truncate` on the h1 below did nothing (there was
            nothing bounding the parent for truncate to shrink against). Letting it stretch (the
            default) gives it the real track width; the h1's own min-w-0 + truncate — see below —
            is what actually makes it shrink/ellipsize within that now-bounded box, while the inner
            `justify-center` keeps the (possibly truncated) content visually centered inside it. */}
        <div className="flex min-w-0 items-center justify-center gap-2">
          {/* min-w-0: `truncate`'s ellipsis only engages once the element can shrink below its own
              content width, and a flex item's default min-width is `auto` (its content size)
              regardless of a parent's min-w-0 — the classic "truncate does nothing inside a flex
              row" gotcha.
              sr-only below sm: GlideSelect's own trigger already shows this exact text as its
              selected value (e.g. "Connections ▾" right next to a "Connections" h1) — fine with
              room to spare, but on a game with headerActions (Quordle's "N left", Connections'
              Skip button, Mini's Skip button), that literal duplication was the actual source of
              the remaining overflow at 375px: GlideSelect's own label has no truncate support, so
              once the h1 truncated to near-zero width there still wasn't enough room for a
              headerActions-heavy right column. Hiding the redundant text (not the interactive
              GlideSelect) is a real fix, not a size hack; still present for screen readers. */}
          <h1 className="sr-only min-w-0 truncate text-balance font-game text-lg font-semibold tracking-tight sm:not-sr-only">
            {title}
          </h1>
          <GlideSelect
            options={switcherOptions}
            value={game}
            onChange={(id) => navigate(`/${id}`)}
            ariaLabel="Switch game"
            size="sm"
            accentColor="var(--brand-accent)"
            surfaceColor="var(--game-surface-2)"
            highlightColor="var(--brand-accent)"
            textColor="var(--game-fg)"
            menuWidth={200}
          />
        </div>

        <div className="flex items-center gap-1 justify-self-end">
          {headerActions}
          <Link
            to={hrefForOffset(1)}
            aria-label="Next game"
            className={`${ICON_BUTTON} hidden text-game-fg hover:text-game-accent sm:flex`}
          >
            <NextIcon className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            aria-label="Archive"
            className={ICON_BUTTON}
          >
            <ArchiveIcon className="h-5 w-5" />
          </button>
          {onStats && (
            <button type="button" onClick={onStats} aria-label="Statistics" className={ICON_BUTTON}>
              <StatsIcon className="h-5 w-5" />
            </button>
          )}
          {onHelp && (
            <button type="button" onClick={onHelp} aria-label="How to play" className={ICON_BUTTON}>
              <HelpIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {viewingPastDay && (
        <div className="flex items-center justify-center gap-2 bg-game-surface-2 px-4 py-2 text-sm text-game-muted">
          <span>
            Puzzle #{dayIndex(viewedDate) + 1} · {formatDate(viewedDate)}
          </span>
          <span aria-hidden>·</span>
          <Link to={hrefForDay(null)} className="font-semibold text-game-accent hover:underline">
            Back to today
          </Link>
        </div>
      )}

      <motion.main
        id="main-content"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-xl px-4 py-6"
      >
        {children}
      </motion.main>

      <Modal open={archiveOpen} onClose={() => setArchiveOpen(false)} title="Archive">
        <ArchivePicker
          gameId={game}
          playedDates={plays.map((p) => p.date)}
          onSelect={handleSelectDay}
        />
      </Modal>
    </div>
  );
}
