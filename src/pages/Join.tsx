import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams, type Location } from "react-router";
import { clearInviteCode, readInviteCode, saveInviteCode, useAuth } from "../lib/auth";
import { dataSource } from "../lib/data";
import { Button } from "../components/Button";

/** Looks a code up to preview the group's name, debounced lightly by only re-running when the
 *  trimmed code actually changes. Silently empty for a blank or not-yet-valid code. */
function useGroupPreview(code: string): string | null {
  const [name, setName] = useState<string | null>(null);
  const trimmed = code.trim();

  useEffect(() => {
    if (!trimmed) {
      setName(null);
      return;
    }
    let cancelled = false;
    dataSource
      .previewGroup(trimmed)
      .then((g) => {
        if (!cancelled) setName(g?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  return name;
}

export function Join() {
  const { status, joinWithInvite } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const urlCode = searchParams.get("code");
  const [code, setCode] = useState(() => urlCode ?? readInviteCode() ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const previewName = useGroupPreview(code);

  // Keeps the invite code recoverable across the full-page round trip to Google and back, in
  // case the OAuth redirect's own `?code=` query param gets dropped somewhere along the way.
  useEffect(() => {
    if (code.trim()) saveInviteCode(code.trim());
  }, [code]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await joinWithInvite(code.trim(), name.trim());
      clearInviteCode();
      const from = (location.state as { from?: Location } | null)?.from;
      navigate(from ? `${from.pathname}${from.search}${from.hash}` : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleJoinAnotherGroup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await dataSource.joinGroup(code.trim());
      clearInviteCode();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (status === "loading") return null;

  // Already a member: a bare /join has nothing to do, but a code in the URL (e.g. a friend's
  // link, opened while already signed in) joins that extra group and heads to the Hub.
  if (status === "member") {
    if (!urlCode) return <Navigate to="/" replace />;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg p-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-brand text-2xl font-semibold">
            {previewName ? `Join "${previewName}"?` : "Join this group?"}
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            Your display name is shown to your groups and on the site-wide leaderboard.
          </p>
        </div>
        <form onSubmit={handleJoinAnotherGroup} className="flex w-full max-w-sm flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-brand-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} fullWidth>
            {loading ? "Joining…" : "Join group"}
          </Button>
        </form>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <Navigate
        to="/signin"
        state={{ message: "Sign in with Google to join.", code: code.trim() || undefined }}
        replace
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-brand text-2xl font-semibold">
          {previewName ? `Join "${previewName}"` : "Join Sansita's Puzzles"}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          You're signed in. Enter your invite code and pick a name to start playing.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1 text-left">
          <label htmlFor="join-name" className="text-sm font-medium text-brand-fg">
            Your name
          </label>
          <input
            id="join-name"
            name="name"
            autoComplete="name"
            autoFocus
            required
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-brand-sm border border-brand-border bg-brand-surface p-2 text-brand-fg outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <p className="text-xs text-brand-muted">Shown to your groups and the site-wide leaderboard.</p>
        </div>
        <div className="flex flex-col gap-1 text-left">
          <label htmlFor="join-code" className="text-sm font-medium text-brand-fg">
            Invite code
          </label>
          <input
            id="join-code"
            name="code"
            autoComplete="off"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "join-error" : undefined}
            className="rounded-brand-sm border border-brand-border bg-brand-surface p-2 text-brand-fg outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
        {error && (
          <p id="join-error" role="alert" className="text-sm text-brand-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading || !code.trim() || !name.trim()} fullWidth>
          {loading ? "Joining…" : "Join"}
        </Button>
      </form>
    </div>
  );
}
