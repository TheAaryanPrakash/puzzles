import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams, type Location } from "react-router";
import { clearInviteCode, readInviteCode, saveInviteCode, useAuth } from "../lib/auth";
import { Button } from "../components/Button";

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

  if (status === "loading") return null;
  if (status === "member") return <Navigate to="/" replace />;
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
        <h1 className="font-brand text-2xl font-semibold">Join Sansita's Puzzles</h1>
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
            placeholder="e.g. Sansita"
            className="rounded-brand-sm border border-brand-border bg-brand-surface p-2 text-brand-fg outline-none focus:ring-2 focus:ring-brand-accent"
          />
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
            placeholder="e.g. sunflower-23"
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
