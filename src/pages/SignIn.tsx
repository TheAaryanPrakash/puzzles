import { useState } from "react";
import { useLocation } from "react-router";
import { readInviteCode, useAuth } from "../lib/auth";
import { Button } from "../components/Button";

export function SignIn() {
  const { signInWithGoogle } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = location.state as { message?: string; code?: string } | null;
  const inviteCode = state?.code ?? readInviteCode();

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const redirectPath = inviteCode ? `/join?code=${encodeURIComponent(inviteCode)}` : undefined;
      await signInWithGoogle(redirectPath);
      // On success the browser navigates away to Google; loading stays true until it does.
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg p-6 text-center">
      <h1 className="font-brand text-2xl font-semibold">Sansita's Puzzles</h1>
      <p className="max-w-xs text-brand-muted">
        {state?.message ??
          "An invite-only puzzle club for friends. Sign in with Google to play today's puzzles."}
      </p>
      <Button onClick={() => void handleClick()} disabled={loading} autoFocus>
        <GoogleMark />
        {loading ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
