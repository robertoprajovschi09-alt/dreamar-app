import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Loader2, Lock, ShieldCheck } from "lucide-react";

// Dedicated, discreet entrance to the platform control room. Reached only from
// the site footer. Any account can submit, but only a profile flagged
// is_saas_admin is allowed through — everyone else is signed back out.
export default function AdminLogin() {
  const navigate = useNavigate();
  const { signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await signInWithPassword(email.trim(), password);
    if (res.error) { setBusy(false); setError("Date de autentificare invalide."); return; }
    // Authorize: must be a platform admin.
    let ok = false;
    if (supabase) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: prof } = await supabase.from("profiles").select("is_saas_admin").eq("id", u.user.id).maybeSingle();
        ok = !!prof?.is_saas_admin;
      }
    }
    if (!ok) {
      await signOut();
      setBusy(false);
      setError("Acest cont nu are rol de administrator al platformei.");
      return;
    }
    navigate("/admin", { replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-600 text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Înapoi la site
        </Link>
        <div className="panel p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-glow"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h1 className="font-display text-lg font-800">Controlul platformei</h1>
              <p className="text-xs text-muted-foreground">Acces restricționat — doar pentru administratori</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-700 text-muted-foreground">Email</label>
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="admin@drea.mar" />
            </div>
            <div>
              <label className="text-xs font-700 text-muted-foreground">Parolă</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="••••••••" />
            </div>
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-600 text-danger">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-sm font-700 text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Intră în centrul de control
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Proprietari de agenții: <Link to="/login" className="font-600 text-primary">autentifică-te aici</Link>.</p>
      </div>
    </div>
  );
}
