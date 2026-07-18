import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Button, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useClips, CLIP_STATES, CLIP_STATE_ORDER, clipStateLabel, type Clip, type ClipState } from "@/lib/clips";
import { useClients } from "@/lib/clients";
import { useToast } from "@/lib/toast";
import type { Client } from "@/data/sample";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Clapperboard, Layers, Plus, Trash2, X } from "lucide-react";
import { BatchModal, DateModal, ClipEditor } from "@/pages/Pipeline";

const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const needsDate = (s: ClipState) => s === "scheduled" || s === "posted";
const TARGET_MIN = 3; // Editat target: red under, green in / above
function mondayOf(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function countByState(clips: Clip[]) {
  const m = {} as Record<ClipState, number>;
  CLIP_STATE_ORDER.forEach((k) => (m[k] = 0));
  clips.forEach((c) => (m[c.state] = (m[c.state] ?? 0) + 1));
  return m;
}
const haptic = () => { try { navigator.vibrate?.(15); } catch { /* no haptics */ } };
// Synthetic client for clips with no client attached, so they get a card + Level 2.
const NO_CLIENT = "__none__";
const NO_CLIENT_CLIENT = { id: NO_CLIENT, name: "Fără client", billingType: "retainer" } as unknown as Client;

export function PipelineMobile() {
  const { clips, updateClip, deleteClip, createClip, batchCreate } = useClips();
  const { clients } = useClients();
  const { push } = useToast();
  const [sp] = useSearchParams();
  const initial = sp.get("client");
  const [openId, setOpenId] = useState<string | null>(initial && initial !== "all" ? initial : null);

  const [editId, setEditId] = useState<string | null>(null);
  const [dateFor, setDateFor] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPrefill, setBatchPrefill] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Clip | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const openBatch = (clientId: string | null) => { setBatchPrefill(clientId); setBatchOpen(true); };
  // The synthetic "Fără client" id must never reach a client prefill (it is not a real client).
  const prefillClientId = openId === NO_CLIENT ? null : openId;

  const editing = clips.find((c) => c.id === editId) ?? null;
  // Clientless clips group under a synthetic "Fără client" card so they stay
  // reachable on mobile (there is no desktop "all" view here to fall back on).
  const openClient: Client | null = openId === NO_CLIENT ? NO_CLIENT_CLIENT : (clients.find((c) => c.id === openId) ?? null);
  const clientClips = useMemo(
    () => (openId === NO_CLIENT ? clips.filter((c) => !c.clientId) : openId ? clips.filter((c) => c.clientId === openId) : []),
    [clips, openId]
  );

  // Advance a clip one stage, with haptic + an undoable toast. A short re-entry
  // guard swallows a double-fire (double-tap / batched pointerup) of the SAME
  // move so it does not stack two identical undo toasts.
  const lastAdvance = useRef<{ id: string; state: ClipState; at: number } | null>(null);
  function advanceClip(clip: Clip) {
    const now = performance.now();
    const prev = lastAdvance.current;
    if (prev && prev.id === clip.id && prev.state === clip.state && now - prev.at < 500) return;
    lastAdvance.current = { id: clip.id, state: clip.state, at: now };
    const next = CLIP_STATE_ORDER[CLIP_STATE_ORDER.indexOf(clip.state) + 1];
    if (!next) return;
    if (next === "scheduled" && !clip.scheduledDate) { setDateFor(clip.id); return; } // needs a date first
    const prevState = clip.state, prevDate = clip.scheduledDate;
    if (next === "posted") updateClip(clip.id, { state: "posted", scheduledDate: clip.scheduledDate ?? todayISO() });
    else updateClip(clip.id, { state: next, scheduledDate: next === "scheduled" ? clip.scheduledDate : null });
    haptic();
    push({ tone: "success", title: `Mutat în ${clipStateLabel(next)}`, action: { label: "Anulează", run: () => updateClip(clip.id, { state: prevState, scheduledDate: prevDate }) } });
  }
  function confirmDate(d: string, t: string | null) {
    const clip = clips.find((c) => c.id === dateFor);
    setDateFor(null);
    if (!clip) return;
    const prevState = clip.state, prevDate = clip.scheduledDate;
    updateClip(clip.id, { state: "scheduled", scheduledDate: d, scheduledTime: t });
    haptic();
    push({ tone: "success", title: "Mutat în Programat", action: { label: "Anulează", run: () => updateClip(clip.id, { state: prevState, scheduledDate: prevDate }) } });
  }
  function doDelete() {
    if (!delTarget) return;
    const c = delTarget;
    setDelTarget(null);
    void deleteClip(c.id);
    push({ tone: "warning", title: "Clip șters", description: c.title });
  }

  return (
    <>
      {openId && openClient ? (
        <Level2 key={openId} client={openClient} clips={clientClips} onBack={() => setOpenId(null)}
          onAdvance={advanceClip} onDelete={setDelTarget} onOpenDetail={(id) => setEditId(id)} onBatch={() => openBatch(prefillClientId)} />
      ) : (
        <Level1 clients={clients} clips={clips} onOpen={setOpenId} onBatch={openBatch} />
      )}

      {/* FAB: Clip nou + Adaugă în lot (prefilled with the open client on level 2) */}
      {createPortal(
        <>
          {fabOpen && <button aria-label="Închide" onClick={() => setFabOpen(false)} className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]" />}
          {fabOpen && (
            <div className="glass-quick fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] right-4 z-50 w-56 overflow-hidden rounded-2xl p-1.5">
              {[
                { icon: Clapperboard, label: "Clip nou", run: () => setNewOpen(true) },
                { icon: Layers, label: "Adaugă în lot", run: () => openBatch(prefillClientId) },
              ].map((o) => (
                <button key={o.label} onClick={() => { setFabOpen(false); o.run(); }}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-600 transition hover:bg-foreground/5 active:bg-foreground/10">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><o.icon className="h-4.5 w-4.5" /></span>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <button aria-label="Adaugă rapid" onClick={() => setFabOpen((v) => !v)}
            className="glass-fab fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-50 grid h-14 w-14 place-items-center rounded-full text-primary-foreground transition active:scale-95">
            {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
          </button>
        </>,
        document.body
      )}

      <NewClipModal open={newOpen} prefillClient={prefillClientId} clients={clients} onClose={() => setNewOpen(false)}
        onCreate={(input) => { void createClip(input); push({ tone: "success", title: "Clip creat" }); }} />

      <BatchModal open={batchOpen} onClose={() => setBatchOpen(false)} clients={clients} prefillClient={batchPrefill}
        onCreate={async (clientId, state, count, prefix) => {
          const res = await batchCreate(clientId, state, count, prefix);
          if (res.error) push({ tone: "danger", title: "Nu s-au putut crea clipurile", description: res.error });
          else push({ tone: "success", title: "Clipuri create", description: `${count} × ${clipStateLabel(state)}` });
        }} />

      <DateModal open={dateFor !== null} onClose={() => setDateFor(null)} onConfirm={confirmDate} />

      <ClipEditor clip={editing} clients={clients} onClose={() => setEditId(null)}
        onSave={(patch) => { if (editing) { void updateClip(editing.id, patch); push({ tone: "success", title: "Clip salvat" }); } setEditId(null); }}
        onDelete={() => { if (editing) { void deleteClip(editing.id); push({ tone: "warning", title: "Clip șters", description: editing.title }); } setEditId(null); }} />

      <Modal open={delTarget !== null} onClose={() => setDelTarget(null)} title="Ștergi clipul?" subtitle={delTarget?.title || undefined} size="sm"
        footer={<><Button variant="ghost" onClick={() => setDelTarget(null)}>Anulează</Button><Button variant="danger" className="ml-auto" onClick={doDelete}><Trash2 className="h-4 w-4" /> Șterge</Button></>}>
        <p className="text-sm text-muted-foreground">Clipul se șterge definitiv din pipeline.</p>
      </Modal>
    </>
  );
}

/* ── Level 1 · client list ───────────────────────────────────────────────── */
function Level1({ clients, clips, onOpen, onBatch }: { clients: Client[]; clips: Clip[]; onOpen: (id: string) => void; onBatch: (clientId: string | null) => void }) {
  const byClient = useMemo(() => {
    const m = new Map<string, Clip[]>();
    clips.forEach((c) => { if (c.clientId) { const a = m.get(c.clientId) ?? []; a.push(c); m.set(c.clientId, a); } });
    return m;
  }, [clips]);

  const inWork = clips.filter((c) => c.state !== "posted").length;
  const monday = isoOf(mondayOf(new Date()));
  const sunday = isoOf(new Date(mondayOf(new Date()).getTime() + 6 * 86400000));
  const weekScheduled = clips.filter((c) => c.state === "scheduled" && c.scheduledDate && c.scheduledDate >= monday && c.scheduledDate <= sunday).length;

  // Clients with clips first (by name); the ones with none sink to the bottom, grey.
  const ordered = [...clients].sort((a, b) => {
    const ha = (byClient.get(a.id)?.length ?? 0) > 0, hb = (byClient.get(b.id)?.length ?? 0) > 0;
    if (ha !== hb) return ha ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const noClientClips = useMemo(() => clips.filter((c) => !c.clientId), [clips]);

  return (
    <>
      <PageHeader title="Pipeline" help="pipeline" subtitle="Drumul clipurilor, de la idee la postat." />
      <div className="mt-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-600">
        {inWork} {inWork === 1 ? "clip în lucru" : "clipuri în lucru"} · {weekScheduled} programate săptămâna asta
      </div>
      {/* pb clears the corner FAB so the last card is never occluded (constitution). */}
      <div className="mt-3 space-y-2 pb-20">
        {ordered.map((c) => <ClientCard key={c.id} client={c} clips={byClient.get(c.id) ?? []} onOpen={onOpen} onBatch={onBatch} />)}
        {noClientClips.length > 0 && <ClientCard key={NO_CLIENT} client={NO_CLIENT_CLIENT} clips={noClientClips} onOpen={onOpen} onBatch={onBatch} />}
      </div>
    </>
  );
}

function ClientCard({ client, clips, onOpen, onBatch }: { client: Client; clips: Clip[]; onOpen: (id: string) => void; onBatch: (clientId: string | null) => void }) {
  const counts = countByState(clips);
  const noClips = clips.length === 0;
  const noTampon = (client.billingType ?? "retainer") === "comision"; // Yanis: nu colorează nimic
  const editedColored = !noClips && !noTampon;

  if (noClips) {
    return (
      <div className="rounded-2xl border border-border bg-muted/20 p-3 opacity-80">
        <p className="text-sm font-700 text-muted-foreground">{client.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">Pipeline-ul e drumul unui clip de la idee la postare. Creează primele clipuri pentru acest client.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => onBatch(client.id)}><Layers className="h-4 w-4" /> Adaugă în lot</Button>
      </div>
    );
  }

  return (
    <button onClick={() => onOpen(client.id)} className="block w-full rounded-2xl border border-border bg-card p-3 text-left transition active:bg-muted/40">
      <p className="mb-2 text-sm font-700">{client.name}</p>
      <div className="grid grid-cols-6 gap-1">
        {CLIP_STATES.map((s) => {
          const n = counts[s.key] ?? 0;
          const isEdited = s.key === "edited";
          const editColor = isEdited && editedColored ? (n < TARGET_MIN ? "text-danger" : "text-success") : "text-foreground";
          const dim = n === 0 && !(isEdited && editedColored);
          return (
            <div key={s.key} className={cn("rounded-lg py-1", dim && "opacity-35")}>
              <p className={cn("text-center font-display text-base font-800", editColor)}>{n}</p>
              <p className="text-center text-[9px] font-600 leading-tight text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>
    </button>
  );
}

/* ── Level 2 · one client ────────────────────────────────────────────────── */
function Level2({ client, clips, onBack, onAdvance, onDelete, onOpenDetail, onBatch }: {
  client: Client; clips: Clip[]; onBack: () => void;
  onAdvance: (c: Clip) => void; onDelete: (c: Clip) => void; onOpenDetail: (id: string) => void; onBatch: () => void;
}) {
  const counts = countByState(clips);
  const [stage, setStage] = useState<ClipState>(() => CLIP_STATES.find((s) => (counts[s.key] ?? 0) > 0)?.key ?? "idea");
  const list = clips.filter((c) => c.state === stage);

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Înapoi" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition active:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-800">{client.name}</h1>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {CLIP_STATES.map((s) => {
          const n = counts[s.key] ?? 0;
          const on = stage === s.key;
          return (
            <button key={s.key} onClick={() => setStage(s.key)}
              className={cn("flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-700 transition", on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
              {s.label}
              <span className={cn("grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px]", on ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        {list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Niciun clip în „{clipStateLabel(stage)}".</p>
        ) : list.map((c) => {
          const next = CLIP_STATE_ORDER[CLIP_STATE_ORDER.indexOf(c.state) + 1];
          return <SwipeRow key={c.id} clip={c} nextLabel={next ? clipStateLabel(next) : null} onAdvance={() => onAdvance(c)} onDelete={() => onDelete(c)} onOpen={() => onOpenDetail(c.id)} />;
        })}
      </div>
      {list.length === 0 && (
        <div className="mt-2 flex justify-center">
          <Button size="sm" variant="outline" onClick={onBatch}><Layers className="h-4 w-4" /> Adaugă în lot</Button>
        </div>
      )}
      {/* Clears the corner FAB so the last row is never occluded (constitution). */}
      <div aria-hidden className="h-20" />
    </>
  );
}

// Swipe right = advance, swipe left = delete, tap = open. The advance button is a
// non-swipe fallback.
function SwipeRow({ clip, nextLabel, onAdvance, onDelete, onOpen }: { clip: Clip; nextLabel: string | null; onAdvance: () => void; onDelete: () => void; onOpen: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef(0);
  const active = useRef(false);
  const dxRef = useRef(0); // committed delta for the release decision; pointermove is a
  const THRESH = 72;       // continuous-priority event, so its setDx may not flush before pointerup
  return (
    <div className="relative overflow-hidden border-b border-border/60 last:border-b-0">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-5 text-xs font-800">
        <span className="text-success">{nextLabel ? "Avansează" : ""}</span>
        <span className="text-danger">Șterge</span>
      </div>
      <div
        onPointerDown={(e) => { active.current = true; start.current = e.clientX; dxRef.current = 0; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (!active.current) return; dxRef.current = e.clientX - start.current; setDx(dxRef.current); }}
        onPointerUp={() => {
          if (!active.current) return;
          active.current = false;
          const d = dxRef.current; dxRef.current = 0; setDx(0);
          // Past a full threshold = action; anything under half a threshold is a tap
          // (forgives ~36px of finger drift); the band between just snaps back.
          if (d > THRESH && nextLabel) onAdvance();
          else if (d < -THRESH) onDelete();
          else if (Math.abs(d) < THRESH / 2) onOpen();
        }}
        onPointerCancel={() => { active.current = false; dxRef.current = 0; setDx(0); }}
        style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 0.2s" : "none" }}
        className="relative flex items-center gap-3 bg-card px-4 py-3.5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-600">{clip.title || "(fără titlu)"}</p>
          {clip.scheduledDate && needsDate(clip.state) && <p className="mt-0.5 text-xs font-600 text-primary">{clip.scheduledDate}</p>}
        </div>
        {nextLabel && (
          <button onClick={(e) => { e.stopPropagation(); onAdvance(); }} onPointerDown={(e) => e.stopPropagation()} aria-label={`Avansează în ${nextLabel}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition active:bg-primary/20"><ArrowRight className="h-[18px] w-[18px]" /></button>
        )}
      </div>
    </div>
  );
}

function NewClipModal({ open, prefillClient, clients, onClose, onCreate }: {
  open: boolean; prefillClient: string | null; clients: { id: string; name: string }[]; onClose: () => void;
  onCreate: (input: { clientId: string | null; title: string; state: ClipState; scheduledDate: string | null }) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [state, setState] = useState<ClipState>("idea");
  const [date, setDate] = useState(todayISO());
  useEffect(() => { if (open) { setClientId(prefillClient ?? ""); setTitle(""); setState("idea"); setDate(todayISO()); } }, [open, prefillClient]);
  const submit = () => { if (!title.trim()) return; onCreate({ clientId: clientId || null, title: title.trim(), state, scheduledDate: needsDate(state) ? date : null }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Clip nou" subtitle="Un clip nou în pipeline" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!title.trim()} onClick={submit}><Plus className="h-4 w-4" /> Adaugă</Button></>}>
      <div className="space-y-3">
        <Input autoFocus className="h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Titlul clipului" />
        <div className="grid grid-cols-2 gap-3">
          <Select className="h-12" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select className="h-12" value={state} onChange={(e) => setState(e.target.value as ClipState)}>{CLIP_STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
        </div>
        {needsDate(state) && <Input className="h-12" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      </div>
    </Modal>
  );
}
