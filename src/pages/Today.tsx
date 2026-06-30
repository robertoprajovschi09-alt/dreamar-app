import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Button, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useClients } from "@/lib/clients";
import { useContent } from "@/lib/content";
import { useCampaigns } from "@/lib/campaigns";
import { supabase } from "@/lib/supabase";
import { useFakeLoad } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { CalendarClock, CalendarPlus, ChevronRight, ClipboardCheck, MessageSquareWarning, Plus, Send, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const eurK = (n: number) => (n >= 1000 ? `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `€${Math.round(n)}`);
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

type Action = { id: string; icon: LucideIcon; text: string; to: string; tone: "danger" | "warning" | "primary" };
const TONE: Record<Action["tone"], string> = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/15 text-[hsl(var(--warning))]",
  primary: "bg-primary/10 text-primary",
};

export default function Today() {
  const navigate = useNavigate();
  const { openNewClient } = useUI();
  const { currentAgency, profile, agencyReady, live } = useWorkspace();
  const { clients, loading: cl } = useClients();
  const { posts, loading: pl } = useContent();
  const { campaigns } = useCampaigns();
  const fake = useFakeLoad();
  const [overdue, setOverdue] = useState(0);

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();
  const dateLabel = new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    if (!live || !supabase || !agencyReady || !currentAgency.id) { setOverdue(0); return; }
    let active = true;
    (async () => {
      const { count } = await supabase!.from("tasks").select("id", { count: "exact", head: true })
        .eq("agency_id", currentAgency.id).in("status", ["todo", "in_progress", "blocked"]).not("deadline", "is", null).lt("deadline", todayISO());
      if (active) setOverdue(count ?? 0);
    })();
    return () => { active = false; };
  }, [live, agencyReady, currentAgency.id]);

  const loading = live ? (!agencyReady || cl || pl) : fake;

  // ── Signals (all from data already loaded) ─────────────────────────────────
  const awaiting = posts.filter((p) => p.approvalStatus === "pending").length;
  const changes = posts.filter((p) => p.approvalStatus === "approved_with_changes" || p.approvalStatus === "rejected");
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const adSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const soon = addDaysISO(3);
  const ending = campaigns.filter((c) => c.status === "active" && c.endDate && c.endDate >= todayISO() && c.endDate <= soon).length;
  const overBudget = campaigns.filter((c) => c.budget > 0 && c.spend > c.budget).length;
  const noContent = clients.filter((c) => !posts.some((p) => p.clientName === c.name && p.status === "scheduled"));

  const actions: Action[] = [];
  if (changes.length) actions.push({ id: "changes", icon: MessageSquareWarning, tone: "danger", to: "/approvals", text: `${changes.length} ${changes.length === 1 ? "postare cere modificări" : "postări cer modificări"} — revizuiește și retrimite` });
  if (overdue) actions.push({ id: "overdue", icon: ClipboardCheck, tone: "danger", to: "/content?tab=board", text: `${overdue} ${overdue === 1 ? "sarcină întârziată" : "sarcini întârziate"}` });
  if (overBudget) actions.push({ id: "over", icon: Wallet, tone: "warning", to: "/campaigns", text: `${overBudget} ${overBudget === 1 ? "campanie a depășit bugetul" : "campanii au depășit bugetul"}` });
  if (ending) actions.push({ id: "ending", icon: CalendarClock, tone: "warning", to: "/campaigns", text: `${ending} ${ending === 1 ? "campanie se termină" : "campanii se termină"} în 3 zile` });
  if (noContent.length) actions.push({ id: "nocontent", icon: CalendarPlus, tone: "warning", to: "/content", text: `${noContent.length} ${noContent.length === 1 ? "client fără conținut programat" : "clienți fără conținut programat"} săptămâna asta` });
  if (awaiting) actions.push({ id: "await", icon: Send, tone: "primary", to: "/approvals", text: `${awaiting} ${awaiting === 1 ? "postare așteaptă" : "postări așteaptă"} decizia clientului` });

  // Clients needing action = no scheduled content OR a change requested.
  const changeClientNames = new Set(changes.map((p) => p.clientName));
  const needAction = clients
    .map((c) => ({ c, reason: !posts.some((p) => p.clientName === c.name && p.status === "scheduled") ? "Fără conținut programat" : changeClientNames.has(c.name) ? "A cerut modificări" : "" }))
    .filter((x) => x.reason)
    .slice(0, 6);

  if (loading) return <PageSkeleton variant="dashboard" />;

  const strip = [
    { label: "Clienți activi", value: String(clients.length), to: "/clients" },
    { label: "Programate săptămâna asta", value: String(scheduled), to: "/content" },
    { label: "Aprobări în așteptare", value: String(awaiting), to: "/approvals" },
    { label: "Cheltuieli ads", value: eurK(adSpend), to: "/campaigns" },
  ];

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}>
        <Button variant="primary" size="md" onClick={openNewClient}><Plus className="h-4 w-4" /> Client nou</Button>
      </PageHeader>

      {/* 1 — Focus de azi */}
      <Panel className="p-4 sm:p-5">
        <p className="mb-3 font-display text-base font-800">Focus de azi</p>
        {actions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success"><Sparkles className="h-6 w-6" /></span>
            <p className="text-sm font-700">Ești la zi</p>
            <p className="text-xs text-muted-foreground">Nimic urgent azi. Bun moment să planifici conținut.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <button key={a.id} onClick={() => navigate(a.to)} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:bg-muted/50">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONE[a.tone])}><a.icon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1 text-sm font-600">{a.text}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </Panel>

      {/* 2 — Clienți care cer acțiune */}
      {needAction.length > 0 && (
        <Panel className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-base font-800">Clienți care cer acțiune</p>
            <Link to="/clients" className="text-xs font-700 text-primary">Toți clienții</Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {needAction.map(({ c, reason }) => (
              <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-muted/50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-600">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{reason}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {/* 3 — Agenția ta */}
      <Panel className="p-4 sm:p-5">
        <p className="mb-3 font-display text-base font-800">Agenția ta</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {strip.map((s) => (
            <Link key={s.label} to={s.to} className="rounded-xl border border-border p-4 transition hover:bg-muted/50">
              <p className="font-display text-2xl font-800">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
