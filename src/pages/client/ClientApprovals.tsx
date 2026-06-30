import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { Check, CheckCircle2, FileText, Loader2, Pencil } from "lucide-react";

type Pending = { approvalId: string; title: string; platform: string; script: string };
const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn" };

export function ClientApprovals({ onChange }: { onChange?: () => void }) {
  const { viewerClientId } = useWorkspace();
  const { push } = useToast();
  const clientId = viewerClientId;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Pending[]>([]);
  const [changeFor, setChangeFor] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !clientId) { setLoading(false); return; }
    setLoading(true);
    const appr = (await supabase.from("approvals").select("id, entity_id").eq("client_id", clientId).eq("entity_type", "post").eq("status", "pending")).data ?? [];
    let pend: Pending[] = [];
    if (appr.length) {
      const ids = appr.map((a) => a.entity_id);
      const posts = (await supabase.from("content_posts").select("id, title, platform, script").in("id", ids)).data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byId: Record<string, any> = Object.fromEntries(posts.map((p) => [p.id, p]));
      pend = appr.filter((a) => byId[a.entity_id]).map((a) => ({
        approvalId: a.id, title: byId[a.entity_id].title,
        platform: byId[a.entity_id].platform ? (PLATFORM_LABEL[byId[a.entity_id].platform] ?? byId[a.entity_id].platform) : "",
        script: byId[a.entity_id].script ?? "",
      }));
    }
    setItems(pend); setLoading(false);
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  async function approve(p: Pending) {
    setItems((prev) => prev.filter((x) => x.approvalId !== p.approvalId));
    if (supabase) {
      const { error } = await supabase.from("approvals").update({ status: "approved" }).eq("id", p.approvalId);
      if (error) { push({ tone: "danger", title: "Nu am putut salva", description: error.message }); void load(); return; }
    }
    push({ tone: "success", title: "Aprobat", description: p.title }); onChange?.();
  }

  async function requestChange() {
    if (!changeFor || busy) return;
    const p = changeFor;
    setBusy(true);
    if (supabase) {
      const patch: Record<string, unknown> = { status: "approved_with_changes" };
      if (note.trim()) { patch.comments = note.trim(); patch.change_requests = note.trim(); }
      const { error } = await supabase.from("approvals").update(patch).eq("id", p.approvalId);
      if (error) { setBusy(false); push({ tone: "danger", title: "Nu am putut salva", description: error.message }); return; }
    }
    setBusy(false); setItems((prev) => prev.filter((x) => x.approvalId !== p.approvalId)); setChangeFor(null); setNote("");
    push({ tone: "info", title: "Am trimis cererea ta", description: p.title }); onChange?.();
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-xl font-800">Aprobări</p>
        <p className="text-sm text-muted-foreground">{items.length ? "Echipa ta a pregătit conținut pentru tine" : "Ești la zi"}</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm font-700">Nimic de aprobat</p>
          <p className="text-xs text-muted-foreground">Conținutul nou apare aici când e gata.</p>
        </div>
      ) : items.map((p) => (
        <div key={p.approvalId} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <p className="flex-1 font-700">{p.title}</p>
            {p.platform && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-600 text-muted-foreground">{p.platform}</span>}
          </div>
          {p.script.trim() && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{p.script}</p>}
          <p className="mt-3 text-sm text-muted-foreground">Echipa ta a pregătit asta pentru tine. E bine așa?</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => { setChangeFor(p); setNote(""); }}><Pencil className="h-4 w-4" /> Vreau o schimbare</Button>
            <Button variant="primary" onClick={() => approve(p)}><Check className="h-4 w-4" /> Aprob</Button>
          </div>
        </div>
      ))}

      <Modal open={!!changeFor} onClose={() => setChangeFor(null)} title="Ce ai vrea să schimbăm?" subtitle={changeFor?.title} size="md"
        footer={<><Button variant="ghost" onClick={() => setChangeFor(null)}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy} onClick={requestChange}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Trimite cererea</Button></>}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus className="min-h-[96px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. poți schimba poza principală?" />
      </Modal>
    </div>
  );
}
