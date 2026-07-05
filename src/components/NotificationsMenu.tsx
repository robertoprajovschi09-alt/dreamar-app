import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { Bell, CheckCheck, FileText, Info, MessageCircle, ShieldAlert, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = { id: string | number; icon: LucideIcon; tone: string; title: string; desc: string; time: string; to: string; read?: boolean };

const TONE: Record<string, string> = {
  info: "text-info bg-info/12",
  success: "text-success bg-success/12",
  warning: "text-[hsl(var(--warning))] bg-warning/15",
  danger: "text-danger bg-danger/12",
};
const SEV_ICON: Record<string, LucideIcon> = { info: Info, success: FileText, warning: ShieldAlert, danger: TrendingDown };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "acum";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}z`;
}

// Demo-only notifications (live mode reads the real `notifications` table).
const sampleNotes: Note[] = [
  { id: 3, icon: MessageCircle, tone: TONE.info, title: "Comentariu cu intenție de cumpărare", desc: "Verde Bistro - solicitare de rezervare", time: "4h", to: "/clients/verde" },
  { id: 4, icon: FileText, tone: TONE.success, title: "Raport gata", desc: "Raportul IronPeak pe mai a fost generat", time: "1z", to: "/reports" },
];

export function NotificationsMenu() {
  const navigate = useNavigate();
  const { live } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(live ? [] : sampleNotes);
  const [readIds, setReadIds] = useState<Set<string | number>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Live: load real notifications for this user/agency.
  useEffect(() => {
    if (!live || !supabase) return;
    let active = true;
    (async () => {
      const { data } = await supabase!
        .from("notifications")
        .select("id, title, description, severity, href, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNotes((data ?? []).map((n: any) => ({
        id: n.id, icon: SEV_ICON[n.severity] ?? Bell, tone: TONE[n.severity] ?? TONE.info,
        title: n.title, desc: n.description ?? "", time: timeAgo(n.created_at), to: n.href ?? "/dashboard", read: !!n.read_at,
      })));
    })();
    return () => { active = false; };
  }, [live]);

  const isRead = (n: Note) => readIds.has(n.id) || !!n.read;
  const unread = notes.filter((n) => !isRead(n)).length;

  function markRead(id: string | number) {
    setReadIds((p) => new Set(p).add(id));
    if (live && supabase && typeof id === "string") void supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }
  function markAll() {
    setReadIds(new Set(notes.map((n) => n.id)));
    if (live && supabase) {
      const ids = notes.filter((n) => !n.read && typeof n.id === "string").map((n) => n.id) as string[];
      if (ids.length) void supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificări"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground ring-focus"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-danger px-0.5 text-[8px] font-800 text-white ring-2 ring-card">{unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] max-w-[92vw] animate-scale-in panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-display text-sm font-800">Notificări</p>
            {notes.length > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-700 text-primary">
                <CheckCheck className="h-3.5 w-3.5" /> Marchează toate ca citite
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Bell className="h-5 w-5" /></span>
                <p className="text-sm font-600">Nicio notificare</p>
                <p className="text-xs text-muted-foreground">Te anunțăm aici când apare ceva important.</p>
              </div>
            ) : (
              notes.map((n) => {
                const read = isRead(n);
                return (
                  <button
                    key={n.id}
                    onClick={() => { markRead(n.id); setOpen(false); navigate(n.to); }}
                    className={cn("flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition last:border-0 hover:bg-muted/50", !read && "bg-primary/[0.03]")}
                  >
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", n.tone)}>
                      <n.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-700">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">{n.time}</span>
                      {!read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {notes.length > 0 && (
            <button onClick={() => { markAll(); setOpen(false); }} className="w-full border-t border-border py-2.5 text-center text-xs font-700 text-primary hover:bg-muted/50">Marchează toate ca citite și închide</button>
          )}
        </div>
      )}
    </div>
  );
}
