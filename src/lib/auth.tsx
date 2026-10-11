import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { getSupabaseClient, friendlyError } from "./data/supabase";

export interface Member {
  userId: string;
  displayName: string;
}

export type AuthStatus = "loading" | "signed-out" | "signed-in-not-member" | "member";

export interface AuthState {
  status: AuthStatus;
  member: Member | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  joinWithInvite: (code: string, name: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const FAKE_MEMBER: Member = { userId: "local-dev", displayName: "Sansita" };

// Mirrors src/lib/data/index.ts's own switch, so the two always agree on which world we're in.
const usesSupabase = import.meta.env.VITE_DATA_SOURCE === "supabase";

/**
 * Reads the canonical profile row back from the database. Used after every mutation that
 * changes membership or the display name, instead of trusting the mutation's own inputs — an
 * `.update().eq(...)` that matches zero rows (wrong id, RLS) still reports no error, so an
 * optimistic local patch would show "saved" even when nothing changed server-side.
 */
async function fetchProfile(
  db: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<Member | null> {
  const { data } = await db
    .from("profiles")
    .select("user_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { userId: data.user_id, displayName: data.display_name } : null;
}

/**
 * Local dev mode: always signed in as a fake member, so every game can be built and tested
 * without a Supabase project. Paired with VITE_DATA_SOURCE=local in src/lib/data/index.ts.
 */
function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member>(FAKE_MEMBER);
  const value: AuthState = {
    status: "member",
    member,
    async signInWithGoogle() {},
    async signOut() {},
    async joinWithInvite() {},
    async updateDisplayName(name) {
      setMember((m) => ({ ...m, displayName: name }));
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Production: Google OAuth (PKCE) through Supabase Auth, gated by membership in `profiles`.
 * Signing in with Google is not enough to play — a session only becomes a `member` once
 * `joinWithInvite` has redeemed the invite code (see supabase/migrations/0001_init.sql).
 */
function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [member, setMember] = useState<Member | null>(null);

  useEffect(() => {
    const db = getSupabaseClient();
    let cancelled = false;

    // "members read profiles" requires is_member(), so a non-member's own select legitimately
    // returns no row — that's `fetchProfile` returning null, not an error to surface.
    async function applySession(userId: string | undefined) {
      if (!userId) {
        setMember(null);
        setStatus("signed-out");
        return;
      }
      const profile = await fetchProfile(db, userId);
      if (cancelled) return;
      if (profile) {
        setMember(profile);
        setStatus("member");
      } else {
        setMember(null);
        setStatus("signed-in-not-member");
      }
    }

    void db.auth.getSession().then(({ data }) => applySession(data.session?.user.id));

    const { data: subscription } = db.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user.id);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    status,
    member,
    async signInWithGoogle() {
      const db = getSupabaseClient();
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw friendlyError(error);
    },
    async signOut() {
      const db = getSupabaseClient();
      const { error } = await db.auth.signOut();
      if (error) throw friendlyError(error);
      setMember(null);
      setStatus("signed-out");
    },
    async joinWithInvite(code: string, name: string) {
      const db = getSupabaseClient();
      const { error } = await db.rpc("join_with_invite", { code, name });
      if (error) throw friendlyError(error);
      const { data } = await db.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      const profile = await fetchProfile(db, userId);
      if (profile) {
        setMember(profile);
        setStatus("member");
      }
    },
    async updateDisplayName(name: string) {
      if (!member) throw new Error("Sign in and join to play.");
      const db = getSupabaseClient();
      const { error } = await db
        .from("profiles")
        .update({ display_name: name })
        .eq("user_id", member.userId);
      if (error) throw friendlyError(error);
      const profile = await fetchProfile(db, member.userId);
      if (profile) setMember(profile);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return usesSupabase ? (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  ) : (
    <LocalAuthProvider>{children}</LocalAuthProvider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/**
 * Gates a route to signed-in members, sending everyone else to sign-in or join. Carries the
 * originally-requested location along so Join can send her back there once she's a member.
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return null;
  if (status === "signed-out") return <Navigate to="/signin" state={{ from: location }} replace />;
  if (status === "signed-in-not-member") {
    return <Navigate to="/join" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
