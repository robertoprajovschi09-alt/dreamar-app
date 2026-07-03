import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Button, Panel, Badge } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { useWeekOps } from "@/lib/weekops";
import { cn } from "@/lib/utils";
import {
  CalendarPlus, Check, CheckCircle2, ClipboardCheck, FileText, Loader2, Plus, Send, Sparkles, TrendingUp, UserRoundSearch, Wallet, type LucideIcon,
} from "lucide-react";

/*
 * The Weekly Operating System: a stack of queues that drain to zero. Every row
 * is one client/item, its deficit, and one action. No decorative KPIs.
 */

const fmt = (isoDate: string) => new Date(isoDate + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "long" });
const MAX_ROWS = 6;

export default function Week() {
  const navigate = useNavigate();
  const { openNewClient } = useUI();
  const { profile } = useWorkspace();
  const { push } = useToast();
  const ops = useWeekOps();
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();

  async function run(id: string, fn: () => Promise<{ error?: string }>, ok: string) {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setBusy(id);
    try {
      const res = await fn();
      if (res.error) push({ tone: "danger", title: "Nu a mers", description: res.error });
      else push({ tone: "success", title: ok });
    } finally {
      inFlight.current.delete(id);
      setBusy((b) => (b === id ? null : b));
    }
  }

  const goCalendar = (clientName: string) => navigate(`/content?tab=calendar&client=${encodeURIComponent(clientName)}`);

  if (ops.loading) return <PageSkeleton variant="dashboard" />;

  const allClear = ops.total === 0 && ops.risks.length === 0;

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={`Săptămâna ${ops.weekNumber} · ${fmt(ops.weekStart)} – ${fmt(ops.weekEnd)}`}>
        <span className={cn("rounded-full px-3.5 py-1.5 text-sm font-700", ops.total ? "bg-warning/15 text-[hsl(var(--warning))]" : "bg-success/10 text-success")}>
          {ops.total ? `${ops.total} de rezolvat` : "Sub control"}
        </span>
        <Button variant="primary" size="md" onClick={openNewClient}><Plus className="h-4 w-4" /> Client nou</Button>
      </PageHeader>

      {allClear ? (
        <Panel className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><Sparkles className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Săptămâna e sub control</p>
          <p className="max-w-sm text-sm text-muted-foreground">Nimic nu blochează publicarea, toți clienții au conținut planificat și nicio campanie nu cere atenție.</p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* 1 — Publishing blockers */}
          <Queue icon={Send} tone="text-danger" title="Deblochează publicarea" count={ops.blockers.length} emptyText="Nimic nu blochează publicarea.">
            {ops.blockers.slice(0, MAX_ROWS).map((b) => (
              <Row key={b.id} dot={b.kind === "changes" ? "bg-danger" : b.kind === "ready" ? "bg-primary" : "bg-[hsl(var(--warning))]"}
                text={b.kind === "changes" ? `${b.post.clientName} a cerut o schimbare` : b.kind === "ready" ? `„${b.post.title}” e gata de trimis` : `${b.post.clientName} nu a răspuns de ${b.ageDays} ${b.ageDays === 1 ? "zi" : "zile"}`}
                sub={b.kind === "ready" ? b.post.clientName : b.post.title}
                action={b.kind === "changes"
                  ? <Button size="sm" variant="outline" onClick={() => goCalendar(b.post.clientName)}>Revizuiește</Button>
                  : b.kind === "ready"
                    ? <Button size="sm" variant="primary" disabled={busy === b.id} onClick={() => run(b.id, () => ops.requestApproval(b.post), "Trimis clientului")}>{busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Trimite</Button>
                    : <Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => run(b.id, () => ops.nudge(b.approvalId), "Reamintire trimisă")}>{busy === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Retrimite</Button>}
              />
            ))}
            <More total={ops.blockers.length} />
          </Queue>

          {/* 2 — Next-week coverage */}
          <Queue icon={CalendarPlus} tone="text-[hsl(var(--warning))]" title="Acoperire — săptămâna viitoare" count={ops.coverage.length} emptyText={`Toți clienții au cel puțin ${3} postări programate.`}>
            {ops.coverage.slice(0, MAX_ROWS).map((r) => (
              <Row key={r.clientId} dot={r.count === 0 ? "bg-danger" : "bg-[hsl(var(--warning))]"} text={r.clientName}
                right={<span className={cn("text-xs font-700", r.count === 0 ? "text-danger" : "text-[hsl(var(--warning))]")}>{r.count} / {r.target} postări</span>}
                action={<Button size="sm" variant="outline" onClick={() => goCalendar(r.clientName)}>Planifică</Button>} />
            ))}
            <More total={ops.coverage.length} />
          </Queue>

          {/* 3 — Campaigns */}
          <Queue icon={Wallet} tone="text-[hsl(var(--warning))]" title="Campanii" count={ops.attn.length} emptyText="Nicio campanie nu cere atenție.">
            {ops.attn.slice(0, MAX_ROWS).map((a) => (
              <Row key={a.id} dot={a.kind === "over" ? "bg-danger" : "bg-[hsl(var(--warning))]"} text={`${a.name} — ${a.detail}`} sub={a.clientName}
                action={<Button size="sm" variant="outline" onClick={() => navigate("/campaigns")}>{a.kind === "stale" ? "Actualizează" : "Decide"}</Button>} />
            ))}
            <More total={ops.attn.length} />
          </Queue>

          {/* 4 — Missing impact (appears after the grace window) */}
          {ops.impactGaps.length > 0 && (
            <Queue icon={TrendingUp} tone="text-[hsl(var(--warning))]" title="Impact necompletat luna aceasta" count={ops.impactGaps.length} emptyText="">
              {ops.impactGaps.slice(0, MAX_ROWS).map((g) => (
                <Row key={g.clientId} dot="bg-[hsl(var(--warning))]" text={g.clientName}
                  action={<Button size="sm" variant="outline" onClick={() => navigate(`/impact?client=${g.clientId}`)}>Completează</Button>} />
              ))}
              <More total={ops.impactGaps.length} />
            </Queue>
          )}

          {/* 5 — Reports due (appears near month end) */}
          {ops.reportsDue.length > 0 && (
            <Queue icon={FileText} tone="text-primary" title="Rapoarte de trimis" count={ops.reportsDue.length} emptyText="">
              {ops.reportsDue.slice(0, MAX_ROWS).map((r) => (
                <Row key={r.clientId} dot="bg-primary" text={r.clientName}
                  action={<Button size="sm" variant="primary" onClick={() => navigate(`/clients/${r.clientId}?tab=Raport`)}><Send className="h-3.5 w-3.5" /> Trimite raportul</Button>} />
              ))}
              <More total={ops.reportsDue.length} />
            </Queue>
          )}

          {/* 6 — Follow-ups */}
          <Queue icon={ClipboardCheck} tone="text-muted-foreground" title="Follow-up-uri" count={ops.followups.length} emptyText="Nicio sarcină scadentă și niciun client lăsat în urmă.">
            {ops.followups.slice(0, MAX_ROWS).map((f) =>
              f.kind === "task" ? (
                <div key={f.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
                  <button
                    aria-label={`Finalizează ${f.title}`}
                    disabled={busy === f.id}
                    onClick={() => run(f.id, () => ops.completeTask(f.id), "Sarcină finalizată")}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border text-transparent transition hover:border-success hover:text-success"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-600">{f.title}</span>
                    {f.clientName && <span className="block truncate text-xs text-muted-foreground">{f.clientName}</span>}
                  </span>
                  <Badge tone={f.overdue ? "danger" : "warning"}>{f.overdue ? "Întârziat" : fmt(f.deadline)}</Badge>
                </div>
              ) : (
                <Row key={f.id} dot="bg-muted-foreground/50" text={`${f.clientName} — fără activitate de ${f.days} zile`}
                  action={<Button size="sm" variant="outline" disabled={busy === f.id} onClick={() => run(f.id, () => ops.createCheckin(f.clientId, f.clientName), "Check-in programat")}>{busy === f.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Check-in</Button>} />
              ),
            )}
            <More total={ops.followups.length} />
          </Queue>

          {/* 7 — At-risk clients */}
          {ops.risks.length > 0 && (
            <Queue icon={UserRoundSearch} tone="text-danger" title="Clienți în risc" count={ops.risks.length} emptyText="">
              {ops.risks.slice(0, MAX_ROWS).map((r) => (
                <div key={r.clientId} className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5 sm:flex-nowrap sm:gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                  <button onClick={() => navigate(`/clients/${r.clientId}`)} className="truncate text-left text-sm font-700 hover:text-primary">{r.clientName}</button>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-600 text-danger">{reason}</span>
                    ))}
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" disabled={busy === `rk-${r.clientId}`}
                    onClick={() => run(`rk-${r.clientId}`, () => ops.createCheckin(r.clientId, r.clientName), "Check-in programat")}>
                    {busy === `rk-${r.clientId}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Check-in
                  </Button>
                </div>
              ))}
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
