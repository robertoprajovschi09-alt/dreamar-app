import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import {
  fetchPortalMe, fetchPortalClips, whatsappLink, fetchMyProfile, submitOnboarding, fetchMyResults, submitResults,
  type PortalMe, type PortalClip, type PortalStatus,
} from "@/lib/portal";
import { nicheSpec, SHARED_QUESTIONS, type OnboardingQuestion } from "@/lib/niches";
import { ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, Check, ClipboardList, Clapperboard, Home, Loader2, LogOut, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Client portal — a world of its own, fully separate from the internal app.
 * Always dark (ignores the app theme), DR DREAM red as the only accent, mono
 * uppercase labels, mobile-first. Reads the whitelist views; writes (brand
 * profile + monthly numbers) go through SECURITY DEFINER RPCs.
 */

type Tab = "acasa" | "clipuri" | "calendar" | "rezultate" | "contact";

// Self-contained palette (warm near-black, warm white, DR DREAM red).
const PALETTE = {
  "--p-bg": "24 9% 6%",
  "--p-surface": "24 8% 10%",
  "--p-surface-2": "24 8% 13%",
  "--p-line": "26 7% 17%",
  "--p-text": "36 30% 94%",
  "--p-muted": "30 7% 58%",
  "--p-red": "2 78% 60%",
} as CSSProperties;

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "long" });
const fmtDow = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("ro-RO", { weekday: "short" }).replace(".", "");
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => new Date(key + "-01T00:00:00").toLocaleDateString("ro-RO", { month: "long", year: "numeric" });

const STATUS: Record<PortalStatus, { dot: string; text: string }> = {
  "Livrat": { dot: "bg-[hsl(var(--p-text))]", text: "text-[hsl(var(--p-text))]" },
  "Programat": { dot: "bg-[hsl(var(--p-red))]", text: "text-[hsl(var(--p-red))]" },
  "În lucru": { dot: "bg-[hsl(var(--p-muted))]", text: "text-[hsl(var(--p-muted))]" },
};

export default function ClientPortal() {
  const { live, agencyReady, isViewer, viewerClientName, viewerAgencyName } = useWorkspace();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("acasa");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<PortalMe | null>(null);
  const [clips, setClips] = useState<PortalClip[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (!isViewer) return;
    let on = true;
    (async () => {
      setLoading(true);
      const [m, c] = await Promise.all([fetchPortalMe(), fetchPortalClips()]);
      if (!on) return;
      if (m.me) setMe(m.me); else if (m.error) setErr(m.error);
      if (c.clips) setClips(c.clips);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [isViewer]);

  // Re-read the profile after the client submits onboarding (clears the nudge).
  const refreshMe = async () => { const m = await fetchPortalMe(); if (m.me) setMe(m.me); };
  const goTab = (id: Tab) => { setOnboarding(false); setTab(id); };

  const onSignOut = () => { void signOut(); navigate("/login"); };

  // Guards run after hooks.
  if (live && !agencyReady) return <Frame><Center><Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--p-muted))]" /></Center></Frame>;
  if (!isViewer) return <Navigate to="/dashboard" replace />;

  const clientName = me?.clientName || viewerClientName || "Brandul tău";
  const agencyName = me?.agencyName || viewerAgencyName || "DR DREAM";

  return (
    <Frame>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[hsl(var(--p-line))] bg-[hsl(var(--p-bg))]/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--p-red))] font-display text-lg font-800 text-white">d</span>
          <div className="min-w-0 leading-tight">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--p-muted))]">{agencyName}</p>
            <p className="truncate text-[15px] font-700 text-[hsl(var(--p-text))]">{clientName}</p>
          </div>
        </div>
        <button onClick={onSignOut} aria-label="Deconectare"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[hsl(var(--p-line))] text-[hsl(var(--p-muted))] transition hover:text-[hsl(var(--p-text))]">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-[440px] flex-1 px-4 pb-28 pt-5">
        {loading ? (
          <Center><Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--p-muted))]" /></Center>
        ) : err ? (
          <p className="mt-10 rounded-xl border border-[hsl(var(--p-line))] px-4 py-3 text-sm text-[hsl(var(--p-muted))]">{err}</p>
        ) : onboarding ? (
          <OnboardingView me={me} onDone={async () => { await refreshMe(); setOnboarding(false); setTab("acasa"); }} onCancel={() => setOnboarding(false)} />
        ) : (
          <>
            {tab === "acasa" && <Overview clips={clips} onboarded={!!me?.onboardedAt} onStartOnboarding={() => setOnboarding(true)} />}
            {tab === "clipuri" && <Clips clips={clips} />}
            {tab === "calendar" && <CalendarList clips={clips} />}
            {tab === "rezultate" && <ResultsForm me={me} />}
            {tab === "contact" && <Contact me={me} agencyName={agencyName} />}
          </>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[hsl(var(--p-line))] bg-[hsl(var(--p-bg))]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[440px] items-stretch justify-around">
          {([
            { id: "acasa", label: "Acasă", icon: Home },
            { id: "clipuri", label: "Clipuri", icon: Clapperboard },
            { id: "calendar", label: "Calendar", icon: CalendarDays },
            { id: "rezultate", label: "Rezultate", icon: BarChart3 },
            { id: "contact", label: "Contact", icon: MessageCircle },
          ] as { id: Tab; label: string; icon: typeof Home }[]).map((n) => (
            <button key={n.id} onClick={() => goTab(n.id)}
              className={cn("flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-600 transition",
                tab === n.id ? "text-[hsl(var(--p-red))]" : "text-[hsl(var(--p-muted))]")}>
              <n.icon className="h-[22px] w-[22px]" strokeWidth={2} />
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--p-bg))] text-[hsl(var(--p-text))]" style={PALETTE}>{children}</div>;
}
function Center({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[50vh] place-items-center">{children}</div>;
}
function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--p-muted))]">{children}</p>;
}

/* ------------------------------- Overview -------------------------------- */
function OnboardingNudge({ onStart }: { onStart: () => void }) {
  return (
    <button onClick={onStart}
      className="w-full rounded-2xl border border-[hsl(var(--p-red))]/40 bg-[hsl(var(--p-red))]/10 p-5 text-left transition active:scale-[0.99]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--p-red))] text-white"><ClipboardList className="h-4.5 w-4.5" /></span>
        <div className="min-w-0">
          <p className="text-[15px] font-700">Spune-ne despre brandul tău</p>
          <p className="mt-1 text-sm text-[hsl(var(--p-muted))]">Câteva întrebări scurte ca să facem conținut pe măsura ta. Durează 2 minute.</p>
          <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-700 text-[hsl(var(--p-red))]">Completează acum <ArrowUpRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </button>
  );
}
function Overview({ clips, onboarded, onStartOnboarding }: { clips: PortalClip[]; onboarded: boolean; onStartOnboarding: () => void }) {
  const today = todayISO();
  const thisMonth = monthKey(today);
  const delivered = clips.filter((c) => c.status === "Livrat" && c.postDate && monthKey(c.postDate) === thisMonth).length;
  const scheduled = clips.filter((c) => c.status === "Programat" && c.postDate && monthKey(c.postDate) === thisMonth).length;
  const everDelivered = clips.some((c) => c.status === "Livrat");
  const nextFilm = clips.map((c) => c.filmDate).filter((d): d is string => !!d && d >= today).sort()[0] ?? null;

  if (clips.length === 0) {
    return (
      <div className="space-y-5">
        {!onboarded && <OnboardingNudge onStart={onStartOnboarding} />}
        <Label>Luna aceasta</Label>
        <div className="rounded-2xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] p-6">
          <p className="text-lg font-700">Începem în curând</p>
          <p className="mt-1.5 text-sm text-[hsl(var(--p-muted))]">Aici o să vezi clipurile pe măsură ce le facem. Îți spunem noi când fixăm prima filmare.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!onboarded && <OnboardingNudge onStart={onStartOnboarding} />}
      <Label>{monthLabel(thisMonth)}</Label>
      <div className="grid grid-cols-2 gap-3">
        <Stat n={delivered} label="Clipuri livrate" />
        <Stat n={scheduled} label="Clipuri programate" />
      </div>
      <div className="rounded-2xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] p-5">
        <Label>{everDelivered ? "Următoarea filmare" : "Prima filmare"}</Label>
        {nextFilm ? (
          <p className="mt-2 text-2xl font-800 text-[hsl(var(--p-red))]">{fmtDay(nextFilm)}</p>
        ) : (
          <p className="mt-2 text-sm text-[hsl(var(--p-muted))]">Nu e nimic fixat momentan. Revenim cu o dată în curând.</p>
        )}
      </div>
    </div>
  );
}
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] p-5">
      <p className="font-display text-4xl font-800 leading-none">{n}</p>
      <p className="mt-2 text-xs text-[hsl(var(--p-muted))]">{label}</p>
    </div>
  );
}

/* ------------------------------- Clipuri --------------------------------- */
function Clips({ clips }: { clips: PortalClip[] }) {
  const dateOf = (c: PortalClip) => c.postDate ?? c.filmDate ?? "";
  const months = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => { const d = dateOf(c); if (d) set.add(monthKey(d)); });
    return Array.from(set).sort().reverse();
  }, [clips]);
  const [month, setMonth] = useState<string>("all");

  const shown = clips
    .filter((c) => month === "all" || monthKey(dateOf(c)) === month)
    .sort((a, b) => (dateOf(b)).localeCompare(dateOf(a)));

  return (
    <div className="space-y-4">
      <Label>Clipurile mele</Label>

      {months.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={month === "all"} onClick={() => setMonth("all")}>Toate</Chip>
          {months.map((m) => <Chip key={m} active={month === m} onClick={() => setMonth(m)}>{monthLabel(m)}</Chip>)}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-[hsl(var(--p-line))] px-4 py-6 text-center text-sm text-[hsl(var(--p-muted))]">
          {clips.length === 0 ? "Încă n-avem clipuri de arătat aici." : "Nimic în luna asta."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((c) => (
            <li key={c.id} className="rounded-2xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-[15px] font-700 leading-snug">{c.title}</p>
                <span className={cn("flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]", STATUS[c.status].text)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[c.status].dot)} />{c.status}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <p className="text-xs text-[hsl(var(--p-muted))]">{c.postDate ? `Postat ${fmtDay(c.postDate)}` : c.filmDate ? `Filmare ${fmtDay(c.filmDate)}` : "Fără dată încă"}</p>
                {c.videoLink && (
                  <a href={c.videoLink} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-700 text-[hsl(var(--p-red))]">
                    Vezi clipul <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-600 capitalize transition",
        active ? "border-[hsl(var(--p-red))] bg-[hsl(var(--p-red))]/12 text-[hsl(var(--p-red))]"
               : "border-[hsl(var(--p-line))] text-[hsl(var(--p-muted))]")}>
      {children}
    </button>
  );
}

/* ------------------------------- Calendar -------------------------------- */
type Ev = { date: string; type: "Filmare" | "Postare"; title: string };
function CalendarList({ clips }: { clips: PortalClip[] }) {
  const today = todayISO();
  const events: Ev[] = [];
  clips.forEach((c) => {
    if (c.filmDate && c.filmDate >= today) events.push({ date: c.filmDate, type: "Filmare", title: c.title });
    if (c.postDate && c.postDate >= today) events.push({ date: c.postDate, type: "Postare", title: c.title });
  });
  events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  const days = Array.from(new Set(events.map((e) => e.date)));

  return (
    <div className="space-y-4">
      <Label>Ce urmează</Label>
      {days.length === 0 ? (
        <p className="rounded-xl border border-[hsl(var(--p-line))] px-4 py-6 text-center text-sm text-[hsl(var(--p-muted))]">
          Nimic programat momentan. Revii aici când fixăm următoarea filmare sau postare.
        </p>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <div key={d}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--p-muted))]">{fmtDow(d)}</span>
                <span className="text-sm font-700">{fmtDay(d)}</span>
              </div>
              <ul className="space-y-2">
                {events.filter((e) => e.date === d).map((e, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] px-4 py-3">
                    <span className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", e.type === "Filmare" ? "text-[hsl(var(--p-red))]" : "text-[hsl(var(--p-muted))]")}>{e.type}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-600">{e.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Contact --------------------------------- */
function Contact({ me, agencyName }: { me: PortalMe | null; agencyName: string }) {
  const wa = whatsappLink(me?.agencyWhatsapp);
  return (
    <div className="space-y-4">
      <Label>Contact</Label>
      <div className="rounded-2xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] p-5">
        <p className="text-[15px] font-700">{agencyName}</p>
        {me?.agencyCity && <p className="mt-0.5 text-sm text-[hsl(var(--p-muted))]">{me.agencyCity}</p>}
        <p className="mt-3 text-sm text-[hsl(var(--p-muted))]">Scrie-ne oricând ai o întrebare sau o idee. Îți răspundem repede.</p>

        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--p-red))] py-3.5 text-[15px] font-700 text-white transition active:scale-[0.99]">
            <MessageCircle className="h-5 w-5" /> Scrie-ne pe WhatsApp
          </a>
        ) : me?.agencyWebsite ? (
          <a href={me.agencyWebsite.startsWith("http") ? me.agencyWebsite : `https://${me.agencyWebsite}`} target="_blank" rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--p-line))] py-3.5 text-sm font-700 text-[hsl(var(--p-text))]">
            {me.agencyWebsite} <ArrowUpRight className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------- Shared form bits --------------------------- */
const inputCls = "w-full rounded-xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface-2))] px-3.5 py-3 text-[15px] text-[hsl(var(--p-text))] outline-none placeholder:text-[hsl(var(--p-muted))]/70 focus:border-[hsl(var(--p-red))]";

// Renders one onboarding question in the portal palette. Chips answers are
// string[]; every other type is a string.
function PortalField({ q, value, onChange }: { q: OnboardingQuestion; value: string | string[]; onChange: (v: string | string[]) => void }) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-700">{q.label}</p>
        {q.help && <p className="mt-0.5 text-xs text-[hsl(var(--p-muted))]">{q.help}</p>}
      </div>
      {q.type === "chips" ? (
        <div className="flex flex-wrap gap-2">
          {(q.options ?? []).map((opt) => {
            const on = arr.includes(opt);
            return (
              <button key={opt} type="button"
                onClick={() => onChange(on ? arr.filter((x) => x !== opt) : [...arr, opt])}
                className={cn("rounded-full border px-3.5 py-2 text-xs font-600 transition",
                  on ? "border-[hsl(var(--p-red))] bg-[hsl(var(--p-red))]/12 text-[hsl(var(--p-red))]"
                     : "border-[hsl(var(--p-line))] text-[hsl(var(--p-muted))]")}>
                {opt}
              </button>
            );
          })}
        </div>
      ) : q.type === "select" ? (
        <select className={inputCls} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Alege…</option>
          {(q.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : q.type === "textarea" ? (
        <textarea rows={3} className={cn(inputCls, "resize-none")} placeholder={q.placeholder}
          value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={q.type === "number" ? "number" : "text"} inputMode={q.type === "number" ? "numeric" : undefined}
          className={inputCls} placeholder={q.placeholder}
          value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/* ------------------------------ Onboarding ------------------------------- */
// Brand questions the client fills once. Maps to clients.* via the
// client_submit_onboarding RPC. Prefills from the current profile so re-opening
// shows what was already answered (and preserves objectives the agency set).
function OnboardingView({ me, onDone, onCancel }: { me: PortalMe | null; onDone: () => void; onCancel: () => void }) {
  const spec = nicheSpec(me?.niche);
  const questions = useMemo(() => [...SHARED_QUESTIONS, ...spec.extraQuestions], [spec]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [objectives, setObjectives] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const { profile } = await fetchMyProfile();
      if (!on) return;
      const a: Record<string, string | string[]> = {};
      if (profile) {
        if (profile.brandVoice) a.brand_voice = profile.brandVoice.split(",").map((s) => s.trim()).filter(Boolean);
        if (profile.targetAudience) a.target_audience = profile.targetAudience;
        if (profile.goals.length) a.top_goals = profile.goals.join("\n");
        for (const [k, v] of Object.entries(profile.brandProfile)) {
          a[k] = Array.isArray(v) ? (v as string[]) : String(v ?? "");
        }
        setObjectives(profile.objectives);
      }
      setAnswers(a);
      setLoading(false);
    })();
    return () => { on = false; };
  }, []);

  const set = (id: string) => (v: string | string[]) => setAnswers((p) => ({ ...p, [id]: v }));

  const submit = async () => {
    setSaving(true); setError(null);
    const asStr = (id: string) => { const v = answers[id]; return Array.isArray(v) ? v.join(", ") : (v ?? "").toString().trim(); };
    const brandProfile: Record<string, unknown> = {};
    for (const q of questions) {
      if (["brand_voice", "target_audience", "top_goals"].includes(q.id)) continue;
      const v = answers[q.id];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      brandProfile[q.id] = v;
    }
    const { error } = await submitOnboarding({
      brandVoice: asStr("brand_voice"),
      targetAudience: asStr("target_audience"),
      objectives,
      goals: (asStr("top_goals")).split("\n").map((s) => s.trim()).filter(Boolean),
      brandProfile,
    });
    setSaving(false);
    if (error) { setError(error); return; }
    onDone();
  };

  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--p-muted))]" /></Center>;

  return (
    <div className="space-y-5">
      <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm font-600 text-[hsl(var(--p-muted))]">
        <ArrowLeft className="h-4 w-4" /> Înapoi
      </button>
      <div>
        <Label>Despre brandul tău</Label>
        <p className="mt-2 text-sm text-[hsl(var(--p-muted))]">Răspunsurile ne ajută să facem conținut care sună a tine. Poți reveni oricând să le schimbi.</p>
      </div>
      <div className="space-y-6">
        {questions.map((q) => <PortalField key={q.id} q={q} value={answers[q.id] ?? (q.type === "chips" ? [] : "")} onChange={set(q.id)} />)}
      </div>
      {error && <p className="rounded-xl border border-[hsl(var(--p-red))]/40 bg-[hsl(var(--p-red))]/10 px-4 py-3 text-sm text-[hsl(var(--p-red))]">{error}</p>}
      <button onClick={submit} disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--p-red))] py-3.5 text-[15px] font-700 text-white transition active:scale-[0.99] disabled:opacity-60">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Trimite răspunsurile</>}
      </button>
    </div>
  );
}

/* ------------------------------- Rezultate ------------------------------- */
// Monthly numbers the client reports. Prefilled from their own past entries;
// saved via client_submit_results (source='client').
function ResultsForm({ me }: { me: PortalMe | null }) {
  const spec = nicheSpec(me?.niche);
  const metrics = spec.monthlyMetrics;
  const period = monthKey(todayISO()) + "-01"; // first of current month, YYYY-MM-01
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const { metrics: m } = await fetchMyResults(period);
      if (!on) return;
      const v: Record<string, string> = {};
      if (m) for (const f of metrics) { const raw = m[f.field]; if (raw !== null && raw !== undefined) v[f.field] = String(raw); }
      setValues(v);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [period]);

  const submit = async () => {
    setSaving(true); setError(null);
    const payload: Record<string, string> = {};
    for (const f of metrics) { const raw = (values[f.field] ?? "").trim(); if (raw !== "") payload[f.field] = raw; }
    const { error } = await submitResults(period, payload);
    setSaving(false);
    if (error) { setError(error); return; }
    setSaved(true);
  };

  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--p-muted))]" /></Center>;

  return (
    <div className="space-y-5">
      <div>
        <Label>Rezultatele mele — {monthLabel(monthKey(todayISO()))}</Label>
        <p className="mt-2 text-sm text-[hsl(var(--p-muted))]">Trece cifrele lunii. Ne ajută să vedem ce aduce conținutul și ce merită împins mai tare.</p>
      </div>
      <div className="space-y-4">
        {metrics.map((f) => (
          <div key={f.field} className="flex items-center gap-3">
            <label htmlFor={`m-${f.field}`} className="min-w-0 flex-1 text-sm font-600">{f.label}</label>
            <input id={`m-${f.field}`} type="number" inputMode="numeric" min={0}
              className="w-28 shrink-0 rounded-xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface-2))] px-3 py-2.5 text-right text-[15px] text-[hsl(var(--p-text))] outline-none focus:border-[hsl(var(--p-red))]"
              placeholder="0" value={values[f.field] ?? ""}
              onChange={(e) => { setSaved(false); setValues((p) => ({ ...p, [f.field]: e.target.value })); }} />
          </div>
        ))}
      </div>
      {error && <p className="rounded-xl border border-[hsl(var(--p-red))]/40 bg-[hsl(var(--p-red))]/10 px-4 py-3 text-sm text-[hsl(var(--p-red))]">{error}</p>}
      {saved ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--p-line))] bg-[hsl(var(--p-surface))] py-3.5 text-[15px] font-700 text-[hsl(var(--p-text))]">
          <Check className="h-5 w-5 text-[hsl(var(--p-red))]" /> Trimis. Mulțumim!
        </div>
      ) : (
        <button onClick={submit} disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--p-red))] py-3.5 text-[15px] font-700 text-white transition active:scale-[0.99] disabled:opacity-60">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Trimite cifrele"}
        </button>
      )}
    </div>
  );
}
