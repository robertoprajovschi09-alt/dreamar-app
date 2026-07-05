import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Panel, Button, Input } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { QuickAdd } from "@/components/QuickAdd";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useClips, clipStateLabel, type Clip } from "@/lib/clips";
import { useClients } from "@/lib/clients";
import { useMoney } from "@/lib/money";
import { useFilmShots, type FilmShot } from "@/lib/filmshots";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Client } from "@/data/sample";
import { cn, formatCurrency } from "@/lib/utils";
import {
  AlertTriangle, CalendarPlus, Check, ChevronDown, Film, MapPin, Pencil, Plus, Send, Trash2, Video, X, type LucideIcon,
} from "lucide-react";

/*
 * "Azi" — the agency's daily operating system. Every row is an action to take
 * or a done-confirmation: today's posts (read from the calendar), the clip
 * buffer per client, the Tue/Wed Tulcea route, and the filming queue. Shared
 * state lives here so the Quick Add FAB stays in sync with the sections.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function mondayOf(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

const BUFFER_MIN = 3;
const BUFFER_MAX = 5;

export default function Today() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { openNewClient } = useUI();
  const { profile } = useWorkspace();
  const clipsCtx = useClips();
  const { clients, loading: lc } = useClients();
  const film = useFilmShots();
  const money = useMoney();

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();
  const today = new Date();
  const dateLabel = today.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
  const day = today.getDay(); // 0 Sun … 6 Sat
  const active = useMemo(() => clients.filter((c) => c.status === "active"), [clients]);

  if (clipsCtx.loading || lc) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />

      <div className="space-y-3">
        <OverdueCollections money={money} clients={clients} onOpen={() => navigate("/money")} />
        <PostsToday clipsCtx={clipsCtx} onCalendar={() => navigate("/content?tab=calendar")} />
        <ClipBuffer active={active} clips={clipsCtx.clips} />
        {(day === 2 || day === 3) && <TulceaRoute day={day} />}
        <FilmList film={film} clients={clients} />
      </div>

      <QuickAdd
        clients={clients}
        mobile={isMobile}
        onCreateClip={(input) => void clipsCtx.createClip(input)}
        onAddShot={(d, c) => void film.addShot(d, c)}
        onNewClient={openNewClient}
      />
    </>
  );
}

/* ── Section wrapper + shared controls ───────────────────────────────────── */
function Section({ icon: Icon, tone, title, right, children }: { icon: LucideIcon; tone: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
        <p className="font-display text-sm font-800">{title}</p>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </Panel>
  );
}
function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button onClick={onChange} aria-label={label ?? (checked ? "Debifează" : "Bifează")} aria-pressed={checked}
      className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition",
        checked ? "gradient-primary border-transparent text-white" : "border-border bg-card text-transparent hover:border-primary/60")}>
      <Check className="h-5 w-5" />
    </button>
  );
}
const countPill = (n: number | string) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{n}</span>;

/* ── 0 · Scadențe depășite (încasări neîncasate cu ziua trecută) ──────────── */
// Citește lista expusă de useMoney; se afișează doar când există restanțe.
function OverdueCollections({ money, clients, onOpen }: { money: ReturnType<typeof useMoney>; clients: Client[]; onOpen: () => void }) {
  const overdue = money.overdueCollections;
  if (money.loading || overdue.length === 0) return null;
  const nameOf = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Client" : "Fără client");
  return (
    <Section icon={AlertTriangle} tone="text-danger" title="Scadențe depășite"
      right={<button onClick={onOpen} className="text-xs font-700 text-primary hover:underline">Vezi în Bani</button>}>
      {overdue.map((o) => (
        <div key={o.id} className="flex items-center gap-3 border-t border-l-2 border-border/60 border-l-danger bg-danger/[0.04] px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-600">{nameOf(o.clientId)}</span>
          <span className="shrink-0 text-[11px] font-700 text-danger">{o.daysOverdue === 1 ? "scadent de 1 zi" : `scadent de ${o.daysOverdue} zile`}</span>
          <span className="shrink-0 text-sm font-700">{formatCurrency(o.amount)}</span>
        </div>
      ))}
    </Section>
  );
}

/* ── 1 · De postat azi ───────────────────────────────────────────────────── */
// The clip is the single source of truth. Show today's scheduled/posted clips;
// the checkbox flips scheduled ⇄ posted on the same clip.
const POST_TIMES_KEY = "dreamar-post-times";
function PostsToday({ clipsCtx, onCalendar }: { clipsCtx: ReturnType<typeof useClips>; onCalendar: () => void }) {
  const { clips, updateClip } = clipsCtx;
  const todayISO = isoOf(new Date());
  const list = clips
    .filter((c) => (c.state === "scheduled" || c.state === "posted") && c.scheduledDate === todayISO)
    .sort((a, b) => Number(a.state === "posted") - Number(b.state === "posted") || a.clientName.localeCompare(b.clientName));
  const doneCount = list.filter((c) => c.state === "posted").length;

  const [times, setTimes] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(POST_TIMES_KEY) || "{}"); } catch { return {}; } });
  const setTime = (id: string, t: string) => setTimes((prev) => { const next = { ...prev, [id]: t }; try { localStorage.setItem(POST_TIMES_KEY, JSON.stringify(next)); } catch { /* private */ } return next; });

  return (
    <Section icon={Send} tone="text-primary" title="De postat azi" right={list.length ? countPill(`${doneCount}/${list.length}`) : null}>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-border/60 px-4 py-8 text-center">
          <span className="text-sm text-muted-foreground">Nimic programat astăzi.</span>
          <Button size="sm" variant="outline" onClick={onCalendar}><CalendarPlus className="h-4 w-4" /> Deschide calendarul</Button>
        </div>
      ) : (
        list.map((c) => {
          const posted = c.state === "posted";
          return (
            <div key={c.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-3">
              <Checkbox checked={posted} onChange={() => void updateClip(c.id, { state: posted ? "scheduled" : "posted" })} label={`Marchează „${c.title}” ca postat`} />
              <input type="time" value={times[c.id] ?? ""} onChange={(e) => setTime(c.id, e.target.value)} aria-label="Ora postării"
                className="h-8 w-[4.5rem] shrink-0 rounded-lg border border-input bg-card px-1.5 text-xs tabular-nums ring-focus" />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-600", posted && "text-muted-foreground line-through")}>{c.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{c.clientName}{c.platform ? ` · ${c.platform}` : ""}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-700", posted ? "bg-success/15 text-success" : "bg-primary/15 text-primary")}>{clipStateLabel(c.state)}</span>
            </div>
          );
        })
      )}
    </Section>
  );
}

/* ── 2 · Tampon clipuri ──────────────────────────────────────────────────── */
// Tampon = how many of the client's clips are in the "Editat" state. Derived,
// read-only — no manual counter anymore.
function ClipBuffer({ active, clips }: { active: Client[]; clips: Clip[] }) {
  const editedByClient = useMemo(() => {
    const m: Record<string, number> = {};
    clips.forEach((c) => { if (c.state === "edited" && c.clientId) m[c.clientId] = (m[c.clientId] ?? 0) + 1; });
    return m;
  }, [clips]);
  return (
    <Section icon={Video} tone="text-[hsl(var(--warning))]" title="Tampon clipuri"
      right={<span className="text-[11px] font-600 text-muted-foreground">țintă {BUFFER_MIN}–{BUFFER_MAX} · în Editat</span>}>
      {active.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Niciun client activ.</p>
      ) : active.map((c) => {
        const n = editedByClient[c.id] ?? 0;
        const st = n < BUFFER_MIN ? { dot: "bg-danger", text: "text-danger", label: "Sub tampon" }
          : n <= BUFFER_MAX ? { dot: "bg-success", text: "text-success", label: "OK" }
          : { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Buffer mare" };
        return (
          <div key={c.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-600">{c.name}</span>
              <span className={cn("text-[11px] font-700", st.text)}>{st.label}</span>
            </span>
            <span className={cn("min-w-[2ch] text-center font-display text-xl font-800", st.text)}>{n}</span>
          </div>
        );
      })}
    </Section>
  );
}

/* ── 3 · Tura Tulcea (Tue/Wed) ───────────────────────────────────────────── */
const TULCEA_DEFAULT: Record<number, string[]> = {
  2: ["Geomar filmare batch", "Modern Glass filmare", "Marinarul seara"],
  3: ["Adelyn filmare", "Yanis walkaround", "retur Constanța"],
};
const TULCEA_TPL_KEY = "dreamar-tulcea-template";
const TULCEA_CHECKS_KEY = "dreamar-tulcea-checks";
function loadTemplate(): Record<number, string[]> {
  try { const raw = JSON.parse(localStorage.getItem(TULCEA_TPL_KEY) || "null"); if (raw && Array.isArray(raw[2]) && Array.isArray(raw[3])) return raw; } catch { /* ignore */ }
  return TULCEA_DEFAULT;
}
function TulceaRoute({ day }: { day: number }) {
  const weekKey = isoOf(mondayOf(new Date()));
  const [template, setTemplate] = useState<Record<number, string[]>>(loadTemplate);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem(TULCEA_CHECKS_KEY) || "null"); setChecks(raw && raw.week === weekKey ? (raw.done ?? {}) : {}); } catch { setChecks({}); }
  }, [weekKey]);

  const items = template[day] ?? [];
  const toggle = (idx: number) => setChecks((prev) => {
    const next = { ...prev, [`${day}-${idx}`]: !prev[`${day}-${idx}`] };
    try { localStorage.setItem(TULCEA_CHECKS_KEY, JSON.stringify({ week: weekKey, done: next })); } catch { /* ignore */ }
    return next;
  });
  const saveTemplate = (nextItems: string[]) => {
    const next = { ...template, [day]: nextItems.map((s) => s.trim()).filter(Boolean) };
    setTemplate(next);
    try { localStorage.setItem(TULCEA_TPL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const doneCount = items.filter((_, i) => checks[`${day}-${i}`]).length;

  return (
    <Section icon={MapPin} tone="text-info" title={`Tura Tulcea · ${day === 2 ? "marți" : "miercuri"}`}
      right={<span className="flex items-center gap-2">
        {!editing && items.length > 0 && countPill(`${doneCount}/${items.length}`)}
        <button onClick={() => setEditing((e) => !e)} className="inline-flex items-center gap-1 text-xs font-700 text-primary">{editing ? "Gata" : <><Pencil className="h-3.5 w-3.5" /> Editează</>}</button>
      </span>}>
      {editing ? (
        <TulceaEditor items={items} onSave={saveTemplate} />
      ) : items.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Niciun item — apasă „Editează" ca să adaugi.</p>
      ) : items.map((it, i) => {
        const done = !!checks[`${day}-${i}`];
        return (
          <div key={`${it}-${i}`} className="flex items-center gap-3 border-t border-border/60 px-4 py-3">
            <Checkbox checked={done} onChange={() => toggle(i)} label={it} />
            <span className={cn("min-w-0 flex-1 text-sm font-600", done && "text-muted-foreground line-through")}>{it}</span>
          </div>
        );
      })}
    </Section>
  );
}
function TulceaEditor({ items, onSave }: { items: string[]; onSave: (items: string[]) => void }) {
  const [rows, setRows] = useState<string[]>(items.length ? items : [""]);
  const commit = (next: string[]) => { setRows(next); onSave(next); };
  return (
    <div className="space-y-2 border-t border-border/60 px-4 py-3">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={r} onChange={(e) => commit(rows.map((x, j) => (j === i ? e.target.value : x)))} placeholder="ex. Geomar filmare batch" />
          <button onClick={() => commit(rows.filter((_, j) => j !== i))} aria-label="Șterge" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-danger"><X className="h-4 w-4" /></button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setRows([...rows, ""])}><Plus className="h-4 w-4" /> Adaugă item</Button>
    </div>
  );
}

/* ── 4 · De filmat ───────────────────────────────────────────────────────── */
function FilmList({ film, clients }: { film: ReturnType<typeof useFilmShots>; clients: { id: string; name: string }[] }) {
  const { shots, addShot, toggleShot, removeShot } = film;
  const [desc, setDesc] = useState("");
  const [showDone, setShowDone] = useState(false);
  const nameOf = useMemo(() => { const m = new Map(clients.map((c) => [c.id, c.name] as const)); return (id: string | null) => (id ? m.get(id) ?? "" : ""); }, [clients]);
  const submit = () => { if (desc.trim()) { void addShot(desc, null); setDesc(""); } };
  const open = shots.filter((s) => !s.done);
  const done = shots.filter((s) => s.done);

  const Row = (s: FilmShot) => (
    <div key={s.id} className="group flex items-center gap-3 border-t border-border/60 px-4 py-3">
      <Checkbox checked={s.done} onChange={() => void toggleShot(s.id, !s.done)} label={s.description} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-600", s.done && "text-muted-foreground line-through")}>{s.description}</span>
        {nameOf(s.clientId) && <span className="block truncate text-xs text-muted-foreground">{nameOf(s.clientId)}</span>}
      </span>
      <button onClick={() => void removeShot(s.id)} aria-label="Șterge" className="text-muted-foreground opacity-60 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  return (
    <Section icon={Film} tone="text-muted-foreground" title="De filmat" right={open.length ? countPill(open.length) : null}>
      <div className="flex gap-2 border-t border-border/60 px-4 py-3">
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Adaugă rapid — ce filmezi?" className="flex-1" />
        <Button variant="primary" onClick={submit} disabled={!desc.trim()}><Plus className="h-4 w-4" /></Button>
      </div>
      {open.map(Row)}
      {open.length === 0 && done.length === 0 && <p className="border-t border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Nimic de filmat momentan.</p>}
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-2 border-t border-border/60 px-4 py-2.5 text-left text-xs font-700 text-muted-foreground transition hover:bg-muted/40">
            <ChevronDown className={cn("h-4 w-4 transition", showDone && "rotate-180")} /> Finalizate ({done.length})
          </button>
          {showDone && done.map(Row)}
        </>
      )}
    </Section>
  );
}
