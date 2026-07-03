import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Button, Select, Panel, SectionCard, Badge, Input, Segmented } from "@/components/ui";
import { Drawer, Modal } from "@/components/overlay";
import { useToast } from "@/lib/toast";
import { useContent, type ContentPost, type UIPostStatus } from "@/lib/content";
import { useClients } from "@/lib/clients";
import { useLibrary } from "@/lib/library";
import { SkeletonRows } from "@/components/Skeleton";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, GripVertical, Loader2, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { cn, lastClientId, rememberClient } from "@/lib/utils";

const statusMeta: Record<UIPostStatus, { label: string; cls: string; dot: string }> = {
  idea: { label: "Idee", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  script: { label: "Scenariu", cls: "bg-info/15 text-info", dot: "bg-info" },
  filming: { label: "Filmare", cls: "bg-indigo-500/15 text-indigo-500", dot: "bg-indigo-500" },
  editing: { label: "Editare", cls: "bg-indigo-500/15 text-indigo-500", dot: "bg-indigo-500" },
  approval: { label: "Pentru aprobare", cls: "bg-warning/20 text-[hsl(var(--warning))]", dot: "bg-[hsl(var(--warning))]" },
  approved: { label: "Aprobat", cls: "bg-success/15 text-success", dot: "bg-success" },
  scheduled: { label: "Programat", cls: "bg-primary/15 text-primary", dot: "bg-primary" },
  published: { label: "Publicat", cls: "bg-emerald-500/15 text-emerald-500", dot: "bg-emerald-500" },
  analyzed: { label: "Analizat", cls: "bg-foreground/10 text-foreground", dot: "bg-foreground" },
};
const statusOrder = Object.keys(statusMeta) as UIPostStatus[];
const weekdays = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const platforms = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn", "Twitter", "WhatsApp"];
const APPROVAL_LABEL: Record<string, string> = {
  pending: "Trimisă — așteaptă clientul",
  approved: "Aprobată de client",
  approved_with_changes: "Aprobată cu modificări",
  rejected: "Respinsă de client",
};

const iso = (y: number, m: number, day: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
function dayInMonth(date: string | null, y: number, m: number): number | null {
  if (!date) return null;
  const [yy, mm, dd] = date.split("-").map(Number);
  return yy === y && mm - 1 === m ? dd : null;
}
const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleString("ro-RO", { month: "long", year: "numeric" });

export default function ContentCalendar() {
  const { push } = useToast();
  const { posts: allPosts, loading, live, createPost, updatePost, deletePost, requestApproval } = useContent();
  const { clients } = useClients();
  const { hooks } = useLibrary();
  // Posts hidden during their delete-undo window.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef(new Map<string, number>());
  const posts = useMemo(() => (hiddenIds.size ? allPosts.filter((p) => !hiddenIds.has(p.id)) : allPosts), [allPosts, hiddenIds]);

  const today = useMemo(() => new Date(), []);
  // Sticky month: planning 2 months ahead shouldn't reset to today on every visit.
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

  const selected = posts.find((p) => p.id === selectedId) ?? null;
  // Filter options come from the live client list (so they appear even with 0 posts),
  // merged with any client names already on posts.
  const clientNames = useMemo(
    () => [...new Set([...clients.map((c) => c.name), ...posts.map((p) => p.clientName)])].sort(),
    [clients, posts]
  );

  // Deep link (?client=Name) from the weekly queues pre-filters the calendar.
  const [params] = useSearchParams();
  const clientParam = params.get("client");
  useEffect(() => {
    if (clientParam && clientNames.includes(clientParam)) setClient(clientParam);
  }, [clientParam, clientNames]);

  const matches = (p: ContentPost) =>
    (client === "all" || p.clientName === client) && (platform === "all" || p.platform === platform);

  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const firstWeekday = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // Monday = 0
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const isCurrentMonth = ym.y === today.getFullYear() && ym.m === today.getMonth();

  function shiftMonth(delta: number) {
    setYm((p) => {
      const d = new Date(p.y, p.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }
  function onDrop(day: number) {
    if (!draggingId) return;
    updatePost(draggingId, { date: iso(ym.y, ym.m, day) });
    setDraggingId(null);
    setOverDay(null);
  }

  const defaultComposerDate = iso(ym.y, ym.m, isCurrentMonth ? today.getDate() : 1);
  // Open the composer, optionally pre-filled with a clicked day's date.
  function openComposer(date?: string) {
    if (live && clients.length === 0) return; // need a client first
    setComposerDate(date ?? defaultComposerDate);
  }

  function Chip({ p }: { p: ContentPost }) {
    const dim = !matches(p);
    return (
      <div
        draggable
        onDragStart={() => setDraggingId(p.id)}
        onDragEnd={() => { setDraggingId(null); setOverDay(null); }}
        onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
        title={`${p.title} · ${p.clientName} · ${p.platform}`}
        className={cn(
          "group flex cursor-grab items-start gap-1 rounded-md px-1.5 py-1 text-[10px] font-600 leading-tight active:cursor-grabbing",
          statusMeta[p.status].cls, draggingId === p.id && "opacity-40", dim && "opacity-30"
        )}
      >
        <GripVertical className="mt-px h-3 w-3 shrink-0 opacity-40 group-hover:opacity-70" />
        <span className="min-w-0">
          <span className="block truncate">{p.title}</span>
          <span className="block truncate opacity-70">{p.clientName}{p.platform ? ` · ${p.platform}` : ""}</span>
        </span>
      </div>
    );
  }

  function DayCell({ day }: { day: number | null }) {
    const dayPosts = day ? posts.filter((p) => dayInMonth(p.date, ym.y, ym.m) === day) : [];
    const isToday = isCurrentMonth && day === today.getDate();
    const isOver = overDay === day && draggingId !== null;
    return (
      <div
        onDragOver={(e) => { if (!day) return; e.preventDefault(); setOverDay(day); }}
        onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
        onDrop={() => day && onDrop(day)}
        onClick={() => day && openComposer(iso(ym.y, ym.m, day))}
        className={cn(
          "group relative min-h-[120px] border-b border-r border-border/70 p-1.5 transition-colors [&:nth-child(7n)]:border-r-0",
          day && "cursor-pointer hover:bg-muted/30",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40"
        )}
      >
        {day && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <span className="grid h-5 w-5 place-items-center rounded-md text-primary opacity-0 transition group-hover:opacity-100" title="Adaugă postare în această zi">
                <Plus className="h-3.5 w-3.5" />
              </span>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-700", isToday ? "gradient-primary text-white" : "text-muted-foreground")}>{day}</span>
            </div>
            <div className="space-y-1">{dayPosts.map((p) => <Chip key={p.id} p={p} />)}</div>
          </>
        )}
      </div>
    );
  }

  const listPosts = posts.filter(matches).slice().sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  return (
    <>
      <PageHeader title="Calendar de conținut" subtitle="Trage postările pentru a le reprograma · apasă pentru a deschide editorul">
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
            <CalendarDays className="h-3.5 w-3.5" /> {posts.length} {posts.length === 1 ? "postare" : "postări"}
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
      ) : posts.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Încă nicio postare</p>
          <p className="max-w-sm text-sm text-muted-foreground">{live && clients.length === 0 ? "Adaugă mai întâi un client, apoi planifică-i conținutul aici." : "Creează prima postare pentru a începe planificarea calendarului de conținut."}</p>
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
          {listPosts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nicio postare nu corespunde acestor filtre.</p>}
          {listPosts.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/40">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-center">
                <span className="font-display text-sm font-800 leading-none">{p.date ? Number(p.date.split("-")[2]) : "—"}</span>
                <span className="text-[9px] uppercase text-muted-foreground">{p.date ? new Date(p.date + "T00:00:00").toLocaleString("ro-RO", { month: "short" }) : ""}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-600">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.clientName}{p.platform ? ` · ${p.platform}` : ""}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-600", statusMeta[p.status].cls)}>{statusMeta[p.status].label}</span>
            </button>
          ))}
        </Panel>
      )}

      <SectionCard title="Etape de producție">
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusMeta).map(([k, v]) => (
            <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-600", v.cls)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />{v.label}
            </span>
          ))}
        </div>
      </SectionCard>

      <PostComposer open={composerDate !== null} onClose={() => setComposerDate(null)} clients={clients} hooks={hooks} defaultDate={composerDate ?? defaultComposerDate}
        onCreate={async (input) => {
          const res = await createPost(input);
          if (res.error) push({ tone: "danger", title: "Nu s-a putut crea postarea", description: res.error });
          else push({ tone: "success", title: "Postare creată", description: input.title });
          return res;
        }} />

      <PostDrawer post={selected} onClose={() => setSelectedId(null)} statusMeta={statusMeta} statusOrder={statusOrder}
        onRequestApproval={async (p) => {
          const res = await requestApproval(p);
          if (res.error) push({ tone: "danger", title: "Nu s-a putut trimite spre aprobare", description: res.error });
          else push({ tone: "success", title: "Trimis clientului", description: `${p.title} — așteaptă decizia clientului.` });
        }}
        onSave={async (patch) => {
          const res = selected ? await updatePost(selected.id, patch) : {};
          if (res.error) { push({ tone: "danger", title: "Nu s-a putut salva postarea", description: res.error }); return; }
          setSelectedId(null); push({ tone: "success", title: "Postare salvată" });
        }}
        onStatus={async (s) => {
          if (!selected) return;
          const res = await updatePost(selected.id, { status: s });
          if (res.error) push({ tone: "danger", title: "Nu s-a putut actualiza statusul", description: res.error });
        }}
        onDelete={() => {
          if (!selected) return;
          const id = selected.id;
          const title = selected.title;
          setSelectedId(null);
          // Hide instantly; only delete in the DB after the undo window passes.
          setHiddenIds((prev) => new Set(prev).add(id));
          const timer = window.setTimeout(async () => {
            deleteTimers.current.delete(id);
            const res = await deletePost(id);
            setHiddenIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
            if (res.error) push({ tone: "danger", title: "Nu s-a putut șterge postarea", description: res.error });
          }, 5000);
          deleteTimers.current.set(id, timer);
          push({
            tone: "warning", title: "Postare ștearsă", description: title,
            action: { label: "Anulează", run: () => {
              const t = deleteTimers.current.get(id);
              if (t) { window.clearTimeout(t); deleteTimers.current.delete(id); setHiddenIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); }
            } },
          });
        }} />
    </>
  );
}

function PostComposer({ open, onClose, clients, hooks, defaultDate, onCreate }: {
  open: boolean; onClose: () => void; defaultDate: string;
  clients: { id: string; name: string }[];
  hooks: { id: string; text: string; avgScore: number }[];
  onCreate: (input: { clientId: string; title: string; platform: string; status: UIPostStatus; date: string | null }) => Promise<{ error?: string }>;
}) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [status, setStatus] = useState<UIPostStatus>("idea");
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [showHooks, setShowHooks] = useState(false);
  useEffect(() => { if (open) { setClientId(lastClientId(clients)); setTitle(""); setPlatform("Instagram"); setStatus("idea"); setDate(defaultDate); setShowHooks(false); } }, [open, clients, defaultDate]);

  async function submit() {
    if (!title.trim() || !clientId || busy) return;
    setBusy(true);
    const res = await onCreate({ clientId, title: title.trim(), platform, status, date });
    setBusy(false);
    if (!res.error) { rememberClient(clientId); onClose(); }
  }
  const dateLabel = date ? new Date(date + "T00:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" }) : "";
  return (
    <Modal open={open} onClose={onClose} title="Postare nouă" subtitle={dateLabel ? `Pentru ${dateLabel}` : "Planifică o postare de conținut"} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !title.trim() || !clientId} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Creează postarea</Button></>}>
      <div className="space-y-4">
        <Field label="Titlu">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="ex. Tur proprietate — Sky 2 camere" />
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
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as UIPostStatus)} className="w-full">{statusOrder.map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

function PostDrawer({ post, onClose, statusMeta, statusOrder, onSave, onStatus, onDelete, onRequestApproval }: {
  post: ContentPost | null; onClose: () => void;
  statusMeta: Record<UIPostStatus, { label: string; cls: string; dot: string }>; statusOrder: UIPostStatus[];
  onSave: (patch: { title: string; script: string; platform: string; date: string | null }) => void; onStatus: (s: UIPostStatus) => void; onDelete: () => void;
  onRequestApproval: (post: ContentPost) => void;
}) {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    if (post) {
      setTitle(post.title); setScript(post.script); setPlatform(post.platform || "");
      setDate(post.date && /^\d{4}-\d{2}-\d{2}/.test(String(post.date)) ? String(post.date).slice(0, 10) : "");
    }
  }, [post]);
  return (
    <Drawer open={!!post} onClose={onClose} title={post?.title}
      subtitle={post ? `${post.clientName}${post.platform ? ` · ${post.platform}` : ""}${post.date ? ` · ${post.date}` : ""}` : undefined}
      badge={post && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-700", statusMeta[post.status].cls)}>{statusMeta[post.status].label}</span>}
      footer={<>
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}><Trash2 className="h-4 w-4" /> Șterge</Button>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => onSave({ title, script, platform, date: date || null })}>Salvează</Button>
      </>}>
      {post && (
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-xs font-700 text-muted-foreground">Titlu</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-700 text-muted-foreground">Aprobare client</p>
            {post.approvalStatus && post.approvalStatus !== "withdrawn" ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-600">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />{APPROVAL_LABEL[post.approvalStatus] ?? "Trimisă spre aprobare"}
                </span>
                {post.approvalStatus !== "pending" && (
                  <Button size="sm" variant="outline" onClick={() => onRequestApproval(post)}><Send className="h-3.5 w-3.5" /> Retrimite</Button>
                )}
              </div>
            ) : (
              <Button size="sm" variant="outline" className="w-full" onClick={() => onRequestApproval(post)}>
                <Send className="h-4 w-4" /> Trimite clientului spre aprobare
              </Button>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-700 text-muted-foreground">Status de producție</p>
            <div className="space-y-1">
              {statusOrder.map((s, i) => {
                const curIdx = statusOrder.indexOf(post.status);
                const done = i < curIdx; const active = i === curIdx;
                return (
                  <button key={s} onClick={() => onStatus(s)} className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition", active ? "bg-primary/[0.07]" : "hover:bg-muted")}>
                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-700", done ? "bg-success text-white" : active ? "gradient-primary text-white" : "border border-border text-muted-foreground")}>{done ? "✓" : i + 1}</span>
                    <span className={cn("font-600", active ? "text-foreground" : done ? "text-muted-foreground line-through" : "text-muted-foreground")}>{statusMeta[s].label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-700 text-muted-foreground"><FileText className="mr-1 inline h-3.5 w-3.5" />Scenariu</p>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} className="min-h-[110px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Hook, unghi principal, CTA…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-700 text-muted-foreground"><User className="mr-1 inline h-3.5 w-3.5" />Platformă</p>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 w-full"><option value="">—</option>{platforms.map((p) => <option key={p}>{p}</option>)}</Select>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-700 text-muted-foreground"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />Data programată</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
