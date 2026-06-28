import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { useAuth } from "@/lib/auth";
import { Check, Loader2, MailCheck } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signUp({ email, password, name, agency });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    if (res.needsConfirmation) { setConfirm(true); return; }
    navigate("/dashboard");
  }

  if (confirm) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"><MailCheck className="h-6 w-6" /></span>
          <h1 className="mt-4 font-display text-2xl font-800">Verifică-ți emailul</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Am trimis un link de confirmare la <span className="font-700 text-foreground">{email}</span>. Apasă pe el, apoi autentifică-te — spațiul tău de lucru <span className="font-700 text-foreground">{agency}</span> va fi gata.
          </p>
          <Link to="/login" className="mt-6 inline-block rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2.5 text-sm font-700 text-white shadow-lg shadow-indigo-600/25">Mergi la autentificare</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-800">Începe perioada de probă gratuită</h1>
      <p className="mt-1 text-sm text-muted-foreground">14 zile gratuit. Fără card de credit.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numele tău">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="Robert Casco" />
          </Field>
          <Field label="Numele agenției">
            <input required value={agency} onChange={(e) => setAgency(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="Nova Creative" />
          </Field>
        </div>
        <Field label="Email de serviciu">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="you@agency.com" />
        </Field>
        <Field label="Parolă">
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="Cel puțin 6 caractere" />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-600 text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-sm font-700 text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Creează contul și începe perioada de probă
        </button>
      </form>

      <ul className="mt-5 space-y-1.5">
        {["Spațiu de lucru privat gata în câteva secunde", "Până la 5 clienți în perioada de probă gratuită", "Anulezi oricând"].map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-success" /> {f}</li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ai deja un cont? <Link to="/login" className="font-700 text-indigo-600 hover:underline dark:text-indigo-400">Autentifică-te</Link>
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
