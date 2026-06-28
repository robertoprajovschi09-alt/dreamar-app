import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Button, Badge, Panel, Select } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { StatCard } from "@/components/StatCard";
import { AreaTrend } from "@/components/charts";
import { PageSkeleton } from "@/components/Skeleton";
import { adminAgencies } from "@/data/sample";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { Building2, ShieldCheck, ShieldAlert, TrendingUp, Users, Wallet } from "lucide-react";

const TIER_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "unlimited", label: "Unlimited" },
  { value: "white_label_pro", label: "White Label Pro" },
];

const mrrTrend = [
  { label: "Jan", mrr: 4.2 }, { label: "Feb", mrr: 4.9 }, { label: "Mar", mrr: 5.6 }, { label: "Apr", mrr: 6.1 }, { label: "May", mrr: 6.8 }, { label: "Jun", mrr: 7.4 },
];
const TIER_SHORT: Record<string, string> = { starter: "Starter", growth: "Growth", unlimited: "Unlimited", white_label_pro: "White Label Pro" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const statusTone: Record<string, any> = { active: "success", past_due: "danger", trialing: "warning", canceled: "neutral", incomplete: "warning", unpaid: "danger", paused: "neutral" };
const statusLabel: Record<string, string> = { active: "Activ", past_due: "Plată întârziată", trialing: "În probă", canceled: "Anulat", incomplete: "Incomplet", unpaid: "Neplătit", paused: "Suspendat" };

type Row = { id: string; name: string; owner: string; plan: string; tier: string; clients: number; team: number; mrr: number; status: string };

export default function Admin() {
  const { live, isSaasAdmin, agencyReady } = useWorkspace();
  const { push } = useToast();
  const [rows, setRows] = useState<Row[]>(live ? [] : (adminAgencies as Row[]));
  const [loading, setLoading] = useState(live);

  const load = useCallback(async () => {
    if (!live || !supabase) return;
    const { data, error } = await supabase.from("admin_agency_overview").select("*").order("created_at", { ascending: false });
    if (error) { console.error("[admin] load failed:", error.message); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRows((data ?? []).map((a: any) => ({
      id: a.id, name: a.name, owner: a.owner_name || a.owner_email || "—",
      plan: TIER_SHORT[a.current_plan_tier] ?? a.current_plan_tier, tier: a.current_plan_tier,
      clients: a.client_count ?? 0, team: a.team_member_count ?? 0,
      mrr: Number(a.price_eur_monthly ?? 0), status: a.subscription_status ?? "trialing",
    })));
  }, [live]);

  useEffect(() => {
    if (!live) { setLoading(false); return; }
    if (!supabase || !isSaasAdmin || !agencyReady) { setLoading(!agencyReady && isSaasAdmin); return; }
    let active = true;
    (async () => { setLoading(true); await load(); if (active) setLoading(false); })();
    return () => { active = false; };
  }, [live, isSaasAdmin, agencyReady, load]);

  async function changePlan(id: string, tier: string, name: string) {
    if (!supabase) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, tier, plan: TIER_SHORT[tier] ?? tier } : r)));
    const { error } = await supabase.rpc("admin_set_agency_plan", { p_agency_id: id, p_tier: tier });
    if (error) { push({ tone: "danger", title: "Nu am putut schimba planul", description: error.message }); await load(); return; }
    push({ tone: "success", title: "Plan actualizat", description: `${name} → ${TIER_SHORT[tier] ?? tier}` });
    await load();
  }

  // Live: lock the panel for non-admins.
  if (live && !isSaasAdmin) {
    return (
      <Panel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger"><ShieldAlert className="h-7 w-7" /></span>
        <h2 className="font-display text-lg font-800">Doar pentru administratorii platformei</h2>
        <p className="text-sm text-muted-foreground">Panoul de administrare este centrul de control al platformei. Contul tău nu are rol de administrator al platformei.</p>
        <Link to="/dashboard"><Button variant="primary" className="mt-1">Înapoi la tabloul de bord</Button></Link>
      </Panel>
    );
  }

  if (loading) return <PageSkeleton variant="table" />;

  const activeRows = rows.filter((a) => a.status === "active");
  const mrr = activeRows.reduce((s, a) => s + a.mrr, 0);
  const totalClients = rows.reduce((s, a) => s + a.clients, 0);
  const dist = ["White Label Pro", "Unlimited", "Growth", "Starter"].map((plan) => ({ plan, n: rows.filter((a) => a.plan === plan).length }))
    .map((p) => ({ ...p, pct: rows.length ? Math.round((p.n / rows.length) * 100) : 0 }));

  return (
    <>
      <PageHeader title="Panou de administrare" subtitle="Privire de ansamblu la nivel de SaaS, pentru toate agențiile">
        <Badge tone="danger" dot>Admin SaaS</Badge>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total agenții" value={String(rows.length)} sub={rows.length === 1 ? "1 agenție" : "pe toată platforma"} icon={Building2} />
        <StatCard label="MRR" value={`€${mrr.toLocaleString()}`} sub="abonamente active" icon={Wallet} tone="success" />
        <StatCard label="Abonamente active" value={String(activeRows.length)} sub={`${rows.length - activeRows.length} în probă sau alt status`} icon={ShieldCheck} tone="info" />
        <StatCard label="Total clienți gestionați" value={String(totalClients)} sub="pentru toate agențiile" icon={Users} tone="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-display font-700">MRR platformă</h3>
              <p className="text-xs text-muted-foreground">€ mii / lună</p>
            </div>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          {live ? (
            <div className="grid h-[220px] place-items-center px-6 text-center text-sm text-muted-foreground">
              Evoluția MRR apare odată cu facturarea — se construiește din abonamentele reale ale agențiilor.
            </div>
          ) : (
            <AreaTrend data={mrrTrend} keys={[{ key: "mrr", name: "MRR (€ mii)" }]} height={220} prefix="€" />
          )}
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-3 font-display font-700">Distribuția planurilor</h3>
          <div className="space-y-3">
            {dist.map((p) => (
              <div key={p.plan}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-600">{p.plan}</span><span className="text-muted-foreground">{p.n} {p.n === 1 ? "agenție" : "agenții"}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full gradient-primary" style={{ width: `${p.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="px-5 pt-5"><h3 className="font-display font-700">Toate agențiile</h3></div>
        <Table>
          <THead>
            <TH>Agenție</TH><TH>Proprietar</TH><TH>Plan</TH><TH>Clienți</TH><TH>Echipă</TH><TH>MRR</TH><TH>Status</TH>
          </THead>
          <tbody>
            {rows.map((a) => (
              <TR key={a.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-800 text-white">{a.name.slice(0, 2).toUpperCase()}</span>
                    <span className="font-600">{a.name}</span>
                  </div>
                </TD>
                <TD className="text-muted-foreground">{a.owner}</TD>
                <TD>
                  <Select value={a.tier} onChange={(e) => changePlan(a.id, e.target.value, a.name)} className="h-8 text-xs" aria-label={`Plan pentru ${a.name}`}>
                    {TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </TD>
                <TD>{a.clients}</TD>
                <TD>{a.team}</TD>
                <TD className="font-600">€{a.mrr}</TD>
                <TD><Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status] ?? a.status.replace("_", " ")}</Badge></TD>
              </TR>
            ))}
            {rows.length === 0 && <TR><TD className="py-8 text-center text-sm text-muted-foreground">Încă nicio agenție.</TD></TR>}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
