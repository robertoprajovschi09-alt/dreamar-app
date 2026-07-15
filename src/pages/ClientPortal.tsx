import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { fetchPortalMe, fetchPortalClips, whatsappLink, type PortalMe, type PortalClip, type PortalStatus } from "@/lib/portal";
import { CalendarDays, Clapperboard, Home, Loader2, LogOut, MessageCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Client portal — a world of its own, fully separate from the internal app.
 * Always dark (ignores the app theme), DR DREAM red as the only accent, mono
 * uppercase labels, mobile-first. Reads ONLY the whitelist views.
 */

type Tab = "acasa" | "clipuri" | "calendar" | "contact";

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
        ) : (
          <>
            {tab === "acasa" && <Overview clips={clips} />}
            {tab === "clipuri" && <Clips clips={clips} />}
            {tab === "calendar" && <CalendarList clips={clips} />}
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
            { id: "contact", label: "Contact", icon: MessageCircle },
          ] as { id: Tab; label: string; icon: typeof Home }[]).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
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
function Overview({ clips }: { clips: PortalClip[] }) {
  const today = todayISO();
  const thisMonth = monthKey(today);
  const delivered = clips.filter((c) => c.status === "Livrat" && c.postDate && monthKey(c.postDate) === thisMonth).length;
  const scheduled = clips.filter((c) => c.status === "Programat" && c.postDate && monthKey(c.postDate) === thisMonth).length;
  const everDelivered = clips.some((c) => c.status === "Livrat");
  const nextFilm = clips.map((c) => c.filmDate).filter((d): d is string => !!d && d >= today).sort()[0] ?? null;

  if (clips.length === 0) {
    return (
      <div className="space-y-5">
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
