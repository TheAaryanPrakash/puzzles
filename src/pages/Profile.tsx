import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";

export function Profile() {
  const { member, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-bg p-6">
      <h1 className="font-brand text-2xl font-semibold">{member?.displayName ?? "Profile"}</h1>
      <Button variant="secondary" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
