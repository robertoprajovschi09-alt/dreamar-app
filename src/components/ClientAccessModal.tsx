import { useEffect, useState } from "react";
import { Modal } from "@/components/overlay";
import { Button, Input, Badge } from "@/components/ui";
import { useToast } from "@/lib/toast";
import {
  createInvite, getInviteStatus, revokeAccess, restoreAccess, inviteLink, type InviteStatus,
} from "@/lib/clientAccess";
import { Copy, Loader2, Link2, ShieldCheck, ShieldX, UserCheck } from "lucide-react";

// Owner-side control for a client's portal access: see invite/account status,
// generate a copyable invite link, revoke or restore access. No email is sent
// (none is configured) — the owner copies the link and sends it themselves.

const STATUS_META: Record<InviteStatus["status"], { label: string; tone: "success" | "warning" | "info" | "neutral" | "danger" }> = {
  niciuna:   { label: "Fără invitație",   tone: "neutral" },
  trimisa:   { label: "Invitație trimisă", tone: "info" },
  acceptata: { label: "Cont activ",        tone: "success" },
  expirata:  { label: "Invitație expirată", tone: "warning" },
  revocata:  { label: "Acces revocat",     tone: "danger" },
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

export function ClientAccessModal({ open, onClose, clientId, clientName, defaultEmail }: {
  open: boolean; onClose: () => void; clientId: string; clientName: string; defaultEmail?: string;
}) {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "invite" | "revoke" | "restore">(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { status: s, error: e } = await getInviteStatus(clientId);
    if (e) setError(e); else setStatus(s ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    setLink(null); setError(null); setEmail(defaultEmail ?? "");
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  async function onInvite() {
    setError(null);
    if (!email.trim() || !email.includes("@")) { setError("Scrie un email valid."); return; }
    setBusy("invite");
    const { token, error: e } = await createInvite(clientId, email.trim());
    setBusy(null);
    if (e || !token) { setError(e ?? "Nu am putut genera invitația."); return; }
    setLink(inviteLink(token));
    await refresh();
  }

  async function onRevoke() {
    setBusy("revoke");
    const { error: e } = await revokeAccess(clientId);
    setBusy(null);
    if (e) { setError(e); return; }
    setLink(null);
    push({ tone: "warning", title: "Acces revocat", description: `${clientName} nu mai vede portalul.` });
    await refresh();
  }

  async function onRestore() {
    setBusy("restore");
    const { error: e } = await restoreAccess(clientId);
    setBusy(null);
    if (e) { setError(e); return; }
    push({ tone: "success", title: "Acces reactivat", description: clientName });
    await refresh();
  }

  function copy() {
    if (!link) return;
    void navigator.clipboard?.writeText(link);
    push({ tone: "success", title: "Link copiat", description: "Trimite-l clientului pe WhatsApp." });
  }

  const meta = status ? STATUS_META[status.status] : STATUS_META.niciuna;
  const active = status?.accountActive;
  const revoked = status?.accountRevoked;

  return (
    <Modal open={open} onClose={onClose} title="Acces client" subtitle={clientName} size="md"
      footer={<Button variant="ghost" className="ml-auto" onClick={onClose}>Închide</Button>}>
      {loading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-5">
          {/* Status line */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            {status?.email && <span className="text-sm text-muted-foreground">{status.email}</span>}
            {status?.status === "trimisa" && status.expiresAt && (
              <span className="text-xs text-muted-foreground">· expiră {fmt(status.expiresAt)}</span>
            )}
            {status?.status === "acceptata" && status.acceptedAt && (
              <span className="text-xs text-muted-foreground">· din {fmt(status.acceptedAt)}</span>
            )}
          </div>

          {/* Active account → revoke */}
          {active && (
            <div className="rounded-xl border border-success/30 bg-success/[0.05] p-4">
              <p className="flex items-center gap-2 text-sm font-700"><UserCheck className="h-4 w-4 text-success" /> Clientul are cont și vede portalul</p>
              <p className="mt-1 text-xs text-muted-foreground">Vede doar clipurile și calendarul lui. Nimic despre bani, alți clienți sau notițe interne.</p>
              <Button variant="outline" className="mt-3 text-danger" disabled={busy === "revoke"} onClick={onRevoke}>
                {busy === "revoke" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />} Revocă accesul
              </Button>
            </div>
          )}

          {/* Revoked account → restore */}
          {revoked && !active && (
            <div className="rounded-xl border border-danger/30 bg-danger/[0.05] p-4">
              <p className="flex items-center gap-2 text-sm font-700"><ShieldX className="h-4 w-4 text-danger" /> Acces revocat</p>
              <p className="mt-1 text-xs text-muted-foreground">Contul clientului nu mai vede nimic. Poți reactiva accesul oricând.</p>
              <Button variant="outline" className="mt-3" disabled={busy === "restore"} onClick={onRestore}>
                {busy === "restore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Reactivează accesul
              </Button>
            </div>
          )}

          {/* Invite / regenerate — hidden once an active account exists */}
          {!active && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-700 text-muted-foreground">Emailul clientului</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemplu.ro" />
              </div>
              <Button variant="primary" disabled={busy === "invite"} onClick={onInvite}>
                {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {status?.status === "trimisa" ? "Generează link nou" : "Generează link de invitație"}
              </Button>

              {link && (
                <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-3">
                  <p className="text-xs font-700 text-muted-foreground">Trimite-i clientului acest link</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
                      className="h-9 flex-1 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground ring-focus" />
                    <Button variant="primary" size="sm" onClick={copy}><Copy className="h-3.5 w-3.5" /> Copiază</Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Valabil o singură dată, expiră în 7 zile. Dacă generezi altul, cel vechi nu mai merge.</p>
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-600 text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
