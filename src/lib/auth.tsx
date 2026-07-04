import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./supabase";

// Auth provider with two modes:
//   - LIVE  (Supabase configured): real email/password auth + sessions.
//   - DEMO  (not configured): localStorage stand-in, so the app + marketing
//     site keep working with sample data.
export type AuthUser = { id: string; email: string; name: string };
type Result = { error?: string; needsConfirmation?: boolean };

type AuthState = {
  user: AuthUser | null;
  isAuthed: boolean;
  loading: boolean;
  mode: "live" | "demo";
  signInWithPassword: (email: string, password: string) => Promise<Result>;
  signUp: (a: { email: string; password: string; name: string; agency: string }) => Promise<Result>;
  signOut: () => Promise<void>;
};

const DEMO_KEY = "dreamar-demo-auth";
export const PENDING_AGENCY_KEY = "dreamar-pending-agency";
const Ctx = createContext<AuthState | null>(null);

export function nameFromEmail(email: string) {
  return (email.split("@")[0] || "utilizator").replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(u: any): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? "", name: u.user_metadata?.full_name || nameFromEmail(u.email ?? "") };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(mapUser(data.session?.user));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user));
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const live = isSupabaseConfigured && supabase;

  const value: AuthState = live
    ? {
        user,
        isAuthed: !!user,
        loading,
        mode: "live",
        signInWithPassword: async (email, password) => {
          const { error } = await supabase!.auth.signInWithPassword({ email, password });
          return { error: error?.message };
        },
        signUp: async ({ email, password, name, agency }) => {
          // Keyed per email: an abandoned signup on a shared browser must not
          // name the NEXT user's agency (cross-user leak via localStorage).
          localStorage.setItem(`${PENDING_AGENCY_KEY}:${email.trim().toLowerCase()}`, agency); // provisioned on first authed load
          const { data, error } = await supabase!.auth.signUp({
            email, password, options: { data: { full_name: name } },
          });
          if (error) return { error: error.message };
          return { needsConfirmation: !data.session };
        },
        signOut: async () => { await supabase!.auth.signOut(); },
      }
    : {
        user,
        isAuthed: !!user,
        loading,
        mode: "demo",
        signInWithPassword: async (email) => {
          const u = { id: "demo", email, name: nameFromEmail(email) };
          localStorage.setItem(DEMO_KEY, JSON.stringify(u)); setUser(u); return {};
        },
        signUp: async ({ email, name }) => {
          const u = { id: "demo", email, name: name || nameFromEmail(email) };
          localStorage.setItem(DEMO_KEY, JSON.stringify(u)); setUser(u); return {};
        },
        signOut: async () => { localStorage.removeItem(DEMO_KEY); setUser(null); },
      };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-indigo-600" />
      </div>
    );
  }
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
