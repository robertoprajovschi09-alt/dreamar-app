import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/marketing/AuthShell";
import { previewInvite, acceptWithPassword, type InvitePreview } from "@/lib/clientAccess";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

// Public page reached from the invite link: /accept-invite#<token>. The token
// lives in the URL fragment, so it never reaches the server logs. The client
// sets a password and gets instant access to their portal.

function readToken(): string {
  const h = window.location.hash || "";
  return decodeURIComponent(h.replace(/^#/, "").trim());
}

const REASON_TEXT: Record<string, string> = {
  expirat: "Invitația a expirat. Cere-i agenției un link nou.",
  folosit: "Invitația a fost deja folosită. Dacă ai deja cont, autentifică-te.",
  revocat: "Invitația a fost anulată. Cere-i agenției un link nou.",
  invalid: "Link de invitație invalid. Verifică dacă l-ai copiat întreg.",
};

export default function AcceptInvite() {
  const [token] = useState(readToken);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured) { if (active) { setError("Portalul nu este configurat."); setLoading(false); } return; }
      if (!token || token.length < 20) { if (active) { setPreview({ valid: false, reason: "invalid", email: null, clientName: null, agencyName: null }); setLoading(false); } return; }
      const { preview: p, error: e } = await previewInvite(token);
      if (!active) return;
      if (e) setError(e);
      setPreview(p ?? { valid: false, reason: "invalid", email: null, clientName: null, agencyName: null });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Parola trebuie să aibă cel puțin 8 caractere."); return; }
    if (password !== password2) { setError("Parolele nu se potrivesc."); return; }
    if (!preview?.email) { setError("Invitație invalidă."); return; }
    setBusy(true);
    const { error: err } = await acceptWithPassword(token, preview.email, password);
    if (err) { setBusy(false); setError(err); return; }
    setDone(true);
    // Full reload so the workspace bootstrap picks up the new client link and
    // lands on the portal.
    window.location.assign("/portal");
  }

  if (loading) {
    return (
      <AuthShell>
        <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AuthShell>
    );
  }

  if (!preview?.valid) {
    const msg = REASON_TEXT[preview?.reason ?? "invalid"] ?? REASON_TEXT.invalid;
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger"><XCircle className="h-6 w-6" /></span>
          <h1 className="mt-5 font-display text-2xl font-800">Link indisponibil</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{msg}</p>
          <Link to="/login" className="mt-7 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-500 text-background transition duration-200 motion-safe:hover:-translate-y-0.5">Mergi la autentificare</Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-6 w-6" /></span>
          <h1 className="mt-5 font-display text-2xl font-800">Cont creat</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Te ducem în portalul tău…</p>
          <div className="mt-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">{preview.agencyName}</p>
      <h1 className="mt-1 font-display text-3xl font-600">Bun venit{preview.clientName ? `, ${preview.clientName}` : ""}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Îți setezi o parolă și intri în portalul tău. Vezi clipurile și calendarul, atât.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Emailul tău">
          <input type="email" value={preview.email ?? ""} readOnly disabled
            className="h-11 w-full rounded-lg border border-input bg-muted/50 px-3 text-sm text-muted-foreground" />
        </Field>
        <Field label="Parolă">
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="Cel puțin 8 caractere" />
        </Field>
        <Field label="Confirmă parola">
          <input type="password" required minLength={8} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus" placeholder="Scrie parola din nou" />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-600 text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-500 text-background transition duration-200 motion-safe:hover:-translate-y-0.5 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Intră în portal
        </button>
      </form>

      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Linkul e valabil o singură dată și expiră în 7 zile.
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
