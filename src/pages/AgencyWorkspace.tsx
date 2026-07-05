import { Link } from "react-router-dom";
import { PageHeader, Panel, Button } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { useClients } from "@/lib/clients";
import { formatCurrency } from "@/lib/utils";
import { billingTypeLabels } from "@/data/sample";
import { CalendarDays, Plus, Users, Wallet } from "lucide-react";

// Agenție - the agency itself: portfolio performance across clients. Settings is
// its own top-level page now, so this is just the performance view.
export default function AgencyWorkspace() {
  const { clients } = useClients();

  const retainerClients = clients.filter((c) => (c.billingType ?? "retainer") === "retainer" && c.retainer > 0);
  const mrr = retainerClients.reduce((s, c) => s + c.retainer, 0);
  const deliverables = clients.reduce((s, c) => s + (c.deliverables ?? 0), 0);
  const ranked = [...clients].sort((a, b) => b.retainer - a.retainer);

  return (
    <>
      <PageHeader title="Performanța agenției" subtitle="Clienți, venit recurent și livrabile - pe tot portofoliul" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Clienți activi" value={String(clients.length)} sub="în portofoliu" icon={Users} tone="primary" />
        <StatCard label="Venit lunar recurent" value={formatCurrency(mrr)} sub={`${retainerClients.length} pe retainer`} icon={Wallet} tone="success" />
        <StatCard label="Livrabile / lună" value={String(deliverables)} sub="planificate pe portofoliu" icon={CalendarDays} tone="info" />
      </div>

      <Panel className="p-4 sm:p-5">
        <p className="mb-3 font-display text-base font-800">Venit pe client</p>
        {clients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-muted-foreground">Venitul recurent pe client apare aici. Adaugă primul client ca să vezi retainerele.</p>
            <Link to="/clients"><Button size="sm" variant="primary"><Plus className="h-4 w-4" /> Adaugă client</Button></Link>
          </div>
        ) : (
          <div className="space-y-2">
            {ranked.map((c) => {
              const isRetainer = (c.billingType ?? "retainer") === "retainer";
              return (
                <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-primary/40 hover:bg-muted/40">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-600">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.deliverables ? `${c.deliverables} livrabile / lună` : "fără date"}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-700">
                    {isRetainer ? formatCurrency(c.retainer) : billingTypeLabels[c.billingType ?? "retainer"]}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
