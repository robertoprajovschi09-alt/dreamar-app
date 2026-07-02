import { useEffect, useState } from "react";
import { useClients } from "@/lib/clients";
import { useCampaigns } from "@/lib/campaigns";
import { useToast } from "@/lib/toast";
import { Modal } from "@/components/overlay";
import { nicheLabels } from "@/data/sample";
import { ChevronRight, FileText, MessageCircle, Monitor, Search } from "lucide-react";

const eurK = (n: number) => (n >= 1000 ? `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `€${Math.round(n)}`);

export function MobileClients({ initialName, onConsumed }: { initialName?: string | null; onConsumed?: () => void }) {
  const { clients } = useClients();
  const { campaigns } = useCampaigns();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // A feed row asked for this client — open its sheet directly.
  useEffect(() => {
    if (!initialName) return;
    const c = clients.find((x) => x.name === initialName);
    if (c) setOpenId(c.id);
    onConsumed?.();
  }, [initialName, clients, onConsumed]);

  const list = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const active = clients.find((c) => c.id === openId) ?? null;
  const spendFor = (name: string) => campaigns.filter((c) => c.clientName === name).reduce((s, c) => s + c.spend, 0);

  return (
    <div className="space-y-4">
      <p className="font-display text-xl font-800">Clienți</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută un client" className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm ring-focus" />
      </div>

      <div className="space-y-2">
        {list.map((c) => (
          <button key={c.id} onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition active:bg-muted/50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{c.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-700">{c.name}</span>
              <span className="block text-xs text-muted-foreground">{nicheLabels[c.niche] ?? c.niche}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Niciun client găsit.</p>}
      </div>

      <Modal open={!!active} onClose={() => setOpenId(null)} title={active?.name} subtitle={active ? (nicheLabels[active.niche] ?? active.niche) : undefined} size="md">
        {active && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Cheltuieli ads</p><p className="mt-0.5 font-display text-lg font-800">{eurK(spendFor(active.name))}</p></div>
              <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Retainer</p><p className="mt-0.5 font-display text-lg font-800">{active.retainer ? `€${active.retainer}` : "—"}</p></div>
            </div>
            <button onClick={() => push({ tone: "info", title: "Trimite raportul", description: "Confirmă din profilul clientului pe desktop." })} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-700 text-primary-foreground transition active:scale-[0.99]"><FileText className="h-4 w-4" /> Trimite raportul</button>
            <button onClick={() => push({ tone: "info", title: "Mesaje — în curând" })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-700"><MessageCircle className="h-4 w-4" /> Mesaj</button>
            <p className="pt-1 text-center text-xs text-muted-foreground"><Monitor className="mr-1 inline h-3.5 w-3.5" />Planificarea conținutului se face pe desktop.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
