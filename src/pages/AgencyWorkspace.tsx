import { useSearchParams } from "react-router-dom";
import { Segmented, PageHeader, Panel } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { useClients } from "@/lib/clients";
import { formatCurrency } from "@/lib/utils";
import { billingTypeLabels } from "@/data/sample";
import Settings from "@/pages/Settings";
import Integrations from "@/pages/Integrations";
import { CalendarDays, Users, Wallet } from "lucide-react";

const TABS = [
  { id: "performance", label: "Performanță" },
  { id: "settings", label: "Setări" },
  { id: "integrations", label: "Integrări" },
];

// Agency Workspace — the agency itself: portfolio performance, team, integrations.
export default function AgencyWorkspace() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "performance";
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS.map((t) => ({ label: t.label, value: t.id }))} />
      {tab === "settings" ? <Settings /> : tab === "integrations" ? <Integrations /> : <AgencyPerformance />}
    </div>
  );
}

function AgencyPerformance() {
  const { clients } = useClients();

  const retainerClients = clients.filter((c) => (c.billingType ?? "retainer") === "retainer" && c.retainer > 0);
  const mrr = retainerClients.reduce((s, c) => s + c.retainer, 0);
  const deliverables = clients.reduce((s, c) => s + (c.deliverables ?? 0), 0);
  const ranked = [...clients].sort((a, b) => b.retainer - a.retainer);

  return (
    <>
      <PageHeader title="Performanța agenției" subtitle="Clienți, venit recurent și livrabile — pe tot portofoliul" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Clienți activi" value={String(clients.length)} sub="în portofoliu" icon={Users} tone="primary" />
        <StatCard label="Venit lunar recurent" value={formatCurrency(mrr)} sub={`${retainerClients.length} pe retainer`} icon={Wallet} tone="success" />
        <StatCard label="Livrabile / lună" value={String(deliverables)} sub="planificate pe portofoliu" icon={CalendarDays} tone="info" />
      </div>

      <Panel className="p-4 sm:p-5">
        <p className="mb-3 font-display text-base font-800">Venit pe client</p>
        {clients.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Niciun client încă — retainerele apar aici.</p>
        ) : (
          <div className="space-y-2">
            {ranked.map((c) => {
              const isRetainer = (c.billingType ?? "retainer") === "retainer";
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-600">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.deliverables ? `${c.deliverables} livrabile / lună` : "—"}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-700">
                    {isRetainer ? formatCurrency(c.retainer) : billingTypeLabels[c.billingType ?? "retainer"]}
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
