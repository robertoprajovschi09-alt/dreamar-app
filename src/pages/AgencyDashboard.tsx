import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { SectionCard, Badge, Button, PageHeader, Panel } from "@/components/ui";
import { AreaTrend, Bars, Donut, RadialScore } from "@/components/charts";
import {
  agencyKpis,
  alerts,
  bestContent,
  clients as sampleClients,
  growthTrend,
  platformMix,
  tasks as sampleTasks,
  trafficVeracity,
} from "@/data/sample";
import { compact, downloadCsv } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useUI } from "@/lib/ui-context";
import { useWorkspace } from "@/lib/workspace";
import { useClients } from "@/lib/clients";
import { useContent } from "@/lib/content";
import { useLibrary } from "@/lib/library";
import { useDateRange } from "@/lib/daterange";
import { useToast } from "@/lib/toast";
import { useFakeLoad } from "@/lib/hooks";
import { PageSkeleton } from "@/components/Skeleton";
import {
  AlertTriangle,
  CalendarCheck2,
  ClipboardCheck,
  Download,
  Flame,
  Play,
  Plus,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const kpiIcons = [Users, CalendarCheck2, ClipboardCheck, Wallet] as const;
const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
const PIPE_COLORS = ["#4F46E5", "#1fae7a", "#3b82f6", "#f59e0b"];
const fmtRevenue = (v: number) => (v >= 1000 ? `€${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `€${Math.round(v)}`);

export default function AgencyDashboard() {
  const { openNewClient } = useUI();
  const { currentAgency, profile, agencyReady } = useWorkspace();
  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara"; })();
  const { current } = useDateRange();
  const { push } = useToast();
  const { clients, live, loading: clientsLoading } = useClients();
  const { posts, loading: postsLoading } = useContent();
  const { videos, loading: videosLoading } = useLibrary();
  const fakeLoading = useFakeLoad();
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const agencyId = currentAgency.id;
  const [trend, setTrend] = useState<{ label: string; leads: number; conversions: number }[]>([]);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [dueTasks, setDueTasks] = useState<{ id: string; title: string; client: string; deadline: string; overdue: boolean }[]>([]);

  // Live: cross-client results trend + this-month revenue (from business_impact_entries,
  // deduped per client/month with the client's self-report preferred) and due/overdue tasks.
  useEffect(() => {
    if (!live || !supabase || !agencyReady || !agencyId) return;
    let active = true;
    (async () => {
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const monthKeys: { key: string; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthKeys.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, label: d.toLocaleDateString("ro-RO", { month: "short" }) });
      }
      const [bi, tk] = await Promise.all([
        supabase!.from("business_impact_entries").select("client_id, period_month, source, calls_received, relevant_dms, bookings, appointments, orders, sales, viewings, contracts, revenue_estimate").eq("agency_id", agencyId),
        supabase!.from("tasks").select("id, title, deadline, status, client:clients(name)").eq("agency_id", agencyId).in("status", ["todo", "in_progress", "blocked"]).not("deadline", "is", null).lte("deadline", todayISO).order("deadline").limit(6),
      ]);
      if (!active) return;
      // dedupe per client+month — client self-report wins over agency entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byCM = new Map<string, any>();
      for (const r of bi.data ?? []) {
        const k = `${r.client_id}|${r.period_month}`;
        const ex = byCM.get(k);
        if (!ex || r.source === "client") byCM.set(k, r);
      }
      const agg: Record<string, { leads: number; conversions: number; revenue: number }> = {};
      for (const r of byCM.values()) {
        const m = String(r.period_month).slice(0, 10);
        const a = agg[m] ?? { leads: 0, conversions: 0, revenue: 0 };
        a.leads += (r.calls_received ?? 0) + (r.relevant_dms ?? 0);
        a.conversions += (r.bookings ?? 0) + (r.appointments ?? 0) + (r.orders ?? 0) + (r.sales ?? 0) + (r.viewings ?? 0) + (r.contracts ?? 0);
        a.revenue += Number(r.revenue_estimate ?? 0);
        agg[m] = a;
      }
      setTrend(monthKeys.map((mk) => ({ label: mk.label, leads: agg[mk.key]?.leads ?? 0, conversions: agg[mk.key]?.conversions ?? 0 })));
      setMonthRevenue(agg[monthKeys[monthKeys.length - 1].key]?.revenue ?? 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDueTasks((tk.data ?? []).map((t: any) => ({ id: t.id, title: t.title, client: t.client?.name ?? "", deadline: t.deadline, overdue: String(t.deadline) < todayISO })));
    })();
    return () => { active = false; };
  }, [live, agencyReady, agencyId]);

  async function markTaskDone(id: string, title: string) {
    setDueTasks((p) => p.filter((t) => t.id !== id));
    if (supabase) {
      const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
      if (error) { push({ tone: "danger", title: "Nu am putut actualiza sarcina", description: error.message }); return; }
    }
    push({ tone: "success", title: "Sarcină finalizată", description: title });
  }

  // Wait for the agency AND its data providers so KPIs don't flash zeros first.
  const loading = live ? (!agencyReady || clientsLoading || postsLoading || videosLoading) : fakeLoading;

  // ---- Live-derived figures (fall back to the sample data in demo mode) ----
  const scheduledThisWeek = posts.filter((p) => p.status === "scheduled").length;
  const pendingApprovals = posts.filter((p) => p.status === "approval").length;
  const liveKpis = [
    { label: "Clienți activi", value: String(clients.length), sub: clients.length ? "în spațiul tău de lucru" : "adaugă primul tău client", tone: "primary" },
    { label: "Programate săptămâna aceasta", value: String(scheduledThisWeek), sub: "postări în coadă", tone: "info" },
    { label: "Aprobări în așteptare", value: String(pendingApprovals), sub: "în așteptarea clientului", tone: "warning" },
    { label: "Venituri luna aceasta", value: fmtRevenue(monthRevenue), sub: "din toți clienții", tone: "success" },
  ];
  const kpis = live ? liveKpis : agencyKpis;

  // Live charts derived from the loaded content posts.
  const livePlatformMix = PLATFORMS.map((p) => ({ label: p, value: posts.filter((x) => x.platform === p).length })).filter((x) => x.value > 0);
  const livePipeline = [
    { name: "Planificare", value: posts.filter((p) => ["idea", "script"].includes(p.status)).length },
    { name: "Producție", value: posts.filter((p) => ["filming", "editing"].includes(p.status)).length },
    { name: "În revizuire", value: posts.filter((p) => p.status === "approval").length },
    { name: "Gata și live", value: posts.filter((p) => ["approved", "scheduled", "published", "analyzed"].includes(p.status)).length },
  ].filter((x) => x.value > 0);
  const hasTrend = trend.some((t) => t.leads || t.conversions);

  function exportDashboard() {
    const rows: (string | number)[][] = [
      ...kpis.map((k) => [k.label, k.value]),
      ...(live ? livePlatformMix.map((p) => [`Postări · ${p.label}`, p.value]) : []),
      ...(live ? livePipeline.map((s) => [`Pipeline · ${s.name}`, s.value]) : []),
      ...best.map((c, i) => [`Conținut de top #${i + 1}`, `${c.title} (${c.client}) — ${compact(c.views)} vizualizări`]),
    ];
    downloadCsv(`${currentAgency.name.replace(/\s+/g, "-").toLowerCase()}-dashboard-${new Date().toISOString().slice(0, 10)}.csv`, ["Metrică", "Valoare"], rows);
    push({ tone: "success", title: "Tablou de bord exportat", description: "Rezumat salvat ca CSV" });
  }

  const liveBest = [...videos].sort((a, b) => b.views - a.views).slice(0, 5).map((v) => ({ title: v.hook, client: v.client, platform: v.platform, views: v.views, eng: v.aiScore }));
  const best = live ? liveBest : bestContent;

  const clientList = live ? clients : sampleClients;
  const atRisk = clientList.filter((c) => c.risk !== "low").sort((a, b) => a.health - b.health);
  const riskCount = (r: string) => clientList.filter((c) => c.risk === r).length;
  const avgHealth = clientList.length ? Math.round(clientList.reduce((s, c) => s + c.health, 0) / clientList.length) : 0;
  // Live clients have no health/risk yet (scoring function not wired) — don't claim a false all-clear.
  const healthUnscored = live && clientList.length > 0 && clientList.every((c) => c.health === 0 && c.risk === "low");

  const liveAlerts = clients
    .filter((c) => !posts.some((p) => p.clientName === c.name && p.status === "scheduled"))
    .slice(0, 3)
    .map((c) => ({ id: c.id, tone: "warning" as const, client: c.name, text: "Nicio postare programată — planifică conținutul acestei săptămâni.", time: "acum" }));
  const alertList = live ? liveAlerts : alerts;

  const sampleOverdue = sampleTasks.filter((t) => t.status === "overdue" || t.due === "Today");
  const dueList = live
    ? dueTasks.map((t) => ({ id: t.id, title: t.title, client: t.client, badge: t.overdue ? "Întârziat" : "Astăzi", danger: t.overdue }))
    : sampleOverdue.map((t) => ({ id: t.id, title: t.title, client: t.client, badge: t.due, danger: t.status === "overdue" }));

  // The growth chart shows monthly samples; the global range narrows them.
  const sliceMap: Record<string, number> = { today: 1, "7d": 2, "30d": 3, month: 6, quarter: 4, ytd: 6 };
  const months = sliceMap[current.id] ?? growthTrend.length;
  const visibleGrowth = growthTrend.slice(-months);
  const visiblePlatformMix = platformMix.slice(-months);
  const sampleBadge = live ? <Badge tone="neutral">Ilustrativ</Badge> : null;

  if (loading) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName} 👋`} subtitle={`Iată ce se întâmplă în ${currentAgency.name} · ${current.range}`}>
        <Button variant="outline" size="md" onClick={exportDashboard}>
          <Download className="h-4 w-4" /> Exportă
        </Button>
        <Button variant="primary" size="md" onClick={openNewClient}>
          <Plus className="h-4 w-4" /> Client nou
        </Button>
      </PageHeader>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <StatCard key={k.label} {...(k as any)} icon={kpiIcons[i]} tone={k.tone as any} />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title={live ? "Lead-uri și conversii" : "Engagement și creștere"}
            subtitle={live ? "Raportate din toți clienții · ultimele 6 luni" : `Urmăritori, reach și impact în afacere din toți clienții · ${current.label}`}
            action={
              live ? (
                <div className="flex items-center gap-4 text-xs">
                  <Legend color="hsl(var(--primary))" label="Lead-uri" />
                  <Legend color="hsl(36 96% 56%)" label="Conversii" />
                </div>
              ) : (
                <div className="flex items-center gap-4 text-xs">
                  {sampleBadge}
                  <Legend color="hsl(var(--primary))" label="Urmăritori (K)" />
                  <Legend color="hsl(36 96% 56%)" label="Reach (K)" />
                  <Legend color="hsl(18 90% 60%)" label="Impact" />
                </div>
              )
            }
          >
            {live ? (
              hasTrend ? (
                <AreaTrend data={trend} keys={[{ key: "leads", name: "Lead-uri" }, { key: "conversions", name: "Conversii" }]} height={250} />
              ) : (
                <div className="grid h-[250px] place-items-center px-6 text-center text-sm text-muted-foreground">
                  Graficul cu rezultatele tale se completează pe măsură ce intră cifrele lunare — clienții le raportează din portalul lor în fiecare lună.
                </div>
              )
            ) : (
              <AreaTrend data={visibleGrowth} keys={[{ key: "followers", name: "Urmăritori (K)" }, { key: "reach", name: "Reach (K)" }, { key: "impact", name: "Impact" }]} height={250} />
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SectionCard title="Conținut cu cele mai bune rezultate" icon={Flame} action={<Link to="/videos" className="text-xs font-700 text-primary">Vezi tot</Link>}>
              {best.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Adaugă videoclipuri pentru a vedea cele mai bune rezultate.</div>
              ) : (
                <div className="space-y-1">
                  {best.map((c, i) => (
                    <div key={c.title + i} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted/50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-800 text-primary">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-600">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.client}{c.platform ? ` · ${c.platform}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-700">{compact(c.views)}</p>
                        <p className="text-[11px] text-success">{live ? `AI ${c.eng}` : `${c.eng}% eng.`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Mix de platforme" subtitle={live ? "Postări pe platformă" : `Postări publicate · ${current.label}`} icon={Play} action={live ? null : sampleBadge}>
              {live ? (
                livePlatformMix.length ? (
                  <Bars data={livePlatformMix} height={196} keys={[{ key: "value", name: "Postări" }]} />
                ) : (
                  <div className="grid h-[196px] place-items-center px-4 text-center text-sm text-muted-foreground">Încă nicio postare — planifică conținut în calendar.</div>
                )
              ) : (
                <Bars data={visiblePlatformMix} height={196} keys={[{ key: "instagram", name: "Instagram" }, { key: "tiktok", name: "TikTok" }, { key: "facebook", name: "Facebook" }]} />
              )}
            </SectionCard>
          </div>
        </div>

        {/* Right: health + alerts */}
        <div className="space-y-4">
          <SectionCard title="Sănătatea portofoliului" subtitle={live ? `Pe ${clientList.length} client${clientList.length === 1 ? "" : "i"}` : "Ponderat de AI pe 8 clienți"} icon={Sparkles}>
            {live && avgHealth === 0 ? (
              <div className="grid h-[180px] place-items-center px-4 text-center text-sm text-muted-foreground">Scorurile de sănătate apar după ce AI analizează o lună întreagă de activitate.</div>
            ) : (
              <RadialScore value={live ? avgHealth : 74} label="sănătate medie" height={180} />
            )}
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <RiskPill label="Scăzut" count={riskCount("low")} tone="success" />
              <RiskPill label="Mediu" count={riskCount("medium")} tone="warning" />
              <RiskPill label="Ridicat" count={riskCount("high")} tone="danger" />
            </div>
          </SectionCard>

          <SectionCard title="Alerte AI" icon={AlertTriangle} action={<Badge tone={alertList.length ? "danger" : "success"} dot>{alertList.length ? `${alertList.length} noi` : "Totul în regulă"}</Badge>}>
            {alertList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nicio alertă momentan ✨</p>
            ) : (
              <div className="space-y-3">
                {alertList.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : "bg-info"}`} />
                    <div>
                      <p className="text-sm leading-snug"><span className="font-700">{a.client}</span> — {a.text}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-1" title={live ? "Pipeline de conținut" : "Calitatea lead-urilor"} subtitle={live ? "Postări după etapă" : "Luna aceasta"} icon={ClipboardCheck} action={live ? null : sampleBadge}>
          {live ? (
            livePipeline.length ? (
              <>
                <Donut data={livePipeline} centerValue={String(posts.length)} centerLabel="postări" height={180} />
                <div className="mt-2 space-y-2">
                  {livePipeline.map((t, i) => (
                    <div key={t.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIPE_COLORS[i % PIPE_COLORS.length] }} />
                      <span className="text-muted-foreground">{t.name}</span>
                      <span className="ml-auto font-700">{t.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid h-[200px] place-items-center px-4 text-center text-sm text-muted-foreground">Încă niciun conținut — creează postări în Calendarul de conținut.</div>
            )
          ) : (
            <>
              <Donut data={trafficVeracity} centerValue="50%" centerLabel="calificate" height={180} />
              <div className="mt-2 space-y-2">
                {trafficVeracity.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#4F46E5", "#f5a524", "#f5803e"][i] }} />
                    <span className="text-muted-foreground">{t.name}</span>
                    <span className="ml-auto font-700">{t.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard className="lg:col-span-1" title="Clienți cu rezultate slabe" subtitle="Necesită atenție" icon={AlertTriangle} action={<Link to="/clients" className="text-xs font-700 text-primary">Toți clienții</Link>}>
          {healthUnscored ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Scorul de sănătate al clienților apare după o lună întreagă de activitate.</p>
          ) : atRisk.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Niciun client nu necesită atenție — bravo ✨</p>
          ) : (
            <div className="space-y-2">
              {atRisk.map((c) => (
                <Link to={`/clients/${c.id}`} key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted/50">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{c.name.slice(0, 2)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-600">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.city}</p>
                  </div>
                  <Badge tone={c.risk === "high" ? "danger" : "warning"}>{c.health}</Badge>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard className="lg:col-span-1" title="Scadente astăzi și întârziate" icon={ClipboardCheck} action={<Link to="/tasks" className="text-xs font-700 text-primary">Sarcini</Link>}>
          <div className="space-y-2">
            {dueList.map((t) => {
              const done = doneTasks.has(t.id);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => {
                      if (live) { void markTaskDone(t.id, t.title); return; }
                      setDoneTasks((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
                      if (!done) push({ tone: "success", title: "Sarcină finalizată", description: t.title });
                    }}
                    className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-600 ${done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.client}</p>
                  </div>
                  <Badge tone={t.danger ? "danger" : "warning"}>{t.badge}</Badge>
                </div>
              );
            })}
            {dueList.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ești la zi ✨</p>}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function RiskPill({ label, count, tone }: { label: string; count: number; tone: "success" | "warning" | "danger" }) {
  const cls = { success: "text-success bg-success/10", warning: "text-[hsl(var(--warning))] bg-warning/15", danger: "text-danger bg-danger/10" }[tone];
  return (
    <div className={`rounded-lg py-2 ${cls}`}>
      <p className="font-display text-lg font-800">{count}</p>
      <p className="text-[11px] font-600">{label}</p>
    </div>
  );
}
