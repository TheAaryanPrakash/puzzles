import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useStats } from "../lib/hooks";
import { Button } from "../components/Button";
import { SiteHeader } from "../components/SiteHeader";
import { allGameMetas } from "../routes";

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
            <ul className="mt-2 divide-y divide-brand-border">
              {played.map(({ meta, s }) => (
                <li key={meta.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{meta.title}</span>
                  <span className="text-brand-muted">
                    {s.won}/{s.played} won · streak {s.currentStreak}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
