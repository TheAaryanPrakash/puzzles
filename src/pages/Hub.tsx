import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { SiteHeader } from "../components/SiteHeader";
import MagicBento, { type MagicBentoItem } from "../components/fx/MagicBento";
import { gameMetas, scoredGameMetas } from "../routes";
import { dataSource } from "../lib/data";
import type { ChessBadge } from "../lib/data/chess";
import { todayKey, dayIndex } from "../lib/daily";
import { BIRTHDAY } from "../config";
import { useAuth } from "../lib/auth";
import { useActiveGroup } from "../lib/groups";
import { useLeaderboard } from "../lib/hooks";
import type { FinaleMessage, PlayStatus } from "../lib/data/types";
import type { GameMeta } from "../lib/types";
import {
  WordleIcon,
  QuordleIcon,
  WorldleIcon,
  FlagleIcon,
  GlobleIcon,
  TravleIcon,
  StatesIcon,
  ZipIcon,
  ConnectionsIcon,
  SudokuIcon,
  MiniSudokuIcon,
  MiniIcon,
  DigitsIcon,
  BeeIcon,
  ChessIcon,
  ProfileIcon,
  TrophyIcon,
} from "../components/icons";

type HubStatus = PlayStatus | "none";

const GAME_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  wordle: WordleIcon,
  quordle: QuordleIcon,
  worldle: WorldleIcon,
  flagle: FlagleIcon,
  globle: GlobleIcon,
  travle: TravleIcon,
  states: StatesIcon,
  zip: ZipIcon,
  connections: ConnectionsIcon,
  sudoku: SudokuIcon,
  "mini-sudoku": MiniSudokuIcon,
  mini: MiniIcon,
  digits: DigitsIcon,
  bee: BeeIcon,
  chess: ChessIcon,
};

// Dark ink instead of white: --brand-success (#4ebc85) and --brand-muted (#b899a3) are both too
// light for white text to clear 4.5:1 (measured 2.37:1 / 2.59:1) — same fix pattern as Wordle's
// tile text, see that game's theme.css comment.
const STATUS_BADGE: Record<HubStatus, { label: string; className: string } | null> = {
  won: { label: "✓ Solved", className: "bg-brand-success text-[#140c0f]" },
  lost: { label: "Played", className: "bg-brand-muted text-[#140c0f]" },
  in_progress: { label: "In progress", className: "bg-brand-accent text-brand-accent-fg" },
  none: null,
};

// Flagship (order 1) and the closing unscored tile both get a wider card — everything else is a
// plain 1x1 cell. A couple of size variants is enough rhythm for a 15-tile grid without turning
// this into a layout system; at 375px MagicBento's own ResizeObserver collapses to 1 column
// anyway (see MagicBento.tsx's MIN_CELL/MIN_PAIR), so the variation is a desktop-only effect.
function spanFor(meta: GameMeta): { colSpan: number; rowSpan: number } {
  if (meta.id === "wordle" || meta.id === "chess") return { colSpan: 2, rowSpan: 1 };
  return { colSpan: 1, rowSpan: 1 };
}

function formatToday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function Hub() {
  const [today] = useState(todayKey);
  const [statusByGame, setStatusByGame] = useState<Record<string, HubStatus>>({});
  const [chessBadge, setChessBadge] = useState<ChessBadge | null>(null);
  const [message, setMessage] = useState<FinaleMessage | null>(null);
  const { member } = useAuth();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Carries dev's `?date=` override through to /finale (same reasoning as GameLayout's `?day=`
  // link building): a plain `<Link to="/finale">` would drop it, and todayKey() would revert to
  // the real date on that page, making an unlocked message look locked again.
  const finaleHref = searchParams.toString() ? `/finale?${searchParams.toString()}` : "/finale";

  // Unscored games (chess) never have a play to fetch — they're skipped here rather than calling
  // dataSource.getPlay for a game that structurally never writes one.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      scoredGameMetas.map(async (meta) => {
        const play = await dataSource.getPlay(meta.id, today);
        return [meta.id, (play?.status ?? "none") as HubStatus] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setStatusByGame(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  // Chess's own small badge (turn count + incoming challenges) — never fetches a play status,
  // same reasoning as the scoredGameMetas loop above skipping it entirely. Dynamically imported
  // so src/lib/data/chess.ts (and its Supabase/local adapters) stay out of the Hub's own eagerly-
  // loaded bundle — it only needs to load once chess's lazy route chunk is reachable anyway.
  useEffect(() => {
    let cancelled = false;
    import("../lib/data/chess").then(({ chessDataSource }) => chessDataSource.myBadge()).then((b) => {
      if (!cancelled) setChessBadge(b);
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const puzzleNumber = dayIndex(today) + 1;
  const solvedCount = scoredGameMetas.filter((m) => statusByGame[m.id] === "won").length;
  const isBirthday = today >= BIRTHDAY;

  // Re-checks after every finished game (statusByGame changes whenever a game's status does, and
  // returning to the Hub after finishing one re-runs the effect above first) — "she doesn't get
  // spoiled" for the surprise card the same way the friends board works for a puzzle's results.
  useEffect(() => {
    if (!isBirthday) return;
    let cancelled = false;
    dataSource.getMessage().then((m) => {
      if (!cancelled) setMessage(m);
    });
    return () => {
      cancelled = true;
    };
  }, [isBirthday, statusByGame]);

  const tiles: MagicBentoItem[] = gameMetas.map((meta) => {
    const unscored = meta.scored === false;
    const isChess = meta.id === "chess";
    const chessCount = chessBadge ? chessBadge.yourTurnCount + chessBadge.incomingChallengeCount : 0;
    const badge = unscored ? null : STATUS_BADGE[statusByGame[meta.id] ?? "none"];
    const Icon = GAME_ICONS[meta.id];
    const { colSpan, rowSpan } = spanFor(meta);
    const href = `/${meta.id}`;

    return {
      id: meta.id,
      href,
      colSpan,
      rowSpan,
      // A plain href would hard-reload the page; intercept the plain-click case only, so
      // middle-click/ctrl/cmd-click "open in new tab" still works via the native anchor.
      onClick: (event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(href);
      },
      content: (
        <div className="flex h-full flex-col gap-1.5">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 rounded-t-[inherit]" style={{ backgroundColor: meta.hubAccent }} />
          {Icon && (
            <span className="text-game-accent" style={{ color: meta.hubAccent }}>
              <Icon className="h-6 w-6" />
            </span>
          )}
          <span className="truncate font-brand text-base font-semibold text-brand-fg">{meta.title}</span>
          <span className="line-clamp-2 text-xs text-brand-muted">{meta.tagline}</span>
          <span className="mt-auto pt-2">
            {isChess && chessCount > 0 ? (
              <span className="inline-flex items-center rounded-brand-full bg-brand-accent px-2 py-0.5 text-[11px] font-semibold text-brand-accent-fg">
                {chessCount} {chessCount === 1 ? "game" : "games"} waiting
              </span>
            ) : unscored ? (
              <span className="inline-flex items-center rounded-brand-full bg-brand-surface-2 px-2 py-0.5 text-[11px] font-semibold text-brand-muted">
                Just for fun · unscored
              </span>
            ) : badge ? (
              <span className={`inline-flex items-center rounded-brand-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-brand-muted">Play today →</span>
            )}
          </span>
        </div>
      ),
    };
  });

  return (
    <div className="min-h-screen bg-brand-bg">
      <a
        href="#main-content"
        className="sr-only rounded-brand-sm bg-brand-accent px-4 py-2 font-semibold text-brand-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <SiteHeader
        rightSlot={
          <Link
            to="/profile"
            aria-label="Profile"
            className="flex h-11 w-11 items-center justify-center rounded-brand-full text-brand-fg transition-colors duration-brand-fast hover:bg-brand-surface-2 hover:text-brand-accent"
          >
            <ProfileIcon className="h-5 w-5" />
          </Link>
        }
      />

      <main id="main-content" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {isBirthday && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 rounded-brand-lg bg-brand-accent px-5 py-4 text-center text-brand-accent-fg shadow-brand-md"
          >
            <p className="font-brand text-lg font-bold">🎉 Happy birthday, Sansita! 🎉</p>
            <p className="mt-1 text-sm">
              A whole year of puzzles made just for you. Here’s to today’s round, and many more.
            </p>
          </motion.div>
        )}

        {message && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="mb-6"
          >
            <Link
              to={finaleHref}
              className="flex items-center justify-center gap-2 rounded-brand-lg border-2 border-dashed border-brand-accent bg-brand-surface px-5 py-4 text-center font-brand font-semibold text-brand-accent shadow-brand-sm transition-[transform,box-shadow] duration-brand-base ease-brand hover:-translate-y-0.5 hover:shadow-brand-md"
            >
              🎁 Open your surprise
            </Link>
          </motion.div>
        )}

        <div className="mb-6">
          <h1 className="text-balance font-brand text-2xl font-bold text-brand-fg sm:text-3xl">
            {member?.displayName ? `Hi, ${member.displayName}` : "Welcome back"}
          </h1>
          <p className="mt-1 text-brand-muted">
            {formatToday(today)}
            {puzzleNumber > 0 && <> · Puzzle day #{puzzleNumber}</>}
          </p>
          <p className="mt-3 text-sm font-semibold text-brand-accent">
            {solvedCount} / {scoredGameMetas.length} solved today
          </p>
        </div>

        <LeaderboardCard />

        <MagicBento
          items={tiles}
          columns={3}
          rowHeight={176}
          gap={14}
          radius={20}
          theme="dark"
          glowColor="#df497b"
          intro={!reduceMotion}
        />
      </main>
    </div>
  );
}

/** Today's rank in the active group, linking through to the full /leaderboard page. Stays quiet
 *  (renders nothing) rather than showing an empty state while nothing's loaded yet. */
function LeaderboardCard() {
  const { activeGroupId, activeGroup, loading: groupLoading } = useActiveGroup();
  const { rows, loading } = useLeaderboard("group", { groupId: activeGroupId ?? undefined, period: "day" });

  if (groupLoading || loading || !activeGroup) return null;
  const mine = rows.find((r) => r.isMe);

  return (
    <Link
      to="/leaderboard"
      className="mb-6 flex items-center justify-between gap-3 rounded-brand-lg border border-brand-border bg-brand-surface px-4 py-3 shadow-brand-sm transition-[transform,box-shadow] duration-brand-base ease-brand hover:-translate-y-0.5 hover:shadow-brand-md"
    >
      <span className="flex min-w-0 items-center gap-2">
        <TrophyIcon className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
        <span className="min-w-0">
          <span className="block font-brand text-sm font-semibold text-brand-fg">
            {activeGroup.name} leaderboard
          </span>
          <span className="block text-xs text-brand-muted">
            {mine
              ? `You're #${mine.rank} today with ${mine.points} point${mine.points === 1 ? "" : "s"}`
              : "See how everyone's doing today"}
          </span>
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-brand-muted">
        →
      </span>
    </Link>
  );
}
