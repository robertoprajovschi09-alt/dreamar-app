import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Button, Panel, Badge, Input, Select } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useContent } from "@/lib/content";
import { useClients } from "@/lib/clients";
import { useFilmShots } from "@/lib/filmshots";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  CalendarPlus, Check, Film, MapPin, Pencil, Plus, Minus, Send, Trash2, Video, X, type LucideIcon,
} from "lucide-react";

/*
 * "Azi" — the daily driver. Four sections: what to post today (reads the
 * content calendar), the per-client clip buffer, the recurring Tulcea route
 * (Tue/Wed), and a quick filming to-do list.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const BUFFER_MIN = 3;
const BUFFER_MAX = 5;

export default function Today() {
  const navigate = useNavigate();
  const { openNewClient } = useUI();
  const { profile } = useWorkspace();
  const { loading: lp } = useContent();
  const { loading: lc } = useClients();

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();
  const today = new Date();
  const dateLabel = today.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
  const day = today.getDay(); // 0 Sun … 6 Sat

  if (lp || lc) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}>
        <Button variant="primary" size="md" onClick={openNewClient}><Plus className="h-4 w-4" /> Client nou</Button>
      </PageHeader>

      <div className="space-y-4">
        <PostsToday onCalendar={() => navigate("/content?tab=calendar")} />
        <ClipBuffer />
        {(day === 2 || day === 3) && <TulceaRoute day={day} />}
        <FilmList />
      </div>
    </>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ icon: Icon, tone, title, right, children }: {
  icon: LucideIcon; tone: string; title: string; right?: ReactNode; children: ReactNode;
}) {
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
    <button
      onClick={onChange}
      aria-label={label ?? (checked ? "Debifează" : "Bifează")}
      aria-pressed={checked}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition",
        checked ? "gradient-primary border-transparent text-white" : "border-border bg-card text-transparent hover:border-primary/60"
      )}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

/* ── 1 · De postat azi ───────────────────────────────────────────────────── */
function PostsToday({ onCalendar }: { onCalendar: () => void }) {
  const { posts, updatePost } = useContent();
  const todayISO = isoOf(new Date());
  const list = posts
    .filter((p) => p.date === todayISO && (p.status === "scheduled" || p.status === "published"))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  const doneCount = list.filter((p) => p.status === "published").length;

  return (
    <Section icon={Send} tone="text-primary" title="De postat azi"
      right={list.length ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{doneCount}/{list.length}</span> : null}>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <span className="text-sm text-muted-foreground">Nimic programat azi.</span>
          <Button size="sm" variant="outline" onClick={onCalendar}><CalendarPlus className="h-4 w-4" /> Deschide calendarul</Button>
        </div>
      ) : (
        list.map((p) => {
          const posted = p.status === "published";
          return (
            <div key={p.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
              <Checkbox checked={posted} onChange={() => void updatePost(p.id, { status: posted ? "scheduled" : "published" })} label={`Marchează „${p.title}” ca postat`} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-600", posted && "text-muted-foreground line-through")}>{p.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.clientName}</span>
              </span>
              {p.platform && <Badge tone="neutral">{p.platform}</Badge>}
            </div>
          );
        })
      )}
    </Section>
  );
}

/* ── 2 · Tampon clipuri ──────────────────────────────────────────────────── */
function ClipBuffer() {
  const { clients, live } = useClients();
  const active = clients.filter((c) => c.status === "active");
  const [buffers, setBuffers] = useState<Record<string, number>>({});

  // Seed once per client: live reads the DB value, demo reads localStorage.
  useEffect(() => {
    setBuffers((prev) => {
      const next = { ...prev };
      active.forEach((c) => {
        if (next[c.id] === undefined) {
          if (live) next[c.id] = c.clipBuffer ?? 0;
          else { try { next[c.id] = Number(localStorage.getItem(`dreamar-clipbuffer-${c.id}`) ?? "0") || 0; } catch { next[c.id] = 0; } }
        }
      });
      return next;
    });
  }, [clients, live]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(id: string, val: number) {
    if (live && supabase) { void supabase.from("clients").update({ clip_buffer: val }).eq("id", id); }
    else { try { localStorage.setItem(`dreamar-clipbuffer-${id}`, String(val)); } catch { /* private mode */ } }
  }
  // Functional update so rapid +/- taps don't drop increments (stale closure).
  function bump(id: string, delta: number) {
    setBuffers((prev) => {
      const val = Math.max(0, (prev[id] ?? 0) + delta);
      persist(id, val);
      return { ...prev, [id]: val };
    });
  }

  return (
    <Section icon={Video} tone="text-[hsl(var(--warning))]" title="Tampon clipuri"
      right={<span className="text-[11px] font-600 text-muted-foreground">țintă {BUFFER_MIN}–{BUFFER_MAX}</span>}>
      {active.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Niciun client activ.</p>
      ) : (
        active.map((c) => {
          const n = buffers[c.id] ?? 0;
          const low = n < BUFFER_MIN;
          return (
            <div key={c.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-600">{c.name}</span>
                {low && <span className="text-[11px] font-700 text-danger">sub tampon</span>}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => bump(c.id, -1)} disabled={n === 0} aria-label="Scade" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                <span className={cn("min-w-8 text-center font-display text-lg font-800", low ? "text-danger" : "text-foreground")}>{n}</span>
                <button onClick={() => bump(c.id, 1)} aria-label="Crește" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          );
        })
      )}
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
  try {
    const raw = JSON.parse(localStorage.getItem(TULCEA_TPL_KEY) || "null");
    if (raw && Array.isArray(raw[2]) && Array.isArray(raw[3])) return raw;
  } catch { /* ignore */ }
  return TULCEA_DEFAULT;
}

function TulceaRoute({ day }: { day: number }) {
  const weekKey = isoOf(mondayOf(new Date()));
  const [template, setTemplate] = useState<Record<number, string[]>>(loadTemplate);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);

  // Load this week's checks; auto-reset when the stored week isn't the current one.
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(TULCEA_CHECKS_KEY) || "null");
      setChecks(raw && raw.week === weekKey ? (raw.done ?? {}) : {});
    } catch { setChecks({}); }
  }, [weekKey]);

  const items = template[day] ?? [];

  function toggle(idx: number) {
    const key = `${day}-${idx}`;
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(TULCEA_CHECKS_KEY, JSON.stringify({ week: weekKey, done: next })); } catch { /* ignore */ }
      return next;
    });
  }
  function saveTemplate(nextItems: string[]) {
    const cleaned = nextItems.map((s) => s.trim()).filter(Boolean);
    const next = { ...template, [day]: cleaned };
    setTemplate(next);
    try { localStorage.setItem(TULCEA_TPL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const doneCount = items.filter((_, i) => checks[`${day}-${i}`]).length;

  return (
    <Section icon={MapPin} tone="text-info" title={`Tura Tulcea · ${day === 2 ? "marți" : "miercuri"}`}
      right={
        <span className="flex items-center gap-2">
          {!editing && items.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{doneCount}/{items.length}</span>}
          <button onClick={() => setEditing((e) => !e)} className="inline-flex items-center gap-1 text-xs font-700 text-primary">
            {editing ? <>Gata</> : <><Pencil className="h-3.5 w-3.5" /> Editează</>}
          </button>
        </span>
      }>
      {editing ? (
        <TulceaEditor items={items} onSave={saveTemplate} />
      ) : items.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Niciun item — apasă „Editează" ca să adaugi.</p>
      ) : (
        items.map((it, i) => {
          const done = !!checks[`${day}-${i}`];
          return (
            <div key={`${it}-${i}`} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
              <Checkbox checked={done} onChange={() => toggle(i)} label={it} />
              <span className={cn("min-w-0 flex-1 text-sm font-600", done && "text-muted-foreground line-through")}>{it}</span>
            </div>
          );
        })
      )}
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
function FilmList() {
  const { shots, addShot, toggleShot, removeShot } = useFilmShots();
  const { clients } = useClients();
  const [desc, setDesc] = useState("");
  const [clientId, setClientId] = useState("");

  const nameOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.name] as const));
    return (id: string | null) => (id ? m.get(id) ?? "" : "");
  }, [clients]);

  function submit() {
    if (!desc.trim()) return;
    void addShot(desc, clientId || null);
    setDesc("");
  }

  const open = shots.filter((s) => !s.done);
  const done = shots.filter((s) => s.done);

  return (
    <Section icon={Film} tone="text-muted-foreground" title="De filmat"
      right={open.length ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{open.length}</span> : null}>
      <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3 sm:flex-row">
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Ce filmezi? ex. Reel testimonial la salon" className="flex-1" />
        <div className="flex gap-2">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="sm:w-40">
            <option value="">Fără client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button variant="primary" onClick={submit} disabled={!desc.trim()}><Plus className="h-4 w-4" /> Adaugă</Button>
        </div>
      </div>
      {[...open, ...done].map((s) => (
        <div key={s.id} className="group flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
          <Checkbox checked={s.done} onChange={() => void toggleShot(s.id, !s.done)} label={s.description} />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-600", s.done && "text-muted-foreground line-through")}>{s.description}</span>
            {nameOf(s.clientId) && <span className="block truncate text-xs text-muted-foreground">{nameOf(s.clientId)}</span>}
          </span>
          <button onClick={() => void removeShot(s.id)} aria-label="Șterge" className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      {shots.length === 0 && <p className="border-t border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Nimic de filmat momentan.</p>}
    </Section>
  );
}
