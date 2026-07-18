import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { QuickAdd } from "@/components/QuickAdd";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useClips, type Clip } from "@/lib/clips";
import { useClients } from "@/lib/clients";
import { useMoney } from "@/lib/money";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Client } from "@/data/sample";
import { cn } from "@/lib/utils";
import {
  Check, Clapperboard, Film, MapPin, Pencil, Plus, Send, Trash2, Video, X, type LucideIcon,
} from "lucide-react";

/*
 * "Azi" - the agency's daily operating system. A PURE READ of the clip pipeline
 * (posts to do, clips gata de postat, filming queue). Money alerts live in the
 * notification center now, not here. Nothing is stored on this screen - every row
 * reflects real pipeline state and every control mutates it. The only creation
 * affordance is the "De filmat" quick-add, which drops a clip into to_film.
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
  const money = useMoney();

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();
  const today = new Date();
  const day = today.getDay(); // 0 Sun … 6 Sat
  const dateLabel = today.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
  const subtitle = day === 0 ? "Duminică. Zi liberă, regula ta." : dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const active = useMemo(() => clients.filter((c) => c.status === "active"), [clients]);

  if (clipsCtx.loading || lc) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={subtitle} help="azi" />

      <div className="space-y-3">
        <PostsToday clips={clipsCtx.clips} onPost={(id, posted) => void clipsCtx.updateClip(id, { state: posted ? "posted" : "scheduled" })} onPipeline={() => navigate("/pipeline")} />
        <ClipBuffer active={active} clips={clipsCtx.clips} onClient={(id) => navigate(`/pipeline?client=${id}`)} onNewClient={openNewClient} />
        <FilmQueue
          clips={clipsCtx.clips}
          clients={clients}
          onCreate={(clientId, title) => void clipsCtx.createClip({ clientId, title, state: "to_film" })}
          onFilmed={(id) => void clipsCtx.updateClip(id, { state: "filmed" })}
          onDelete={(id) => void clipsCtx.deleteClip(id)}
        />
        {(day === 2 || day === 3) && <TulceaRoute day={day} />}
      </div>

      <QuickAdd
        clients={clients}
        mobile={isMobile}
        onCreateClip={(input) => void clipsCtx.createClip(input)}
        onAddShot={(desc, clientId) => void clipsCtx.createClip({ clientId, title: desc, state: "to_film" })}
        onAddDeal={(init) => void money.addDeal(init)}
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

/* ── 1 · De postat azi ───────────────────────────────────────────────────── */
// Today's Programat clips. Checking one moves it to Postat, so it leaves the
// list; when the last one is done we show "Gata pe azi." instead of an empty box.
function PostsToday({ clips, onPost, onPipeline }: { clips: Clip[]; onPost: (id: string, posted: boolean) => void; onPipeline: () => void }) {
  const todayISO = isoOf(new Date());
  // Timed posts come first in clock order; the ones with no time sink to the end.
  const scheduled = clips
    .filter((c) => c.state === "scheduled" && c.scheduledDate === todayISO)
    .sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99") || a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title));
  const postedCount = clips.filter((c) => c.state === "posted" && c.scheduledDate === todayISO).length;
  const total = scheduled.length + postedCount;

  return (
    <Section icon={Send} tone="text-primary" title="De postat azi" right={total > 0 ? countPill(`${postedCount}/${total}`) : null}>
      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-border/60 px-4 py-8 text-center">
          <span className="text-sm text-muted-foreground">Nimic programat astăzi.</span>
          <Button size="sm" variant="outline" onClick={onPipeline}><Clapperboard className="h-4 w-4" /> Deschide Pipeline</Button>
        </div>
      ) : scheduled.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-8 text-center text-sm font-600 text-success">Gata pe azi. 🎉</p>
      ) : (
        scheduled.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-3">
            <Checkbox checked={false} onChange={() => onPost(c.id, true)} label={`Marchează „${c.title}” ca postat`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-600">{c.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{c.clientName}{c.platform ? ` · ${c.platform}` : ""}</span>
            </span>
            {c.scheduledTime && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-700 text-muted-foreground">{c.scheduledTime}</span>}
            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-700 text-primary">Programat</span>
          </div>
        ))
      )}
    </Section>
  );
}

/* ── 2 · Clipuri gata de postat ──────────────────────────────────────────── */
// Derived from the pipeline: how many of each active client's clips sit in
// "Editat". No clips at all -> neutral "fără date încă"; <3 -> red "sub țintă";
// 3-5 -> green; >5 -> plain. No other labels.
function ClipBuffer({ active, clips, onClient, onNewClient }: { active: Client[]; clips: Clip[]; onClient: (id: string) => void; onNewClient: () => void }) {
  const counts = useMemo(() => {
    const total: Record<string, number> = {};
    const edited: Record<string, number> = {};
    clips.forEach((c) => {
      if (!c.clientId) return;
      total[c.clientId] = (total[c.clientId] ?? 0) + 1;
      if (c.state === "edited") edited[c.clientId] = (edited[c.clientId] ?? 0) + 1;
    });
    return { total, edited };
  }, [clips]);

  return (
    <Section icon={Video} tone="text-[hsl(var(--warning))]" title="Clipuri gata de postat"
      right={<span className="text-[11px] font-600 text-muted-foreground">ținta: {BUFFER_MIN}-{BUFFER_MAX} gata pe client</span>}>
      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Aici vezi câte clipuri gata de postat are fiecare client. Adaugă un client ca să-l urmărești.</p>
          <Button size="sm" variant="outline" onClick={onNewClient}><Plus className="h-4 w-4" /> Client nou</Button>
        </div>
      ) : active.map((c) => {
        const hasClips = (counts.total[c.id] ?? 0) > 0;
        const n = counts.edited[c.id] ?? 0;
        const st = !hasClips ? { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "fără date încă", value: "-" }
          : n < BUFFER_MIN ? { dot: "bg-danger", text: "text-danger", label: "sub țintă", value: String(n) }
          : n <= BUFFER_MAX ? { dot: "bg-success", text: "text-success", label: "", value: String(n) }
          : { dot: "bg-foreground/50", text: "text-foreground", label: "", value: String(n) };
        return (
          <button key={c.id} onClick={() => onClient(c.id)} className="flex w-full items-center gap-3 border-t border-border/60 px-4 py-2.5 text-left transition hover:bg-muted/40">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-600", !hasClips && "text-muted-foreground")}>{c.name}</span>
              {st.label && <span className={cn("text-[11px] font-700", st.text)}>{st.label}</span>}
            </span>
            <span className={cn("min-w-[2ch] text-center font-display text-xl font-800", st.text)}>{st.value}</span>
          </button>
        );
      })}
    </Section>
  );
}

/* ── 3 · De filmat ───────────────────────────────────────────────────────── */
// The pipeline's to_film clips, ordered by film day: today ("azi") first, then
// overdue ("restant"), then undated, then future. Checkbox moves a clip to Filmat.
function FilmQueue({ clips, clients, onCreate, onFilmed, onDelete }: {
  clips: Clip[];
  clients: { id: string; name: string }[];
  onCreate: (clientId: string | null, title: string) => void;
  onFilmed: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [qClient, setQClient] = useState("");
  const [qTitle, setQTitle] = useState("");
  const submit = () => { if (qTitle.trim()) { onCreate(qClient || null, qTitle.trim()); setQTitle(""); } };

  const todayStr = isoOf(new Date());
  const ordered = useMemo(() => {
    const rank = (c: Clip) => (c.filmDate === todayStr ? 0 : c.filmDate && c.filmDate < todayStr ? 1 : !c.filmDate ? 2 : 3);
    return clips.filter((c) => c.state === "to_film")
      .sort((a, b) => rank(a) - rank(b) || (a.filmDate ?? "9999").localeCompare(b.filmDate ?? "9999") || a.clientName.localeCompare(b.clientName));
  }, [clips, todayStr]);
  const openCount = ordered.length;
  const filmTag = (c: Clip) => {
    if (c.filmDate === todayStr) return <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-700 text-primary">azi</span>;
    if (c.filmDate && c.filmDate < todayStr) return <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-700 text-danger">restant</span>;
    if (c.filmDate) return <span className="shrink-0 text-[11px] font-600 text-muted-foreground">{new Date(c.filmDate + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}</span>;
    return null;
  };

  return (
    <Section icon={Film} tone="text-muted-foreground" title="De filmat" right={openCount ? countPill(openCount) : null}>
      <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3 sm:flex-row">
        <Select value={qClient} onChange={(e) => setQClient(e.target.value)} className="sm:w-40"><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <div className="flex flex-1 gap-2">
          <Input value={qTitle} onChange={(e) => setQTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Ce filmezi? ex. Reel testimonial" className="flex-1" />
          <Button variant="primary" onClick={submit} disabled={!qTitle.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      {openCount === 0 ? (
        <p className="border-t border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Lista ta de filmări. Adaugă mai sus ce ai de filmat.</p>
      ) : ordered.map((c) => (
        <div key={c.id} className="group flex items-center gap-3 border-t border-border/60 px-4 py-3">
          <Checkbox checked={false} onChange={() => onFilmed(c.id)} label={`Marchează „${c.title}” ca filmat`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-600">{c.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{c.clientId ? c.clientName : "Fără client"}</span>
          </span>
          {filmTag(c)}
          <button onClick={() => onDelete(c.id)} aria-label="Șterge" className="text-muted-foreground opacity-60 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </Section>
  );
}

/* ── 4 · Tura Tulcea (Tue/Wed) ───────────────────────────────────────────── */
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

  // Re-sync (and reset) whenever the ISO-week Monday changes - so a tab left
  // open across a week boundary drops last week's checkmarks instead of
  // persisting them under the new week's key.
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
        <p className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Nimic în listă. Apasă „Editează" ca să adaugi.</p>
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
      <Button size="sm" variant="outline" onClick={() => setRows([...rows, ""])}><Plus className="h-4 w-4" /> Adaugă rând</Button>
    </div>
  );
}
