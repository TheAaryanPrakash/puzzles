import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams, type Location } from "react-router";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";

export function Join() {
  const { joinWithInvite } = useAuth();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await joinWithInvite(code.trim(), name.trim());
      const from = (location.state as { from?: Location } | null)?.from;
      navigate(from ? `${from.pathname}${from.search}${from.hash}` : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
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
