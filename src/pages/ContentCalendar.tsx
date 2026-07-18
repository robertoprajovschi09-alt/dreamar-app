import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Button, Panel, Segmented } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { useClips, type Clip } from "@/lib/clips";
import { useClients } from "@/lib/clients";
import { ClipEditor } from "@/pages/Pipeline";
import { clientColor } from "@/lib/clientColors";
import { SkeletonRows } from "@/components/Skeleton";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The calendar is a VIEW over each clip's two optional dates:
 *   - a Filmare entry (outlined, clapperboard) for a clip's film day;
 *   - a Postare entry (filled) for a clip's post day.
 * A clip carrying both dates shows up twice. Every client has a fixed color.
 */

type EntryType = "film" | "post";
type CalEntry = { key: string; type: EntryType; date: string; clip: Clip };

const NONE = "__none__";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, day: number) => `${y}-${pad(m + 1)}-${pad(day)}`;
const todayISO = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
const dayOf = (date: string) => Number(date.split("-")[2]);
const inMonth = (date: string, y: number, m: number) => { const [yy, mm] = date.split("-").map(Number); return yy === y && mm - 1 === m; };
const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleString("ro-RO", { month: "long", year: "numeric" });
const monthShort = (m: number) => new Date(2000, m, 1).toLocaleString("ro-RO", { month: "short" }).replace(".", "");
const weekdayName = (y: number, m: number, day: number) => new Date(y, m, day).toLocaleString("ro-RO", { weekday: "short" }).replace(".", "");
const mondayIdx = (y: number, m: number, day: number) => (new Date(y, m, day).getDay() + 6) % 7; // 0 = Monday
const withAlpha = (hex: string, aa: string) => `${hex}${aa}`;

export default function ContentCalendar() {
  return <CalendarView />;
}

export function CalendarView({ lockedClientId }: { lockedClientId?: string }) {
  const embedded = !!lockedClientId;
  const { push } = useToast();
  const { clips, loading, updateClip, deleteClip } = useClips();
  const { clients } = useClients();

  // Build the two entry streams from the clips.
  const entries = useMemo(() => {
    const out: CalEntry[] = [];
    for (const c of clips) {
      if (c.filmDate) out.push({ key: `f-${c.id}`, type: "film", date: c.filmDate, clip: c });
      if (c.scheduledDate) out.push({ key: `p-${c.id}`, type: "post", date: c.scheduledDate, clip: c });
    }
    return out;
  }, [clips]);

  // Which clients own an entry (drives the chip row).
  const chipClients = useMemo(() => {
    const ids = new Set(clips.filter((c) => c.filmDate || c.scheduledDate).map((c) => c.clientId));
    return clients.filter((c) => ids.has(c.id));
  }, [clips, clients]);
  const hasNoClient = useMemo(() => clips.some((c) => !c.clientId && (c.filmDate || c.scheduledDate)), [clips]);

  const [client, setClient] = useState<string>(() => {
    try { return localStorage.getItem("dreamar-cal-client") || "all"; } catch { return "all"; }
  });
  useEffect(() => { if (!embedded) try { localStorage.setItem("dreamar-cal-client", client); } catch { /* private */ } }, [client, embedded]);
  const [params] = useSearchParams();
  const clientParam = params.get("client");
  useEffect(() => { if (clientParam && clients.some((c) => c.id === clientParam)) setClient(clientParam); }, [clientParam, clients]);

  const active = lockedClientId ?? client;
  const shown = useMemo(() => {
    if (active === "all") return entries;
    if (active === NONE) return entries.filter((e) => !e.clip.clientId);
    return entries.filter((e) => e.clip.clientId === active);
  }, [entries, active]);

  const today = useMemo(() => new Date(), []);
  const [ym, setYm] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("dreamar-cal-ym") || "null");
      if (saved && typeof saved.y === "number" && typeof saved.m === "number") return saved as { y: number; m: number };
    } catch { /* ignore */ }
    return { y: today.getFullYear(), m: today.getMonth() };
  });
  useEffect(() => { try { sessionStorage.setItem("dreamar-cal-ym", JSON.stringify(ym)); } catch { /* ignore */ } }, [ym]);
  const isCurrentMonth = ym.y === today.getFullYear() && ym.m === today.getMonth();

  const [view, setView] = useState<"weeks" | "month">(() => {
    try { return (localStorage.getItem("dreamar-cal-view") as "weeks" | "month") || "weeks"; } catch { return "weeks"; }
  });
  useEffect(() => { try { localStorage.setItem("dreamar-cal-view", view); } catch { /* ignore */ } }, [view]);
  // The month grid is a desktop-only toggle; weeks are the default everywhere else,
  // so below the toggle's breakpoint we always show weeks (never strand a phone in month view).
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  useEffect(() => {
    const on = () => setIsWide(window.innerWidth >= 1024);
    window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  }, []);
  const showMonth = isWide && view === "month";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = clips.find((c) => c.id === selectedId) ?? null;
  const dragEntry = useRef<CalEntry | null>(null);
  const [overDay, setOverDay] = useState<number | null>(null);

  // Entries of the current month, grouped by day-of-month.
  const byDay = useMemo(() => {
    const m = new Map<number, CalEntry[]>();
    shown.filter((e) => inMonth(e.date, ym.y, ym.m)).forEach((e) => {
      const d = dayOf(e.date); const a = m.get(d) ?? []; a.push(e); m.set(d, a);
    });
    // Within a day: filmings first, then postings in clock order (timeless last).
    const keyOf = (e: CalEntry) => (e.type === "post" ? (e.clip.scheduledTime ?? "99:99") : "00:00");
    m.forEach((a) => a.sort((x, y) => keyOf(x).localeCompare(keyOf(y))));
    return m;
  }, [shown, ym]);
  const monthCount = useMemo(() => [...byDay.values()].reduce((n, a) => n + a.length, 0), [byDay]);

  // The month split into Monday-started weeks (clipped to the month).
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const weeks = useMemo(() => {
    const out: number[][] = []; let cur: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (cur.length && mondayIdx(ym.y, ym.m, d) === 0) { out.push(cur); cur = []; }
      cur.push(d);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [ym, daysInMonth]);
  const currentWeek = isCurrentMonth ? weeks.findIndex((w) => w.includes(today.getDate())) : -1;
  const [expandedWeek, setExpandedWeek] = useState<number | null>(currentWeek >= 0 ? currentWeek : null);
  useEffect(() => { setExpandedWeek(currentWeek >= 0 ? currentWeek : null); }, [ym.y, ym.m, currentWeek]);

  function shiftMonth(delta: number) { setYm((p) => { const d = new Date(p.y, p.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); }
  function dropOn(day: number) {
    const e = dragEntry.current; dragEntry.current = null; setOverDay(null);
    if (!e) return;
    const date = iso(ym.y, ym.m, day);
    if (e.type === "film") void updateClip(e.clip.id, { filmDate: date });
    else void updateClip(e.clip.id, { scheduledDate: date });
  }

  const chips: { value: string; label: string; color?: string }[] = [
    { value: "all", label: "General" },
    ...chipClients.map((c) => ({ value: c.id, label: c.name, color: clientColor(c.id) })),
    ...(hasNoClient ? [{ value: NONE, label: "Fără client", color: clientColor(null) }] : []),
  ];

  return (
    <>
      {!embedded && (
        <PageHeader title="Calendar" help="calendar" subtitle="Filmări și postări, pe zile. Fiecare client are calendarul lui." />
      )}

      {/* Client calendars: General + one per client (hidden when locked to a client) */}
      {!embedded && chips.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chips.map((ch) => {
            const on = active === ch.value;
            return (
              <button key={ch.value} onClick={() => setClient(ch.value)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-700 transition", on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50")}>
                {ch.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ch.color }} />}
                {ch.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Month navigation + view toggle */}
      <Panel className="mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Luna anterioară"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[150px] text-center font-display text-base font-800">{monthLabel(ym.y, ym.m)}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Luna următoare"><ChevronRight className="h-4 w-4" /></Button>
        {!isCurrentMonth && <Button variant="ghost" size="sm" onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() })}>Astăzi</Button>}
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs font-600 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" /> {monthCount} {monthCount === 1 ? "intrare" : "intrări"}
        </span>
        {/* The classic month grid stays available on desktop; weeks are the default. */}
        {isWide && (
          <div className="ml-auto">
            <Segmented value={view} onChange={(v) => setView(v as "weeks" | "month")} options={[{ label: "Săptămâni", value: "weeks" }, { label: "Lună", value: "month" }]} />
          </div>
        )}
      </Panel>

      {loading ? (
        <SkeletonRows rows={6} cols={3} />
      ) : monthCount === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Nimic în {monthLabel(ym.y, ym.m).toLowerCase()}</p>
          <p className="max-w-sm text-sm text-muted-foreground">Pune o zi de filmare sau o zi de postare pe un clip din Pipeline și apare aici.</p>
        </Panel>
      ) : !showMonth ? (
        <Panel className="divide-y divide-border/70 p-0">
          {weeks.map((w, i) => {
            const start = w[0], end = w[w.length - 1];
            const count = w.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);
            const open = expandedWeek === i;
            return (
              <div key={i}>
                <button onClick={() => setExpandedWeek(open ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/30">
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                  <span className="min-w-0 flex-1 text-sm font-700">Săptămâna {i + 1} <span className="font-500 text-muted-foreground">· {start}-{end} {monthShort(ym.m)}</span></span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{count}</span>
                </button>
                {open && (
                  <div className="bg-muted/10">
                    {w.map((d) => {
                      const list = byDay.get(d) ?? [];
                      const isToday = isCurrentMonth && d === today.getDate();
                      const isOver = overDay === d;
                      return (
                        <div key={d}
                          onDragOver={(e) => { if (dragEntry.current) { e.preventDefault(); setOverDay(d); } }}
                          onDragLeave={() => setOverDay((x) => (x === d ? null : x))}
                          onDrop={() => dropOn(d)}
                          className={cn("flex gap-3 border-t border-border/50 px-4 py-2", isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30")}>
                          <div className="w-12 shrink-0 pt-1 text-center">
                            <div className="text-[10px] font-700 uppercase text-muted-foreground">{weekdayName(ym.y, ym.m, d)}</div>
                            <div className={cn("mx-auto grid h-6 w-6 place-items-center rounded-full text-xs font-800", isToday ? "gradient-primary text-white" : "text-foreground")}>{d}</div>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 py-0.5">
                            {list.length === 0 ? <span className="py-1 text-xs text-muted-foreground/50">-</span>
                              : list.map((e) => <EntryChip key={e.key} entry={e} showClient={active === "all"} onOpen={() => setSelectedId(e.clip.id)} onDragStart={() => { dragEntry.current = e; }} onDragEnd={() => { dragEntry.current = null; setOverDay(null); }} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Panel>
      ) : (
        <MonthGrid ym={ym} today={today} isCurrentMonth={isCurrentMonth} byDay={byDay} showClient={active === "all"}
          overDay={overDay} setOverDay={setOverDay} onOpen={(id) => setSelectedId(id)}
          onDragStart={(e) => { dragEntry.current = e; }} onDragEnd={() => { dragEntry.current = null; setOverDay(null); }} onDrop={dropOn} dragging={dragEntry} />
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded border border-foreground/40"><Clapperboard className="h-2.5 w-2.5" /></span> Filmare (contur)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-foreground/15" /> Postare (plin)</span>
      </div>

      <ClipEditor clip={selected} clients={clients} onClose={() => setSelectedId(null)}
        onSave={(patch) => { if (selected) { void updateClip(selected.id, patch); push({ tone: "success", title: "Clip salvat" }); } setSelectedId(null); }}
        onDelete={() => { if (selected) { void deleteClip(selected.id); push({ tone: "warning", title: "Clip șters", description: selected.title }); } setSelectedId(null); }} />
    </>
  );
}

function EntryChip({ entry, showClient, onOpen, onDragStart, onDragEnd }: {
  entry: CalEntry; showClient: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  const color = clientColor(entry.clip.clientId);
  const isFilm = entry.type === "film";
  const style = isFilm
    ? { borderColor: color, backgroundColor: withAlpha(color, "14") }
    : { borderColor: "transparent", backgroundColor: withAlpha(color, "2b") };
  return (
    <button draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen} style={style}
      title={`${isFilm ? "Filmare" : "Postare"} · ${entry.clip.clientName}${entry.clip.title ? ` · ${entry.clip.title}` : ""}`}
      className="group flex max-w-full cursor-grab items-start gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] font-600 leading-tight active:cursor-grabbing">
      {isFilm
        ? <Clapperboard className="mt-px h-3 w-3 shrink-0" style={{ color }} />
        : <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="min-w-0">
        <span className="block truncate">{!isFilm && entry.clip.scheduledTime && <span className="font-800">{entry.clip.scheduledTime} </span>}{entry.clip.title || "(fără titlu)"}</span>
        {showClient && <span className="block truncate opacity-70">{entry.clip.clientName}</span>}
      </span>
    </button>
  );
}

const WEEKDAYS = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
function MonthGrid({ ym, today, isCurrentMonth, byDay, showClient, overDay, setOverDay, onOpen, onDragStart, onDragEnd, onDrop, dragging }: {
  ym: { y: number; m: number }; today: Date; isCurrentMonth: boolean; byDay: Map<number, CalEntry[]>; showClient: boolean;
  overDay: number | null; setOverDay: (d: number | null) => void; onOpen: (id: string) => void;
  onDragStart: (e: CalEntry) => void; onDragEnd: () => void; onDrop: (day: number) => void; dragging: React.MutableRefObject<CalEntry | null>;
}) {
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const firstWeekday = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <Panel className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((d) => <div key={d} className="px-3 py-2.5 text-center text-[11px] font-700 uppercase tracking-wide text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const list = day ? byDay.get(day) ?? [] : [];
              const isToday = isCurrentMonth && day === today.getDate();
              const isOver = overDay === day && dragging.current !== null;
              return (
                <div key={i}
                  onDragOver={(e) => { if (day && dragging.current) { e.preventDefault(); setOverDay(day); } }}
                  onDragLeave={() => setOverDay(overDay === day ? null : overDay)}
                  onDrop={() => day && onDrop(day)}
                  className={cn("min-h-[120px] border-b border-r border-border/70 p-1.5 [&:nth-child(7n)]:border-r-0", isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40")}>
                  {day && (
                    <>
                      <div className="mb-1 flex justify-end">
                        <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-700", isToday ? "gradient-primary text-white" : "text-muted-foreground")}>{day}</span>
                      </div>
                      <div className="space-y-1">
                        {list.map((e) => <EntryChip key={e.key} entry={e} showClient={showClient} onOpen={() => onOpen(e.clip.id)} onDragStart={() => onDragStart(e)} onDragEnd={onDragEnd} />)}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}
