import { useEffect, useState } from "react";
import { Link } from "react-router";
import { SiteHeader } from "../components/SiteHeader";
import { gameMetas } from "../routes";
import { dataSource } from "../lib/data";
import { todayKey } from "../lib/daily";
import type { PlayStatus } from "../lib/data/types";

type HubStatus = PlayStatus | "none";

const LABEL: Record<HubStatus, string> = {
  won: "✅ Solved",
  lost: "❌ Played",
  in_progress: "⏳ In progress",
  none: "Play today",
};

export function Hub() {
  const [today] = useState(todayKey);
  const [statusByGame, setStatusByGame] = useState<Record<string, HubStatus>>({});

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

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader
        rightSlot={
          <Link to="/profile" aria-label="Profile" className="text-xl">
            👤
          </Link>
        }
      />
      <main className="mx-auto grid max-w-3xl grid-cols-2 gap-4 p-4 sm:grid-cols-3">
        {gameMetas.map((meta) => (
          <Link
            key={meta.id}
            to={`/${meta.id}`}
            style={{ borderColor: meta.hubAccent }}
            className="flex flex-col gap-2 rounded-brand-lg border-2 bg-brand-surface p-4 transition-transform hover:-translate-y-0.5"
          >
            <span className="font-brand text-lg font-semibold">{meta.title}</span>
            <span className="text-sm text-brand-muted">{meta.tagline}</span>
            <span className="text-xs font-semibold uppercase text-brand-muted">
              {LABEL[statusByGame[meta.id] ?? "none"]}
            </span>
          </Link>
        ))}
      </main>
    </div>
  );
}
