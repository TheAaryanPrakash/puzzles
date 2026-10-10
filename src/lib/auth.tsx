import { createContext, useContext, type ReactNode } from "react";
import { Navigate } from "react-router";

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
}

const AuthContext = createContext<AuthState | null>(null);

const FAKE_MEMBER: Member = { userId: "local-dev", displayName: "Sansita" };

/**
 * Local dev mode: always signed in as a fake member, so every game can be built and tested
 * without a Supabase project. The backend agent replaces this body's internals with real
 * Supabase auth/session wiring (src/lib/data/supabase.ts's VITE_DATA_SOURCE pairs with this)
 * without changing the AuthState shape — games and pages never see the difference.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthState = {
    status: "member",
    member: FAKE_MEMBER,
    async signInWithGoogle() {},
    async signOut() {},
    async joinWithInvite() {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Gates a route to signed-in members, sending everyone else to sign-in or join. */
export function RequireMember({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return null;
  if (status === "signed-out") return <Navigate to="/signin" replace />;
  if (status === "signed-in-not-member") return <Navigate to="/join" replace />;
  return <>{children}</>;
}
