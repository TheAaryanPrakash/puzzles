import { useEffect, useState, type FormEvent } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { Button } from "../components/Button";
import { useActiveGroup } from "../lib/groups";
import { dataSource } from "../lib/data";
import { shareResult } from "../lib/share";
import type { Group, GroupMember } from "../lib/data/types";

const MAX_CREATED_GROUPS = 3;

function inviteLinkFor(code: string): string {
  return `${window.location.origin}/join?invite=${encodeURIComponent(code)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </Button>
  );
}

function MemberRoster({
  group,
  onChanged,
}: {
  group: Group;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void dataSource.listGroupMembers(group.id).then((m) => {
      if (!cancelled) setMembers(m);
    });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  if (members === null) {
    return <p className="mt-2 text-sm text-brand-muted">Loading members…</p>;
  }

  async function handleRemove(userId: string) {
    setError(null);
    setRemovingId(userId);
    try {
      await dataSource.removeMember(group.id, userId);
      setMembers((m) => m?.filter((x) => x.userId !== userId) ?? null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mt-2">
      {error && (
        <p role="alert" className="mb-2 text-sm text-brand-danger">
          {error}
        </p>
      )}
      <ul className="divide-y divide-brand-border overflow-hidden rounded-brand-md border border-brand-border">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center justify-between gap-2 bg-brand-surface px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">
              {m.displayName}
              {m.isCreator && <span className="ml-1 text-xs text-brand-muted">(creator)</span>}
            </span>
            {!m.isCreator && (
              <Button
                variant="ghost"
                size="sm"
                disabled={removingId === m.userId}
                onClick={() => void handleRemove(m.userId)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupCard({ group, canLeave, onChanged }: { group: Group; canLeave: boolean; onChanged: () => void }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(group.name);
  const [showRoster, setShowRoster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inviteLink = inviteLinkFor(group.inviteCode);

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await dataSource.renameGroup(group.id, name.trim());
      setEditingName(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateCode() {
    setError(null);
    setBusy(true);
    try {
      await dataSource.regenerateInviteCode(group.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setError(null);
    setBusy(true);
    try {
      await dataSource.leaveGroup(group.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <li className="rounded-brand-lg border border-brand-border bg-brand-surface p-4 shadow-brand-sm">
      {editingName ? (
        <form onSubmit={handleRename} className="flex items-center gap-2">
          <input
            autoFocus
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-brand-sm border border-brand-border bg-brand-surface p-1.5 text-brand-fg outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingName(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-brand text-lg font-semibold text-brand-fg">{group.name}</h3>
          {group.isCreator && (
            <button
              type="button"
              onClick={() => {
                setName(group.name);
                setEditingName(true);
              }}
              className="shrink-0 text-xs font-semibold text-brand-accent hover:underline"
            >
              Rename
            </button>
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-brand-muted">
        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        {group.isCreator && " · you created this group"}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 rounded-brand-sm bg-brand-surface-2 px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-sm text-brand-fg">{inviteLink}</code>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton text={inviteLink} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void shareResult(`Join my group "${group.name}" on Sansita's Puzzles: ${inviteLink}`)}
        >
          Share
        </Button>
        {group.isCreator && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleRegenerateCode()}>
            New code
          </Button>
        )}
        {group.isCreator && (
          <Button variant="secondary" size="sm" onClick={() => setShowRoster((v) => !v)}>
            {showRoster ? "Hide members" : "Manage members"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!canLeave || busy}
          onClick={() => void handleLeave()}
          aria-label={canLeave ? "Leave group" : "Can't leave your only group"}
        >
          Leave
        </Button>
      </div>

      {showRoster && group.isCreator && <MemberRoster group={group} onChanged={onChanged} />}
    </li>
  );
}

export function Groups() {
  const { groups, loading, refresh } = useActiveGroup();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createdCount = groups.filter((g) => g.isCreator).length;
  const atLimit = createdCount >= MAX_CREATED_GROUPS;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await dataSource.createGroup(name.trim());
      setName("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader title="Groups" backTo="/" />
      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <h1 className="sr-only">Your groups</h1>

        {loading ? null : groups.length === 0 ? (
          <p className="text-sm text-brand-muted">You're not in any groups yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} canLeave={groups.length > 1} onChanged={refresh} />
            ))}
          </ul>
        )}

        <section className="mt-6 rounded-brand-lg border border-dashed border-brand-border p-4">
          <h2 className="font-brand text-base font-semibold text-brand-fg">Create a group</h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            {createdCount} of {MAX_CREATED_GROUPS} used
          </p>
          <form onSubmit={handleCreate} className="mt-3 flex items-center gap-2">
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={atLimit}
              placeholder="Group name"
              aria-label="Group name"
              className="min-w-0 flex-1 rounded-brand-sm border border-brand-border bg-brand-surface p-2 text-brand-fg outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-50"
            />
            <Button type="submit" size="sm" disabled={creating || atLimit || !name.trim()}>
              Create
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-brand-danger">
              {error}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
