import { useMemo, useState } from "react";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { PageSkeleton } from "@/components/Skeleton";
import { useScripts, SCRIPT_STATUS, scriptStatusLabel, type Script, type ScriptStatus } from "@/lib/scripts";
import { useClients } from "@/lib/clients";
import { useClips, clipStateLabel, CLIP_STATES } from "@/lib/clips";
import { useToast } from "@/lib/toast";
import { nicheLabels, type Niche } from "@/data/sample";
import { cn } from "@/lib/utils";
import { ArrowRight, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";

// Encode the "client or niche" picker as a single value.
const toTarget = (s: { clientId: string | null; niche: string | null }) => (s.clientId ? `client:${s.clientId}` : s.niche ? `niche:${s.niche}` : "general");
const fromTarget = (v: string): { clientId: string | null; niche: string | null } =>
  v.startsWith("client:") ? { clientId: v.slice(7), niche: null } : v.startsWith("niche:") ? { clientId: null, niche: v.slice(6) } : { clientId: null, niche: null };
const clipDot = (state: string) => CLIP_STATES.find((s) => s.key === state)?.dot ?? "bg-muted-foreground";

export default function Scripts() {
  const { scripts, loading, createScript, updateScript, deleteScript, attachScript, clipIdsForScript } = useScripts();
  const { clients, loading: lc } = useClients();
  const { clips, createClip } = useClips();
  const { push } = useToast();
  const [targetFilter, setTargetFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Script | "new" | null>(null);

  const clipById = useMemo(() => new Map(clips.map((c) => [c.id, c] as const)), [clips]);
  const rows = useMemo(() => scripts.filter((s) => {
    const t = targetFilter === "all" || (targetFilter === "general" ? !s.clientId && !s.niche : targetFilter.startsWith("client:") ? s.clientId === targetFilter.slice(7) : s.niche === targetFilter.slice(6));
    return t && (statusFilter === "all" || s.status === statusFilter);
  }), [scripts, targetFilter, statusFilter]);

  function sendToPipeline(s: Script) {
    void (async () => {
      const notes = [s.hook && `Hook: ${s.hook}`, s.body && `Desfășurare: ${s.body}`, s.cta && `CTA: ${s.cta}`].filter(Boolean).join("\n");
      const res = await createClip({ clientId: s.clientId, title: s.title, state: "idea", notes });
      if (res.id) await attachScript(res.id, s.id);
      push({ tone: "success", title: "Clip creat din script", description: s.title || "Idee nouă în Pipeline" });
    })();
  }

  if (loading || lc) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title="Scripturi" subtitle="Ideea scrisă, înainte să devină clip">
        <Select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} className="w-36">
          <option value="all">Toate</option>
          <option value="general">General</option>
          {clients.map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}
          {(Object.keys(nicheLabels) as Niche[]).map((n) => <option key={n} value={`niche:${n}`}>Nișă: {nicheLabels[n]}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-32">
          <option value="all">Orice status</option>
          {SCRIPT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Script nou</Button>
      </PageHeader>

      {rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><ScrollText className="h-6 w-6" /></span>
          <div>
            <p className="font-display text-base font-800">Scripturile devin clipuri</p>
            <p className="mt-1 text-sm text-muted-foreground">Scrie hook, desfășurare și CTA pentru un client sau o nișă, apoi trimite scriptul în pipeline ca să devină clip.</p>
          </div>
          <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Scrie primul script</Button>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => {
            const st = SCRIPT_STATUS.find((x) => x.key === s.status);
            const usedClips = clipIdsForScript(s.id).map((id) => clipById.get(id)).filter(Boolean);
            const uses = usedClips.length; // count only clips that still exist, so the number matches the chips
            return (
              <Panel key={s.id} className="group flex flex-col p-4">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 font-display text-sm font-800">{s.title || "Fără titlu"}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-700", st?.cls)}>{st?.label}</span>
                  <button onClick={() => setEditing(s)} aria-label="Editează" className="shrink-0 text-muted-foreground opacity-60 transition hover:text-foreground group-hover:opacity-100"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void deleteScript(s.id)} aria-label="Șterge" className="shrink-0 text-muted-foreground opacity-60 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 text-xs font-600 text-primary">{s.clientId ? s.clientName : s.niche ? `Nișă: ${nicheLabels[s.niche as Niche] ?? s.niche}` : "General"}</p>
                {s.hook && <p className="mt-2 text-sm text-muted-foreground">„{s.hook}"</p>}
                <p className="mt-2 text-[11px] font-700 text-muted-foreground">Folosit de {uses} {uses === 1 ? "dată" : "ori"}</p>
                {usedClips.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {usedClips.map((c) => c && (
                      <div key={c.id} className="flex items-center gap-2 text-xs">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", clipDot(c.state))} />
                        <span className="min-w-0 flex-1 truncate">{c.title || "(fără titlu)"}</span>
                        <span className="shrink-0 text-muted-foreground">{clipStateLabel(c.state)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="outline" className="mt-3 self-start" onClick={() => sendToPipeline(s)}>Trimite în pipeline <ArrowRight className="h-4 w-4" /></Button>
              </Panel>
            );
          })}
        </div>
      )}

      <ScriptModal
        open={editing !== null}
        script={editing === "new" ? null : editing}
        clients={clients}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (editing && editing !== "new") await updateScript(editing.id, patch);
          else await createScript(patch);
          setEditing(null);
        }}
      />
    </>
  );
}

type ScriptPatch = { clientId: string | null; niche: string | null; title: string; hook: string; body: string; cta: string; status: ScriptStatus };

function ScriptModal({ open, script, clients, onClose, onSave }: {
  open: boolean; script: Script | null; clients: { id: string; name: string }[];
  onClose: () => void; onSave: (patch: ScriptPatch) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("general");
  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [status, setStatus] = useState<ScriptStatus>("to_test");
  const [busy, setBusy] = useState(false);

  const seedKey = open ? (script?.id ?? "new") : "closed";
  const [seeded, setSeeded] = useState("");
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setTitle(script?.title ?? "");
    setTarget(script ? toTarget(script) : "general");
    setHook(script?.hook ?? "");
    setBody(script?.body ?? "");
    setCta(script?.cta ?? "");
    setStatus(script?.status ?? "to_test");
  }

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const { clientId, niche } = fromTarget(target);
    await onSave({ clientId, niche, title: title.trim(), hook: hook.trim(), body: body.trim(), cta: cta.trim(), status });
    setBusy(false);
  }

  const ta = "min-h-[70px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus";
  return (
    <Modal open={open} onClose={onClose} title={script ? "Editează scriptul" : "Script nou"} subtitle="Hook, desfășurare și apel la acțiune" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!title.trim() || busy} onClick={save}><Plus className="h-4 w-4" /> {script ? "Salvează" : "Adaugă"}</Button></>}>
      <div className="space-y-3">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titlu, ex. 3 greșeli când cumperi un apartament" />
        <div className="grid grid-cols-2 gap-3">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="general">General</option>
            <optgroup label="Client">{clients.map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}</optgroup>
            <optgroup label="Nișă">{(Object.keys(nicheLabels) as Niche[]).map((n) => <option key={n} value={`niche:${n}`}>{nicheLabels[n]}</option>)}</optgroup>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as ScriptStatus)}>{SCRIPT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-700 text-muted-foreground">Hook</p>
          <textarea value={hook} onChange={(e) => setHook(e.target.value)} className={ta} placeholder="Prima frază care oprește scroll-ul." />
        </div>
        <div>
          <p className="mb-1 text-xs font-700 text-muted-foreground">Desfășurare</p>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className={ta} placeholder="Cadre, text, ce se arată pe rând." />
        </div>
        <div>
          <p className="mb-1 text-xs font-700 text-muted-foreground">CTA</p>
          <textarea value={cta} onChange={(e) => setCta(e.target.value)} className={ta} placeholder="Apelul la acțiune de final." />
        </div>
      </div>
    </Modal>
  );
}
