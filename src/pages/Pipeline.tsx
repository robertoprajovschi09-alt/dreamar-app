import { useEffect, useMemo, useState } from "react";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui";
import { Drawer, Modal } from "@/components/overlay";
import { PageSkeleton } from "@/components/Skeleton";
import { useClips, CLIP_STATES, clipStateLabel, type Clip, type ClipState } from "@/lib/clips";
import { useClients } from "@/lib/clients";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Layers, Link2, Plus, Trash2 } from "lucide-react";

const PLATFORMS = ["Instagram", "TikTok", "Facebook"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const needsDate = (s: ClipState) => s === "scheduled" || s === "posted";

export default function Pipeline() {
  const { clips, loading, updateClip, deleteClip, batchCreate } = useClips();
  const { clients, loading: lc } = useClients();
  const { push } = useToast();
  const [client, setClient] = useState("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ClipState | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [dateFor, setDateFor] = useState<string | null>(null); // clip id needing a date to become scheduled

  const editing = clips.find((c) => c.id === editId) ?? null;
  const filtered = useMemo(() => (client === "all" ? clips : clips.filter((c) => c.clientId === client)), [clips, client]);
  const byState = useMemo(() => {
    const m = {} as Record<ClipState, Clip[]>;
    CLIP_STATES.forEach((s) => (m[s.key] = []));
    filtered.forEach((c) => { (m[c.state] ??= []).push(c); });
    return m;
  }, [filtered]);

  function moveTo(id: string, target: ClipState) {
    const clip = clips.find((c) => c.id === id);
    if (!clip || clip.state === target) { setDraggingId(null); setOverCol(null); return; }
    if (target === "scheduled" && !clip.scheduledDate) { setDateFor(id); }         // needs a date first
    else if (target === "posted") updateClip(id, { state: "posted", scheduledDate: clip.scheduledDate ?? todayISO() });
    else if (target === "scheduled") updateClip(id, { state: "scheduled" });
    else updateClip(id, { state: target, scheduledDate: null });                  // non-calendar states carry no date
    setDraggingId(null); setOverCol(null);
  }

  if (loading || lc) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Fiecare clip, de la idee la postare · trage între coloane">
        <Select value={client} onChange={(e) => setClient(e.target.value)} className="w-40"><option value="all">Toți clienții</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Button variant="primary" onClick={() => setBatchOpen(true)}><Layers className="h-4 w-4" /> Adaugă în lot</Button>
      </PageHeader>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[900px] gap-3">
          {CLIP_STATES.map((s) => {
            const col = byState[s.key] ?? [];
            const isOver = overCol === s.key && draggingId !== null;
            return (
              <div key={s.key} className="flex min-w-[220px] flex-1 flex-col"
                onDragOver={(e) => { e.preventDefault(); setOverCol(s.key); }}
                onDragLeave={() => setOverCol((c) => (c === s.key ? null : c))}
                onDrop={() => draggingId && moveTo(draggingId, s.key)}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                  <p className="text-sm font-800">{s.label}</p>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{col.length}</span>
                </div>
                <Panel className={cn("min-h-[60vh] space-y-2 p-2 transition", isOver && "ring-2 ring-inset ring-primary/40")}>
                  {col.map((c) => (
                    <button key={c.id} draggable
                      onDragStart={() => setDraggingId(c.id)} onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                      onClick={() => setEditId(c.id)}
                      className={cn("block w-full cursor-grab rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 active:cursor-grabbing", draggingId === c.id && "opacity-40")}>
                      <p className="truncate text-sm font-600">{c.title || "(fără titlu)"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.clientName}{c.platform ? ` · ${c.platform}` : ""}</p>
                      {c.scheduledDate && needsDate(c.state) && <p className="mt-1 text-[11px] font-600 text-primary">{c.scheduledDate}</p>}
                    </button>
                  ))}
                  {col.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground/70">—</p>}
                </Panel>
              </div>
            );
          })}
        </div>
      </div>

      <BatchModal open={batchOpen} onClose={() => setBatchOpen(false)} clients={clients}
        onCreate={async (clientId, state, count, prefix) => {
          const res = await batchCreate(clientId, state, count, prefix);
          if (res.error) push({ tone: "danger", title: "Nu s-au putut crea clipurile", description: res.error });
          else push({ tone: "success", title: "Clipuri create", description: `${count} × ${clipStateLabel(state)}` });
        }} />

      <DateModal open={dateFor !== null} onClose={() => setDateFor(null)}
        onConfirm={(d) => { if (dateFor) updateClip(dateFor, { state: "scheduled", scheduledDate: d }); setDateFor(null); }} />

      <ClipEditor clip={editing} clients={clients} onClose={() => setEditId(null)}
        onSave={(patch) => { if (editing) { void updateClip(editing.id, patch); push({ tone: "success", title: "Clip salvat" }); } setEditId(null); }}
        onDelete={() => { if (editing) { void deleteClip(editing.id); push({ tone: "warning", title: "Clip șters", description: editing.title }); } setEditId(null); }} />
    </>
  );
}

function DateModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (date: string) => void }) {
  const [date, setDate] = useState(todayISO());
  return (
    <Modal open={open} onClose={onClose} title="Alege o dată" subtitle="Un clip Programat are nevoie de o dată" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" onClick={() => onConfirm(date)}>Programează</Button></>}>
      <Input autoFocus type="date" value={date} onChange={(e) => setDate(e.target.value)} />
    </Modal>
  );
}

function BatchModal({ open, onClose, clients, onCreate }: {
  open: boolean; onClose: () => void; clients: { id: string; name: string }[];
  onCreate: (clientId: string | null, state: ClipState, count: number, prefix: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [state, setState] = useState<ClipState>("to_film");
  const [count, setCount] = useState("8");
  const [prefix, setPrefix] = useState("");
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  function submit() { onCreate(clientId || null, state, n, prefix); onClose(); setPrefix(""); }
  return (
    <Modal open={open} onClose={onClose} title="Adaugă clipuri în lot" subtitle="Creează mai multe carduri deodată" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" onClick={submit}><Plus className="h-4 w-4" /> Creează {n}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Stare"><Select value={state} onChange={(e) => setState(e.target.value as ClipState)}>{CLIP_STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Număr"><Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} /></Field>
          <Field label="Prefix titlu (opțional)"><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="ex. geomar" /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Se creează <span className="font-700 text-foreground">{prefix.trim() || "Clip"} 1</span> … <span className="font-700 text-foreground">{prefix.trim() || "Clip"} {n}</span>.</p>
      </div>
    </Modal>
  );
}

function ClipEditor({ clip, clients, onClose, onSave, onDelete }: {
  clip: Clip | null; clients: { id: string; name: string }[]; onClose: () => void;
  onSave: (patch: Partial<Omit<Clip, "id" | "clientName">>) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [state, setState] = useState<ClipState>("idea");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [finalLink, setFinalLink] = useState("");
  useEffect(() => {
    if (clip) {
      setTitle(clip.title); setClientId(clip.clientId ?? ""); setState(clip.state);
      setPlatform(clip.platform || ""); setDate(clip.scheduledDate ?? "");
      setNotes(clip.notes || ""); setFinalLink(clip.finalLink || "");
    }
  }, [clip]);

  return (
    <Drawer open={!!clip} onClose={onClose} title={clip?.title || "Clip"} subtitle={clip?.clientName}
      badge={clip && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-700 text-muted-foreground">{clipStateLabel(clip.state)}</span>}
      footer={<>
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}><Trash2 className="h-4 w-4" /> Șterge</Button>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => onSave({ title, clientId: clientId || null, state, platform, scheduledDate: needsDate(state) ? (date || todayISO()) : null, notes, finalLink })}>Salvează</Button>
      </>}>
      {clip && (
        <div className="space-y-4">
          <Field label="Titlu"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full"><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Stare"><Select value={state} onChange={(e) => setState(e.target.value as ClipState)} className="w-full">{CLIP_STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platformă"><Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full"><option value="">—</option>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            {needsDate(state) && <Field label="Dată"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
          </div>
          <Field label="Notițe"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[90px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Detalii scurte…" /></Field>
          <Field label={<><Link2 className="mr-1 inline h-3.5 w-3.5" />Link final</>}><Input value={finalLink} onChange={(e) => setFinalLink(e.target.value)} placeholder="https://…" /></Field>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
