import { useState } from "react";
import { PageHeader, Button, Badge, Panel, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useToast } from "@/lib/toast";
import { useContent, type ContentPost } from "@/lib/content";
import { Clock, FileText, Loader2, Send, ShieldCheck } from "lucide-react";

type DecisionKey = "pending" | "approved" | "changes" | "rejected";
const decisionTone = { pending: "warning", approved: "success", changes: "info", rejected: "danger" } as const;
const decisionLabel = { pending: "Așteaptă clientul", approved: "Aprobat", changes: "Aprobat cu modificări", rejected: "Respins" } as const;

function decisionOf(p: ContentPost): DecisionKey {
  if (p.approvalStatus === "approved") return "approved";
  if (p.approvalStatus === "approved_with_changes") return "changes";
  if (p.approvalStatus === "rejected") return "rejected";
  return "pending";
}
const inWorkflow = (p: ContentPost) => !!p.approvalStatus && p.approvalStatus !== "withdrawn";

export default function Approvals() {
  const { push } = useToast();
  const { posts, requestApproval } = useContent();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendId, setSendId] = useState("");
  const [busy, setBusy] = useState(false);

  const items = posts.filter(inWorkflow);
  const active = items.find((p) => p.id === openId) ?? null;
  // Anything not currently awaiting the client can be (re)sent.
  const sendable = posts.filter((p) => p.approvalStatus !== "pending");

  const counts = {
    pending: items.filter((p) => decisionOf(p) === "pending").length,
    approved: items.filter((p) => decisionOf(p) === "approved").length,
    changes: items.filter((p) => decisionOf(p) === "changes").length,
    rejected: items.filter((p) => decisionOf(p) === "rejected").length,
  };

  async function send(post: ContentPost | undefined, close?: () => void) {
    if (!post || busy) return;
    setBusy(true);
    const res = await requestApproval(post);
    setBusy(false);
    if (res.error) { push({ tone: "danger", title: "Nu s-a putut trimite spre aprobare", description: res.error }); return; }
    push({ tone: "success", title: "Trimis clientului", description: `${post.title} — așteaptă decizia clientului.` });
    close?.();
  }

  function openSend() { setSendId(sendable[0]?.id ?? ""); setSendOpen(true); }

  return (
    <>
      <PageHeader title="Aprobări" subtitle="Trimite conținutul clienților spre aprobare și urmărește deciziile lor">
        <Button variant="primary" onClick={openSend} disabled={sendable.length === 0}><Send className="h-4 w-4" /> Trimite spre aprobare</Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: "Așteaptă clientul", n: counts.pending, tone: "warning" },
          { label: "Aprobate", n: counts.approved, tone: "success" },
          { label: "Cu modificări", n: counts.changes, tone: "info" },
          { label: "Respinse", n: counts.rejected, tone: "danger" },
        ] as const).map((s) => (
          <Panel key={s.label} className="p-4">
            <p className="font-display text-2xl font-800">{s.n}</p>
            <Badge tone={s.tone} className="mt-1">{s.label}</Badge>
          </Panel>
        ))}
      </div>

      {items.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Nimic trimis spre aprobare încă</p>
          <p className="max-w-sm text-sm text-muted-foreground">Apasă <span className="font-600 text-foreground">Trimite spre aprobare</span> ca să trimiți o postare clientului. El o aprobă sau cere modificări direct din portalul lui.</p>
          {sendable.length > 0 && <Button variant="primary" className="mt-1" onClick={openSend}><Send className="h-4 w-4" /> Trimite spre aprobare</Button>}
        </Panel>
      ) : (
        <Panel className="divide-y divide-border">
          {items.map((a) => {
            const d = decisionOf(a);
            return (
              <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-600">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.clientName}{a.platform ? ` · ${a.platform}` : ""}{a.date ? ` · ${a.date}` : ""}</p>
                </div>
                <Badge tone={decisionTone[d]}>{decisionLabel[d]}</Badge>
                <span className="hidden text-xs font-700 text-primary sm:inline">Vezi →</span>
              </button>
            );
          })}
        </Panel>
      )}

      {/* Review (read-only — the client decides, not the agency) */}
      <Modal open={!!active} onClose={() => setOpenId(null)} title="Stare aprobare"
        subtitle={active ? `${active.clientName}${active.platform ? ` · ${active.platform}` : ""}` : undefined} size="lg"
        footer={active && (decisionOf(active) === "pending" ? (
          <Button variant="ghost" className="ml-auto" onClick={() => setOpenId(null)}>Închide</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setOpenId(null)}>Închide</Button>
            <Button variant="primary" className="ml-auto" disabled={busy} onClick={() => send(active, () => setOpenId(null))}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Retrimite spre aprobare</Button>
          </>
        ))}>
        {active && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={decisionTone[decisionOf(active)]}>{decisionLabel[decisionOf(active)]}</Badge>
              {decisionOf(active) === "pending" && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Trimis — așteaptă decizia clientului în portalul lui.</span>}
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Previzualizare postare</p>
              <p className="mt-2 font-display text-base font-700">{active.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {active.script?.trim() ? active.script : "Niciun scenariu atașat. Adaugă unul din Calendarul de conținut."}
              </p>
            </div>
            {decisionOf(active) === "approved" && <p className="text-sm font-600 text-success">Clientul a aprobat acest conținut. Poți să-l programezi și să-l publici.</p>}
            {decisionOf(active) === "changes" && <p className="text-sm text-muted-foreground">Clientul a aprobat cu modificări. Aplică schimbările în calendar, apoi retrimite.</p>}
            {decisionOf(active) === "rejected" && <p className="text-sm text-muted-foreground">Clientul a respins acest conținut. Revizuiește-l în calendar, apoi retrimite.</p>}
          </div>
        )}
      </Modal>

      {/* Send picker */}
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="Trimite spre aprobare" subtitle="Alege postarea pe care o trimiți clientului" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setSendOpen(false)}>Anulează</Button>
          <Button variant="primary" className="ml-auto" disabled={busy || !sendId} onClick={() => send(sendable.find((p) => p.id === sendId), () => setSendOpen(false))}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Trimite clientului</Button>
        </>}>
        <div className="space-y-2">
          <p className="text-xs font-700 text-muted-foreground">Postare</p>
          <Select value={sendId} onChange={(e) => setSendId(e.target.value)} className="w-full">
            {sendable.length === 0 && <option value="">Nicio postare disponibilă</option>}
            {sendable.map((p) => <option key={p.id} value={p.id}>{p.clientName} — {p.title}</option>)}
          </Select>
          <p className="text-xs text-muted-foreground">Clientul vede postarea în portalul lui și o aprobă sau cere modificări.</p>
        </div>
      </Modal>
    </>
  );
}
