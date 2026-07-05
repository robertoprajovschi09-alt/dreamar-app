import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Button, Select, Panel, SectionCard, Input, Segmented } from "@/components/ui";
import { Drawer, Modal } from "@/components/overlay";
import { useToast } from "@/lib/toast";
import { useClips, type Clip, type ClipState } from "@/lib/clips";
import { useClients } from "@/lib/clients";
import { useLibrary } from "@/lib/library";
import { SkeletonRows } from "@/components/Skeleton";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, GripVertical, Link2, Loader2, Plus, Sparkles, Trash2, User } from "lucide-react";
import { cn, lastClientId, rememberClient } from "@/lib/utils";

// The calendar is a VIEW over the scheduled/posted clips (one source of truth).
const CAL_META: Record<"scheduled" | "posted", { label: string; cls: string; dot: string }> = {
  scheduled: { label: "Programat", cls: "bg-primary/15 text-primary", dot: "bg-primary" },
  posted: { label: "Postat", cls: "bg-success/15 text-success", dot: "bg-success" },
};
const weekdays = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const platforms = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];

const iso = (y: number, m: number, day: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const todayISO = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
function dayInMonth(date: string | null, y: number, m: number): number | null {
  if (!date) return null;
  const [yy, mm, dd] = date.split("-").map(Number);
  return yy === y && mm - 1 === m ? dd : null;
}
const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleString("ro-RO", { month: "long", year: "numeric" });

export default function ContentCalendar() {
  const { push } = useToast();
  const { clips: all, loading, live, createClip, updateClip, deleteClip } = useClips();
  const { clients } = useClients();
  const { hooks } = useLibrary();
  // Only scheduled + posted clips live on the calendar.
  const calClips = useMemo(() => all.filter((c) => c.state === "scheduled" || c.state === "posted"), [all]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef(new Map<string, number>());
  const clips = useMemo(() => (hiddenIds.size ? calClips.filter((c) => !hiddenIds.has(c.id)) : calClips), [calClips, hiddenIds]);

  const today = useMemo(() => new Date(), []);
  const [ym, setYm] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("dreamar-cal-ym") || "null");
      if (saved && typeof saved.y === "number" && typeof saved.m === "number") return saved as { y: number; m: number };
    } catch { /* ignore */ }
    return { y: today.getFullYear(), m: today.getMonth() };
  });
  useEffect(() => { try { sessionStorage.setItem("dreamar-cal-ym", JSON.stringify(ym)); } catch { /* ignore */ } }, [ym]);
  const [client, setClient] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [view, setView] = useState<"month" | "list">(() => (typeof window !== "undefined" && window.innerWidth < 640 ? "list" : "month"));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerDate, setComposerDate] = useState<string | null>(null);

  const selected = clips.find((c) => c.id === selectedId) ?? null;
  const clientNames = useMemo(
    () => [...new Set([...clients.map((c) => c.name), ...clips.map((c) => c.clientName)])].sort(),
    [clients, clips]
  );

  const [params] = useSearchParams();
  const clientParam = params.get("client");
  useEffect(() => { if (clientParam && clientNames.includes(clientParam)) setClient(clientParam); }, [clientParam, clientNames]);

  const matches = (c: Clip) => (client === "all" || c.clientName === client) && (platform === "all" || c.platform === platform);

  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const firstWeekday = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const isCurrentMonth = ym.y === today.getFullYear() && ym.m === today.getMonth();

  function shiftMonth(delta: number) { setYm((p) => { const d = new Date(p.y, p.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); }
  function onDrop(day: number) {
    if (!draggingId) return;
    updateClip(draggingId, { scheduledDate: iso(ym.y, ym.m, day) });
    setDraggingId(null);
    setOverDay(null);
  }

  const defaultComposerDate = iso(ym.y, ym.m, isCurrentMonth ? today.getDate() : 1);
  function openComposer(date?: string) {
    if (live && clients.length === 0) return;
    setComposerDate(date ?? defaultComposerDate);
  }

  function Chip({ c }: { c: Clip }) {
    const dim = !matches(c);
    const meta = CAL_META[c.state as "scheduled" | "posted"];
    return (
      <div draggable onDragStart={() => setDraggingId(c.id)} onDragEnd={() => { setDraggingId(null); setOverDay(null); }}
        onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}
        title={`${c.title} · ${c.clientName} · ${c.platform}`}
        className={cn("group flex cursor-grab items-start gap-1 rounded-md px-1.5 py-1 text-[10px] font-600 leading-tight active:cursor-grabbing", meta.cls, draggingId === c.id && "opacity-40", dim && "opacity-30")}>
        <GripVertical className="mt-px h-3 w-3 shrink-0 opacity-40 group-hover:opacity-70" />
        <span className="min-w-0">
          <span className="block truncate">{c.title}</span>
          <span className="block truncate opacity-70">{c.clientName}{c.platform ? ` · ${c.platform}` : ""}</span>
        </span>
      </div>
    );
  }

  function DayCell({ day }: { day: number | null }) {
    const dayClips = day ? clips.filter((c) => dayInMonth(c.scheduledDate, ym.y, ym.m) === day) : [];
    const isToday = isCurrentMonth && day === today.getDate();
    const isOver = overDay === day && draggingId !== null;
    return (
      <div
        onDragOver={(e) => { if (!day) return; e.preventDefault(); setOverDay(day); }}
        onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
        onDrop={() => day && onDrop(day)}
        onClick={() => day && openComposer(iso(ym.y, ym.m, day))}
        className={cn("group relative min-h-[120px] border-b border-r border-border/70 p-1.5 transition-colors [&:nth-child(7n)]:border-r-0",
          day && "cursor-pointer hover:bg-muted/30", isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40")}>
        {day && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <span className="grid h-5 w-5 place-items-center rounded-md text-primary opacity-0 transition group-hover:opacity-100" title="Adaugă în această zi"><Plus className="h-3.5 w-3.5" /></span>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-700", isToday ? "gradient-primary text-white" : "text-muted-foreground")}>{day}</span>
            </div>
            <div className="space-y-1">{dayClips.map((c) => <Chip key={c.id} c={c} />)}</div>
          </>
        )}
      </div>
    );
  }

  const listClips = clips.filter(matches).slice().sort((a, b) => (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999"));

  return (
    <>
      <PageHeader title="Calendar de conținut" subtitle="Vedere peste clipurile Programate și Postate · trage pentru a reprograma">
        <Button variant="primary" onClick={() => openComposer()} disabled={live && clients.length === 0}><Plus className="h-4 w-4" /> Postare nouă</Button>
      </PageHeader>

      <Panel className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[150px] text-center font-display text-lg font-800">{monthLabel(ym.y, ym.m)}</span>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          {!isCurrentMonth && <Button variant="ghost" size="sm" onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() })}>Astăzi</Button>}
        </div>
        <Segmented value={view} onChange={setView} className="lg:ml-2" options={[{ label: "Lună", value: "month" }, { label: "Listă", value: "list" }]} />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-600 text-primary">
            <CalendarDays className="h-3.5 w-3.5" /> {clips.length} {clips.length === 1 ? "postare" : "postări"}
          </span>
          <Select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">Toți clienții</option>
            {clientNames.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">Toate platformele</option>
            {platforms.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </div>
      </Panel>

      {loading ? (
        <SkeletonRows rows={6} cols={4} />
      ) : clips.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Încă nicio postare programată</p>
          <p className="max-w-sm text-sm text-muted-foreground">{live && clients.length === 0 ? "Adaugă mai întâi un client, apoi planifică-i conținutul aici." : "Programează un clip aici, sau mută unul în „Programat” din Pipeline."}</p>
          {!(live && clients.length === 0) && <Button variant="primary" className="mt-1" onClick={() => openComposer()}><Plus className="h-4 w-4" /> Postare nouă</Button>}
        </Panel>
      ) : view === "month" ? (
        <Panel className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-border">
                {weekdays.map((d) => <div key={d} className="px-3 py-2.5 text-center text-[11px] font-700 uppercase tracking-wide text-muted-foreground">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">{cells.map((day, i) => <DayCell key={i} day={day} />)}</div>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel className="divide-y divide-border">
          {listClips.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nicio postare nu corespunde acestor filtre.</p>}
          {listClips.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/40">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-center">
                <span className="font-display text-sm font-800 leading-none">{c.scheduledDate ? Number(c.scheduledDate.split("-")[2]) : "·"}</span>
                <span className="text-[9px] uppercase text-muted-foreground">{c.scheduledDate ? new Date(c.scheduledDate + "T00:00:00").toLocaleString("ro-RO", { month: "short" }) : ""}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-600">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.clientName}{c.platform ? ` · ${c.platform}` : ""}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-600", CAL_META[c.state as "scheduled" | "posted"].cls)}>{CAL_META[c.state as "scheduled" | "posted"].label}</span>
            </button>
          ))}
        </Panel>
      )}

      <SectionCard title="Stări pe calendar">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(CAL_META) as [string, typeof CAL_META.scheduled][]).map(([k, v]) => (
            <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-600", v.cls)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />{v.label}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">Restul stărilor (Idee → Editat) se gestionează în Pipeline.</span>
        </div>
      </SectionCard>

      <Composer open={composerDate !== null} onClose={() => setComposerDate(null)} clients={clients} hooks={hooks} defaultDate={composerDate ?? defaultComposerDate}
        onCreate={async (input) => {
          const state: ClipState = input.date && input.date <= todayISO() ? "posted" : "scheduled";
          const res = await createClip({ clientId: input.clientId, title: input.title, platform: input.platform, scheduledDate: input.date, state });
          if (res.error) push({ tone: "danger", title: "Nu s-a putut crea postarea", description: res.error });
          else push({ tone: "success", title: "Postare creată", description: input.title });
          return res;
        }} />

      <ClipDrawer clip={selected} onClose={() => setSelectedId(null)}
        onSave={async (patch) => {
          const res = selected ? await updateClip(selected.id, patch) : {};
          if (res.error) { push({ tone: "danger", title: "Nu s-a putut salva", description: res.error }); return; }
          setSelectedId(null); push({ tone: "success", title: "Postare salvată" });
        }}
        onDelete={() => {
          if (!selected) return;
          const id = selected.id; const title = selected.title;
          setSelectedId(null);
          setHiddenIds((prev) => new Set(prev).add(id));
          const timer = window.setTimeout(async () => {
            deleteTimers.current.delete(id);
            const res = await deleteClip(id);
            setHiddenIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
            if (res.error) push({ tone: "danger", title: "Nu s-a putut șterge", description: res.error });
          }, 5000);
          deleteTimers.current.set(id, timer);
          push({ tone: "warning", title: "Postare ștearsă", description: title,
            action: { label: "Anulează", run: () => { const t = deleteTimers.current.get(id); if (t) { window.clearTimeout(t); deleteTimers.current.delete(id); setHiddenIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); } } } });
        }} />
    </>
  );
}

function Composer({ open, onClose, clients, hooks, defaultDate, onCreate }: {
  open: boolean; onClose: () => void; defaultDate: string;
  clients: { id: string; name: string }[];
  hooks: { id: string; text: string; avgScore: number }[];
  onCreate: (input: { clientId: string; title: string; platform: string; date: string }) => Promise<{ error?: string }>;
}) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [showHooks, setShowHooks] = useState(false);
  useEffect(() => { if (open) { setClientId(lastClientId(clients)); setTitle(""); setPlatform("Instagram"); setDate(defaultDate); setShowHooks(false); } }, [open, clients, defaultDate]);

  async function submit() {
    if (!title.trim() || !clientId || busy) return;
    setBusy(true);
    const res = await onCreate({ clientId, title: title.trim(), platform, date });
    setBusy(false);
    if (!res.error) { rememberClient(clientId); onClose(); }
  }
  const dateLabel = date ? new Date(date + "T00:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" }) : "";
  return (
    <Modal open={open} onClose={onClose} title="Postare nouă" subtitle={dateLabel ? `Pentru ${dateLabel}` : "Programează un clip"} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !title.trim() || !clientId} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Creează postarea</Button></>}>
      <div className="space-y-4">
        <Field label="Titlu">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="ex. Tur proprietate - Sky 2 camere" />
          <button type="button" onClick={() => setShowHooks((s) => !s)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-700 text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {showHooks ? "Ascunde hook-urile" : "Folosește un hook care a mers"}
          </button>
          {showHooks && (
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
              {hooks.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">Încă niciun hook în bibliotecă.</p>
              ) : hooks.map((h) => (
                <button type="button" key={h.id} onClick={() => { setTitle(h.text); setShowHooks(false); }} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted">
                  <span className="min-w-0 flex-1 text-xs leading-snug">{h.text}</span>
                  {h.avgScore > 0 && <span className="shrink-0 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-700 text-success">{h.avgScore}</span>}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platformă"><Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full">{platforms.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Dată"><Input type="date" value={date ?? ""} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function ClipDrawer({ clip, onClose, onSave, onDelete }: {
  clip: Clip | null; onClose: () => void;
  onSave: (patch: { title: string; platform: string; scheduledDate: string | null; state: ClipState; notes: string; finalLink: string }) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState("");
  const [state, setState] = useState<"scheduled" | "posted">("scheduled");
  const [notes, setNotes] = useState("");
  const [finalLink, setFinalLink] = useState("");
  useEffect(() => {
    if (clip) {
      setTitle(clip.title); setPlatform(clip.platform || "");
      setDate(clip.scheduledDate && /^\d{4}-\d{2}-\d{2}/.test(clip.scheduledDate) ? clip.scheduledDate.slice(0, 10) : "");
      setState(clip.state === "posted" ? "posted" : "scheduled");
      setNotes(clip.notes || ""); setFinalLink(clip.finalLink || "");
    }
  }, [clip]);
  const meta = clip ? CAL_META[clip.state as "scheduled" | "posted"] : null;
  return (
    <Drawer open={!!clip} onClose={onClose} title={clip?.title}
      subtitle={clip ? `${clip.clientName}${clip.platform ? ` · ${clip.platform}` : ""}${clip.scheduledDate ? ` · ${clip.scheduledDate}` : ""}` : undefined}
      badge={clip && meta && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-700", meta.cls)}>{meta.label}</span>}
      footer={<>
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}><Trash2 className="h-4 w-4" /> Șterge</Button>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => onSave({ title, platform, scheduledDate: date || null, state, notes, finalLink })}>Salvează</Button>
      </>}>
      {clip && (
        <div className="space-y-5">
          <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">Titlu</p><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <p className="mb-2 text-xs font-700 text-muted-foreground">Stare</p>
            <Segmented value={state} onChange={(v) => setState(v as "scheduled" | "posted")} options={[{ label: "Programat", value: "scheduled" }, { label: "Postat", value: "posted" }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-700 text-muted-foreground"><User className="mr-1 inline h-3.5 w-3.5" />Platformă</p>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 w-full"><option value="">Fără platformă</option>{platforms.map((p) => <option key={p}>{p}</option>)}</Select>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-700 text-muted-foreground"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />Data programată</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">Notițe</p><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[90px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Detalii scurte…" /></div>
          <div><p className="mb-1.5 text-xs font-700 text-muted-foreground"><Link2 className="mr-1 inline h-3.5 w-3.5" />Link final</p><Input value={finalLink} onChange={(e) => setFinalLink(e.target.value)} placeholder="https://…" /></div>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
