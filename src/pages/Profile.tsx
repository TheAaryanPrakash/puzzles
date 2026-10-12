import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useStats } from "../lib/hooks";
import { Button } from "../components/Button";
import { SiteHeader } from "../components/SiteHeader";
import { allGameMetas } from "../routes";
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
  FlameIcon,
} from "../components/icons";

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

export function Profile() {
  const { member, signOut, updateDisplayName } = useAuth();
  const { stats, loading } = useStats();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateDisplayName(name.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setName(member?.displayName ?? "");
    setError(null);
    setEditing(true);
  }

  const played = allGameMetas
    .filter((meta) => !meta.id.startsWith("_"))
    .map((meta) => ({ meta, s: stats[meta.id] }))
    .filter((g): g is { meta: (typeof allGameMetas)[number]; s: NonNullable<typeof g.s> } =>
      Boolean(g.s && g.s.played > 0),
    );

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader
        backTo="/"
        rightSlot={
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        }
      />
      <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
        <section className="text-center">
          {editing ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <label htmlFor="profile-name" className="text-sm font-medium text-brand-fg">
                Display name
              </label>
              <input
                id="profile-name"
                autoFocus
                required
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "profile-name-error" : undefined}
                className="rounded-brand-sm border border-brand-border bg-brand-surface p-2 text-center text-brand-fg outline-none focus:ring-2 focus:ring-brand-accent"
              />
              {error && (
                <p id="profile-name-error" role="alert" className="text-sm text-brand-danger">
                  {error}
                </p>
              )}
              <div className="flex justify-center gap-2">
                <Button type="submit" size="sm" disabled={saving || !name.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="font-brand text-2xl font-semibold">{member?.displayName ?? "Profile"}</h1>
              <Button variant="ghost" size="sm" onClick={startEditing} className="mt-1">
                Edit name
              </Button>
            </>
          )}
        </section>

        <section>
          <h2 className="font-brand text-sm font-semibold text-brand-muted">Your stats</h2>
          {loading ? null : played.length === 0 ? (
            <p className="mt-2 text-sm text-brand-muted">No puzzles played yet — go pick one!</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {played.map(({ meta, s }) => {
                const Icon = GAME_ICONS[meta.id];
                return (
                  <div
                    key={meta.id}
                    className="flex flex-col gap-1.5 rounded-brand-lg border border-brand-border bg-brand-surface p-3 shadow-brand-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      {Icon && <Icon className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />}
                      <span className="truncate text-sm font-semibold text-brand-fg">{meta.title}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between text-xs text-brand-muted">
                      <span className="tabular-nums">
                        {s.won}/{s.played} won
                      </span>
                      {s.currentStreak > 0 && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-brand-accent">
                          <FlameIcon className="h-3.5 w-3.5" aria-hidden />
                          {s.currentStreak}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
