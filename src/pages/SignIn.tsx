import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";

export function SignIn() {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg p-6 text-center">
      <h1 className="font-brand text-2xl font-semibold">Sansita's Puzzles</h1>
      <p className="text-brand-muted">Sign in with Google to play today's puzzles.</p>
      <Button onClick={() => void signInWithGoogle()}>Sign in with Google</Button>
    </div>
  );
}
