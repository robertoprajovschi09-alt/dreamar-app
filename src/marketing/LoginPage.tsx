import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithPassword, mode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signInWithPassword(email, password);
    setBusy(false);
    if (error) { setError(error); return; }
    navigate("/dashboard");
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-800">Bine ai revenit</h1>
      <p className="mt-1 text-sm text-muted-foreground">Autentifică-te în spațiul de lucru al agenției tale.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email de serviciu">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="you@agency.com" />
        </Field>
        <Field label="Parolă">
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="••••••••" />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-600 text-danger">{error}</p>}
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-[hsl(var(--primary))]" /> Ține-mă minte</label>
          <a href="/#" className="font-600 text-indigo-600 hover:underline dark:text-indigo-400">Ai uitat parola?</a>
        </div>
        <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-sm font-700 text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Autentificare
        </button>
      </form>

      {mode === "demo" && (
        <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
          Mod demo: orice email și parolă îți permit autentificarea.
        </p>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ești nou pe drea.mar? <Link to="/signup" className="font-700 text-indigo-600 hover:underline dark:text-indigo-400">Creează un cont</Link>
      </p>
    </AuthShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-700 text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
