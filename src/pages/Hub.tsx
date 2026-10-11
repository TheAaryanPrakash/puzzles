import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { SiteHeader } from "../components/SiteHeader";
import { gameMetas } from "../routes";
import { dataSource } from "../lib/data";
import { todayKey, dayIndex } from "../lib/daily";
import { BIRTHDAY } from "../config";
import { useAuth } from "../lib/auth";
import type { FinaleMessage, PlayStatus } from "../lib/data/types";

type HubStatus = PlayStatus | "none";

const STATUS_BADGE: Record<HubStatus, { label: string; className: string } | null> = {
  won: { label: "✓ Solved", className: "bg-brand-success text-white" },
  lost: { label: "Played", className: "bg-brand-muted text-white" },
  in_progress: { label: "In progress", className: "bg-brand-accent text-brand-accent-fg" },
  none: null,
};

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
  const [message, setMessage] = useState<FinaleMessage | null>(null);
  const { member } = useAuth();
  const reduceMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  // Carries dev's `?date=` override through to /finale (same reasoning as GameLayout's `?day=`
  // link building): a plain `<Link to="/finale">` would drop it, and todayKey() would revert to
  // the real date on that page, making an unlocked message look locked again.
  const finaleHref = searchParams.toString() ? `/finale?${searchParams.toString()}` : "/finale";

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      gameMetas.map(async (meta) => {
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

  const puzzleNumber = dayIndex(today) + 1;
  const solvedCount = gameMetas.filter((m) => statusByGame[m.id] === "won").length;
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
            className="flex h-11 w-11 items-center justify-center rounded-brand-full text-xl transition-colors duration-brand-fast hover:bg-brand-surface-2"
          >
            👤
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
            {solvedCount} / {gameMetas.length} solved today
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {gameMetas.map((meta, i) => {
            const badge = STATUS_BADGE[statusByGame[meta.id] ?? "none"];
            return (
              <motion.div
                key={meta.id}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduceMotion ? 0 : Math.min(i, 8) * 0.03 }}
              >
                <Link
                  to={`/${meta.id}`}
                  className="group relative flex h-full flex-col gap-1.5 overflow-hidden rounded-brand-lg border border-brand-border bg-brand-surface p-4 shadow-brand-sm transition-[transform,box-shadow] duration-brand-base ease-brand hover:-translate-y-1 hover:shadow-brand-md active:translate-y-0"
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{ backgroundColor: meta.hubAccent }}
                  />
                  <span className="truncate font-brand text-base font-semibold text-brand-fg">
                    {meta.title}
                  </span>
                  <span className="line-clamp-2 text-xs text-brand-muted">{meta.tagline}</span>
                  <span className="mt-auto pt-2">
                    {badge ? (
                      <span
                        className={`inline-flex items-center rounded-brand-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-brand-muted group-hover:text-brand-accent">
                        Play today →
                      </span>
                    )}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
