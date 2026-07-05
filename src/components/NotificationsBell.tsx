import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useNotifications, type Notif } from "@/lib/notifications";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, CalendarClock, FileText, Target, type LucideIcon } from "lucide-react";

const META: Record<Notif["kind"], { icon: LucideIcon; cls: string }> = {
  money_overdue: { icon: AlertTriangle, cls: "text-danger bg-danger/12" },
  money_invoice: { icon: FileText, cls: "text-[hsl(var(--warning))] bg-warning/15" },
  evening_plan: { icon: CalendarClock, cls: "text-primary bg-primary/12" },
  kill_unlock: { icon: Target, cls: "text-success bg-success/12" },
};

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "acum";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}z`;
}

export function NotificationsBell() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { notifications, unresolvedCount, markCollected, onPanelOpen, openTomorrow } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Desktop dropdown closes on outside click.
  useEffect(() => {
    if (!open || isMobile) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, isMobile]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) onPanelOpen(); // mark freshly-unlocked goals as seen
      return next;
    });
  }

  function act(n: Notif) {
    setOpen(false);
    if (n.kind === "evening_plan") { openTomorrow(); return; }
    if (n.focus) { navigate(`/money?focus=${n.focus}`); return; }
    if (n.to) navigate(n.to);
  }

  const list = (
    <div className="max-h-[65vh] overflow-y-auto overscroll-contain">
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Bell className="h-5 w-5" /></span>
          <p className="text-sm font-600">Nicio notificare</p>
          <p className="text-xs text-muted-foreground">Aici apar alertele de bani, planificarea de seară și obiectivele deblocate.</p>
        </div>
      ) : notifications.map((n) => {
        const M = META[n.kind];
        return (
          <div key={n.id} className={cn("flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-0", !n.resolved && "bg-primary/[0.03]")}>
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", M.cls)}><M.icon className="h-4 w-4" /></span>
            <button onClick={() => act(n)} className="min-w-0 flex-1 text-left">
              <p className="text-sm font-700">{n.title}</p>
              {n.desc && <p className={cn("truncate text-xs", n.kind === "money_overdue" ? "font-700 text-danger" : "text-muted-foreground")}>{n.desc}</p>}
              {n.collectionId && (
                <button onClick={(e) => { e.stopPropagation(); markCollected(n.collectionId!); }}
                  className="mt-1.5 rounded-lg bg-success/15 px-2.5 py-1 text-xs font-700 text-success transition hover:bg-success/25">Marchează încasat</button>
              )}
            </button>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">{timeAgo(n.ts)}</span>
              {!n.resolved && <span className="h-2 w-2 rounded-full bg-primary" />}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-label="Notificări"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground ring-focus">
        <Bell className="h-[18px] w-[18px]" />
        {unresolvedCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-0.5 text-[9px] font-800 text-white ring-2 ring-card">{unresolvedCount > 9 ? "9+" : unresolvedCount}</span>
        )}
      </button>

      {open && !isMobile && (
        <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[92vw] panel animate-scale-in overflow-hidden">
          <div className="border-b border-border px-4 py-3"><p className="font-display text-sm font-800">Notificări</p></div>
          {list}
        </div>
      )}

      {isMobile && createPortal(
        <>
          <button aria-label="Închide" onClick={() => setOpen(false)}
            className={cn("fixed inset-0 z-[70] bg-foreground/40 backdrop-blur-sm transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} />
          <div role="dialog" aria-modal="true" aria-label="Notificări"
            className={cn("fixed inset-x-0 bottom-0 z-[71] max-h-[85dvh] overflow-hidden rounded-t-3xl border-t border-border bg-card transition-transform duration-300", open ? "translate-y-0" : "translate-y-full")}>
            <div className="mx-auto max-w-[560px] pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-border" />
              <div className="px-5 py-2"><p className="font-display text-base font-800">Notificări</p></div>
              {list}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
