import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";

export function Join() {
  const { joinWithInvite } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await joinWithInvite(code, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg p-6">
      <h1 className="font-brand text-2xl font-semibold">Join</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-brand-sm border border-brand-border bg-brand-surface p-2"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code"
          className="rounded-brand-sm border border-brand-border bg-brand-surface p-2"
        />
        {error && <p className="text-sm text-brand-danger">{error}</p>}
        <Button type="submit">Join</Button>
      </form>
    </div>
  );
}
