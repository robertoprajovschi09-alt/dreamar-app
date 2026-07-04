import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Button, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useWeekOps } from "@/lib/weekops";
import { cn } from "@/lib/utils";
import {
  CalendarPlus, CheckCircle2, FileText, Plus, Send, Sparkles, type LucideIcon,
} from "lucide-react";

/*
 * The Weekly Operating System: a stack of queues that drain to zero. Every row
 * is one client/item and one action. No alerts, no ads, no approvals.
 */

const fmt = (isoDate: string) => new Date(isoDate + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "long" });
const MAX_ROWS = 6;

export default function Week() {
  const navigate = useNavigate();
  const { openNewClient } = useUI();
  const { profile } = useWorkspace();
  const ops = useWeekOps();

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();

  const goCalendar = (clientName: string) => navigate(`/content?tab=calendar&client=${encodeURIComponent(clientName)}`);

  if (ops.loading) return <PageSkeleton variant="dashboard" />;

  const allClear = ops.total === 0;

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={`Săptămâna ${ops.weekNumber} · ${fmt(ops.weekStart)} – ${fmt(ops.weekEnd)}`}>
        <Button variant="primary" size="md" onClick={openNewClient}><Plus className="h-4 w-4" /> Client nou</Button>
      </PageHeader>

      {allClear ? (
        <Panel className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><Sparkles className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Săptămâna e sub control</p>
          <p className="max-w-sm text-sm text-muted-foreground">Toți clienții au conținut planificat pentru săptămâna viitoare și nu e niciun raport de trimis.</p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* 1 — Next-week coverage */}
          <Queue icon={CalendarPlus} tone="text-[hsl(var(--warning))]" title="Acoperire — săptămâna viitoare" count={ops.coverage.length} emptyText={`Toți clienții au cel puțin ${3} postări programate.`}>
            {ops.coverage.slice(0, MAX_ROWS).map((r) => (
              <Row key={r.clientId} dot={r.count === 0 ? "bg-danger" : "bg-[hsl(var(--warning))]"} text={r.clientName}
                right={<span className={cn("text-xs font-700", r.count === 0 ? "text-danger" : "text-[hsl(var(--warning))]")}>{r.count} / {r.target} postări</span>}
                action={<Button size="sm" variant="outline" onClick={() => goCalendar(r.clientName)}>Planifică</Button>} />
            ))}
            <More total={ops.coverage.length} />
          </Queue>

          {/* 2 — Reports due (appears near month end) */}
          {ops.reportsDue.length > 0 && (
            <Queue icon={FileText} tone="text-primary" title="Rapoarte de trimis" count={ops.reportsDue.length} emptyText="">
              {ops.reportsDue.slice(0, MAX_ROWS).map((r) => (
                <Row key={r.clientId} dot="bg-primary" text={r.clientName}
                  action={<Button size="sm" variant="primary" onClick={() => navigate(`/clients/${r.clientId}?tab=Raport`)}><Send className="h-3.5 w-3.5" /> Trimite raportul</Button>} />
              ))}
              <More total={ops.reportsDue.length} />
            </Queue>
          )}
        </div>
      )}
    </>
  );
}

/* A queue drains to zero — when empty it collapses to a single ✓ line. */
function Queue({ icon: Icon, tone, title, count, emptyText, children }: {
  icon: LucideIcon; tone: string; title: string; count: number; emptyText: string; children?: ReactNode;
}) {
  if (count === 0) {
    if (!emptyText) return null;
    return (
      <Panel className="flex items-center gap-2.5 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span className="text-sm font-600 text-muted-foreground">{title}</span>
        <span className="hidden text-xs text-muted-foreground/70 sm:inline">— {emptyText}</span>
      </Panel>
    );
  }
  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
        <p className="font-display text-sm font-800">{title}</p>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-700 text-muted-foreground">{count}</span>
      </div>
      {children}
    </Panel>
  );
}

function Row({ dot, text, sub, right, action }: { dot: string; text: string; sub?: string; right?: ReactNode; action: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-600">{text}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {right}
      <span className="shrink-0">{action}</span>
    </div>
  );
}

function More({ total }: { total: number }) {
  if (total <= MAX_ROWS) return null;
  return <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">încă {total - MAX_ROWS}…</p>;
}
