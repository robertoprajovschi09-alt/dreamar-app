import { useState } from "react";
import { PageHeader, Button, Badge, Panel, Input } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useToast } from "@/lib/toast";
import { useContent, type ContentPost, type UIPostStatus } from "@/lib/content";
import { Check, FileText, Pencil, ShieldCheck, X } from "lucide-react";

type Decision = "approved" | "changes" | "rejected";
const statusTone = { pending: "warning", approved: "success", rejected: "danger", changes: "info" } as const;
const statusLabel = { pending: "În așteptare", approved: "Aprobat", rejected: "Respins", changes: "Aprobat cu modificări" } as const;

function displayStatus(p: ContentPost): keyof typeof statusTone {
  if (p.approvalStatus === "approved") return "approved";
  if (p.approvalStatus === "rejected") return "rejected";
  if (p.approvalStatus === "approved_with_changes") return "changes";
  return "pending";
}

export default function Approvals() {
  const { push } = useToast();
  const { posts, updatePost } = useContent();
  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // A post is in the approval workflow if it's been sent for approval, or has a decision recorded.
  const items = posts.filter((p) => p.status === "approval" || (!!p.approvalStatus && p.approvalStatus !== "withdrawn"));
  const active = items.find((p) => p.id === openId) ?? null;

  const counts = {
    pending: items.filter((p) => displayStatus(p) === "pending").length,
    approved: items.filter((p) => displayStatus(p) === "approved").length,
    changes: items.filter((p) => displayStatus(p) === "changes").length,
    rejected: items.filter((p) => displayStatus(p) === "rejected").length,
  };

  async function decide(decision: Decision) {
    if (!active) return;
    // Every terminal decision moves the post OFF the 'For Approval' production
    // stage so the calendar badge updates: approved → approved, changes/reject → back to editing.
    const patch: Partial<{ status: UIPostStatus; approvalStatus: string | null; notes: string }> =
      decision === "approved" ? { approvalStatus: "approved", status: "approved" }
      : decision === "changes" ? { approvalStatus: "approved_with_changes", status: "editing" }
      : { approvalStatus: "rejected", status: "editing" };
    if (comment.trim()) patch.notes = comment.trim();
    const res = await updatePost(active.id, patch);
    if (res.error) { push({ tone: "danger", title: "Decizia nu a putut fi înregistrată", description: res.error }); return; }
    push({
      tone: decision === "approved" ? "success" : decision === "changes" ? "info" : "danger",
      title: decision === "approved" ? "Aprobat" : decision === "changes" ? "Aprobat cu modificări" : "Respins",
      description: active.title,
    });
    setOpenId(null);
    setComment("");
  }

  return (
    <>
      <PageHeader title="Aprobări" subtitle={`${counts.pending} ${counts.pending === 1 ? "element așteaptă" : "elemente așteaptă"} aprobarea clientului`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: "În așteptare", n: counts.pending, tone: "warning" },
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
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><ShieldCheck className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Nimic în așteptarea aprobării</p>
          <p className="max-w-sm text-sm text-muted-foreground">Când marchezi o postare cu <span className="font-600 text-foreground">Pentru aprobare</span> în calendar, apare aici, gata de verificat de către client.</p>
        </Panel>
      ) : (
        <Panel className="divide-y divide-border">
          {items.map((a) => {
            const ds = displayStatus(a);
            return (
              <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-600">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.clientName}{a.platform ? ` · ${a.platform}` : ""}{a.date ? ` · ${a.date}` : ""}</p>
                </div>
                <Badge tone={statusTone[ds]}>{statusLabel[ds]}</Badge>
                <span className="text-xs font-700 text-primary">Verifică →</span>
              </button>
            );
          })}
        </Panel>
      )}

      {/* Review modal */}
      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title="Verifică pentru aprobare"
        subtitle={active ? `${active.clientName}${active.platform ? ` · ${active.platform}` : ""}` : undefined}
        size="lg"
        footer={
          active && (
            <>
              <Button variant="ghost" className="text-danger" onClick={() => decide("rejected")}><X className="h-4 w-4" /> Respinge</Button>
              <Button variant="outline" onClick={() => decide("changes")}><Pencil className="h-4 w-4" /> Cere modificări</Button>
              <Button variant="primary" onClick={() => decide("approved")}><Check className="h-4 w-4" /> Aprobă</Button>
            </>
          )
        }
      >
        {active && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Previzualizare postare</p>
              <p className="mt-2 font-display text-base font-700">{active.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {active.script?.trim() ? active.script : "Niciun script atașat încă. Adaugă unul din Calendarul de conținut înainte de a trimite clientului pentru aprobare."}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-700 text-muted-foreground">Comentariu (opțional)</p>
              <Input placeholder="Adaugă o notă pentru echipă sau client…" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
