import { useSearchParams } from "react-router-dom";
import { Segmented, PageHeader, Panel } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { useClients } from "@/lib/clients";
import { useCampaigns } from "@/lib/campaigns";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";
import Integrations from "@/pages/Integrations";
import { Megaphone, TrendingUp, Users, Wallet } from "lucide-react";

const eurK = (n: number) => (n >= 1000 ? `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `€${Math.round(n)}`);

const TABS = [
  { id: "performance", label: "Performanță" },
  { id: "settings", label: "Setări" },
  { id: "billing", label: "Facturare" },
  { id: "integrations", label: "Integrări" },
];

// Agency Workspace — the agency itself: portfolio performance, team, plan, integrations.
export default function AgencyWorkspace() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "performance";
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS.map((t) => ({ label: t.label, value: t.id }))} />
      {tab === "settings" ? <Settings /> : tab === "billing" ? <Billing /> : tab === "integrations" ? <Integrations /> : <AgencyPerformance />}
    </div>
  );
}

function AgencyPerformance() {
  const { clients } = useClients();
  const { campaigns } = useCampaigns();

  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  const byClient: Record<string, { spend: number; revenue: number }> = {};
  campaigns.forEach((c) => { const a = byClient[c.clientName] ?? { spend: 0, revenue: 0 }; a.spend += c.spend; a.revenue += c.revenue; byClient[c.clientName] = a; });
  const top = Object.entries(byClient).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 5);

  return (
    <>
      <PageHeader title="Performanța agenției" subtitle="Cifrele care îți schimbă deciziile — pe tot portofoliul" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Clienți activi" value={String(clients.length)} sub="în portofoliu" icon={Users} tone="primary" />
        <StatCard label="Cheltuieli ads" value={eurK(spend)} sub={`${activeCampaigns} ${activeCampaigns === 1 ? "campanie activă" : "campanii active"}`} icon={Wallet} />
        <StatCard label="Venit din ads" value={eurK(revenue)} sub="atribuit campaniilor" icon={TrendingUp} tone="success" />
        <StatCard label="ROAS mediu" value={`${roas.toFixed(1)}×`} sub="venit / cheltuieli" icon={Megaphone} tone="info" />
      </div>

      <Panel className="p-4 sm:p-5">
        <p className="mb-3 font-display text-base font-800">Unde merg banii</p>
        {top.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nicio campanie încă — investițiile pe client apar aici.</p>
        ) : (
          <div className="space-y-2">
            {top.map((c) => {
              const r = c.spend > 0 ? c.revenue / c.spend : 0;
              return (
                <div key={c.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-600">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{eurK(c.spend)} investiți</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-700">{eurK(c.revenue)}</span>
                    <span className="block text-[11px] text-success">ROAS {r.toFixed(1)}×</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
