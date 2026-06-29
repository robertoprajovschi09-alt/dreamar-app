import { useEffect, useState } from "react";
import { PageHeader, Button, Badge, Panel, SectionCard, Progress } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { plans } from "@/data/sample";
import { useToast } from "@/lib/toast";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { Check, CreditCard, Zap } from "lucide-react";

// Invoices come from Stripe (not wired yet) — illustrative until then.
const invoices = [
  { id: "INV-2026-006", date: "1 Jun 2026", amount: "€150.00", status: "paid" },
  { id: "INV-2026-005", date: "1 May 2026", amount: "€150.00", status: "paid" },
  { id: "INV-2026-004", date: "1 Apr 2026", amount: "€150.00", status: "paid" },
];

const TIER_FROM_LABEL: Record<string, string> = {
  "Starter Agency": "starter", "Growth Agency": "growth", "Unlimited Agency": "unlimited", "White Label Pro": "white_label_pro",
};
// Soft monthly AI-credit allowance per tier (display only — not enforced yet).
const CREDIT_ALLOWANCE: Record<string, number> = { starter: 1000, growth: 5000, unlimited: 20000, white_label_pro: 50000 };

type Usage = { clients: number; teamMembers: number; credits: number };
type PlanMeta = { price: number; maxClients: number | null; maxTeam: number | null };

export default function Billing() {
  const { push } = useToast();
  const { live, currentAgency, agencyReady } = useWorkspace();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);

  useEffect(() => {
    if (!live || !supabase || !agencyReady || !currentAgency.id) return;
    let active = true;
    // Clear the previous agency's figures so they can't bleed onto this one.
    setUsage(null);
    setPlanMeta(null);
    (async () => {
      const uc = (await supabase!.from("usage_counters").select("client_count, team_member_count, ai_credits_used").eq("agency_id", currentAgency.id).maybeSingle()).data;
      if (active) setUsage(uc ? { clients: uc.client_count, teamMembers: uc.team_member_count, credits: uc.ai_credits_used } : { clients: 0, teamMembers: 0, credits: 0 });
      const tier = TIER_FROM_LABEL[currentAgency.plan] ?? "starter";
      const pl = (await supabase!.from("plans").select("price_eur_monthly, max_clients, max_team_members").eq("tier", tier).maybeSingle()).data;
      if (active) setPlanMeta(pl ? { price: Number(pl.price_eur_monthly), maxClients: pl.max_clients, maxTeam: pl.max_team_members } : null);
    })();
    return () => { active = false; };
  }, [live, agencyReady, currentAgency.id, currentAgency.plan]);

  const planCards = plans.map((p) => ({ ...p, current: live ? p.name === currentAgency.plan : p.current }));
  const currentCard = planCards.find((p) => p.current) ?? planCards[1];
  const planName = live ? currentAgency.plan : currentCard.name;
  const price = live ? (planMeta?.price ?? currentCard.price) : currentCard.price;
  const tier = TIER_FROM_LABEL[planName] ?? "growth";
  const creditTotal = CREDIT_ALLOWANCE[tier] ?? 5000;

  // Usage values: live from usage_counters/plans, else the sample figures.
  const clientsUsed = live ? (usage?.clients ?? 0) : 12;
  const clientsTotal = live ? (planMeta ? planMeta.maxClients : null) : 15;
  const seatsUsed = live ? (usage?.teamMembers ?? 0) : 2;
  const seatsTotal = live ? (planMeta ? planMeta.maxTeam : null) : 3;
  const creditsUsed = live ? (usage?.credits ?? 0) : 2450;
  const creditsTotal = live ? creditTotal : 5000;

  const renewLine = live
    ? `Perioadă de probă gratuită · ${clientsUsed}${clientsTotal != null ? ` din ${clientsTotal}` : ""} ${clientsUsed === 1 ? "client" : "clienți"} · ${seatsUsed}${seatsTotal != null ? ` din ${seatsTotal}` : ""} ${seatsUsed === 1 ? "loc în echipă" : "locuri în echipă"}`
    : "Se reînnoiește pe 1 iul. 2026 · 12 din 15 clienți folosiți · 2 din 3 locuri în echipă";

  return (
    <>
      <PageHeader title="Facturare și plan" subtitle="Gestionează-ți abonamentul, utilizarea și facturile" />

      {/* Hero */}
      <Panel className="gradient-hero relative overflow-hidden p-6 text-white">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone="primary" className="bg-white/20 text-white">Plan curent</Badge>
            <h2 className="mt-2 font-display text-2xl font-800">{planName} — €{price}/lună</h2>
            <p className="mt-1 text-sm text-white/75">{renewLine}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="dark" className="bg-white text-[hsl(252_70%_30%)] hover:bg-white/90" onClick={() => push({ tone: "info", title: "Schimbă planul", description: "Alege mai jos un plan superior" })}><Zap className="h-4 w-4" /> Schimbă planul</Button>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => push({ tone: "info", title: "Gestionează abonamentul", description: "Portalul de client Stripe vine odată cu facturarea" })}>Gestionează</Button>
          </div>
        </div>
      </Panel>

      {/* Usage */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SectionCard title="Clienți"><Usage used={clientsUsed} total={clientsTotal} label="clienți" /></SectionCard>
        <SectionCard title="Membri ai echipei"><Usage used={seatsUsed} total={seatsTotal} label="locuri" /></SectionCard>
        <SectionCard title="Credite AI"><Usage used={creditsUsed} total={creditsTotal} label="credite" /></SectionCard>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {planCards.map((p) => (
          <Panel key={p.name} className={`relative flex flex-col p-5 ${p.current ? "ring-2 ring-primary" : ""}`}>
            {p.current && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-3 py-1 text-[10px] font-800 uppercase tracking-wide text-white shadow-glow">
                Curent
              </span>
            )}
            <p className="font-display text-base font-800">{p.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
            <p className="mt-3 font-display text-3xl font-800">
              €{p.price}
              <span className="text-sm font-600 text-muted-foreground">/lună</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
            <Button variant={p.current ? "outline" : "primary"} className="mt-5 w-full" disabled={p.current} onClick={() => push({ tone: "info", title: `Treci la ${p.name}`, description: "Schimbarea planului devine activă după conectarea facturării Stripe" })}>
              {p.current ? "Plan curent" : `Treci la ${p.name.split(" ")[0]}`}
            </Button>
          </Panel>
        ))}
      </div>

      <SectionCard title="Facturi" icon={CreditCard} action={<Button variant="ghost" size="sm" onClick={() => push({ tone: "info", title: "Facturile vin odată cu facturarea Stripe" })}>Descarcă tot</Button>}>
        <Table>
          <THead>
            <TH>Factură</TH>
            <TH>Dată</TH>
            <TH>Sumă</TH>
            <TH>Status</TH>
            <TH></TH>
          </THead>
          <tbody>
            {invoices.map((i) => (
              <TR key={i.id}>
                <TD className="font-600">{i.id}</TD>
                <TD className="text-muted-foreground">{i.date}</TD>
                <TD className="font-600">{i.amount}</TD>
                <TD><Badge tone="success">Plătită</Badge></TD>
                <TD className="text-right"><Button variant="ghost" size="sm" onClick={() => push({ tone: "info", title: `${i.id}`, description: "Facturile PDF vin odată cu facturarea Stripe" })}>PDF</Button></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </>
  );
}

function Usage({ used, total, label }: { used: number; total: number | null; label: string }) {
  if (total == null) {
    return (
      <div>
        <div className="flex items-end justify-between">
          <p className="font-display text-2xl font-800">{used.toLocaleString()}<span className="text-sm font-600 text-muted-foreground"> / ∞</span></p>
          <Badge tone="success">Nelimitat</Badge>
        </div>
        <Progress value={8} tone="primary" className="mt-3" />
        <p className="mt-2 text-xs text-muted-foreground">Fără limită de {label}</p>
      </div>
    );
  }
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="font-display text-2xl font-800">{used.toLocaleString()}<span className="text-sm font-600 text-muted-foreground"> / {total.toLocaleString()}</span></p>
        <Badge tone={pct > 85 ? "danger" : pct > 60 ? "warning" : "success"}>{pct}%</Badge>
      </div>
      <Progress value={pct} tone={pct > 85 ? "danger" : pct > 60 ? "warning" : "primary"} className="mt-3" />
      <p className="mt-2 text-xs text-muted-foreground">{Math.max(0, total - used)} {label} rămase</p>
    </div>
  );
}
