import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Button, Panel, SectionCard, Input, Select, Badge } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { Bars } from "@/components/charts";
import { useToast } from "@/lib/toast";
import { useClients } from "@/lib/clients";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { Phone, MessageCircle, CalendarCheck, ShoppingBag, Euro, FileSignature, Loader2, Save } from "lucide-react";

const METRIC_FIELDS = [
  { key: "calls_received", label: "Apeluri primite", icon: Phone },
  { key: "relevant_dms", label: "DM-uri relevante", icon: MessageCircle },
  { key: "bookings", label: "Rezervări", icon: CalendarCheck },
  { key: "appointments", label: "Programări", icon: CalendarCheck },
  { key: "orders", label: "Comenzi", icon: ShoppingBag },
  { key: "sales", label: "Vânzări", icon: ShoppingBag },
  { key: "viewings", label: "Vizionări", icon: CalendarCheck },
  { key: "contracts", label: "Contracte", icon: FileSignature },
] as const;
type MetricKey = (typeof METRIC_FIELDS)[number]["key"];

const DEMO_FORM: Record<MetricKey, string> = {
  calls_received: "42", relevant_dms: "138", bookings: "26", appointments: "19", orders: "54", sales: "31", viewings: "37", contracts: "8",
};
const DEMO_TREND = [
  { label: "Feb", revenue: 18 }, { label: "Mar", revenue: 24 }, { label: "Apr", revenue: 21 }, { label: "Mai", revenue: 29 }, { label: "Iun", revenue: 34 },
];

const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const num = (s: string) => (s ? Number(s) : 0);
const eurK = (v: number) => (v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${v}`);

export default function BusinessImpact() {
  const { push } = useToast();
  const { clients, live } = useClients();
  const { currentAgency } = useWorkspace();
  const [clientId, setClientId] = useState("");
  const [form, setForm] = useState<Record<string, string>>(live ? {} : { ...DEMO_FORM });
  const [revenue, setRevenue] = useState(live ? "" : "430000");
  const [objections, setObjections] = useState("");
  const [feedback, setFeedback] = useState("");
  const [trend, setTrend] = useState<{ label: string; revenue: number }[]>(live ? [] : DEMO_TREND);
  const [loading, setLoading] = useState(live);
  const [saving, setSaving] = useState(false);
  const period = firstOfMonthISO();

  // Deep link (?client=id) from the weekly queues wins over the default pick.
  const [params] = useSearchParams();
  useEffect(() => {
    if (!live || clientId || !clients.length) return;
    const p = params.get("client");
    setClientId(p && clients.some((c) => c.id === p) ? p : clients[0].id);
  }, [live, clients, clientId, params]);

  useEffect(() => {
    if (!live) { setLoading(false); return; }
    if (!supabase || !clientId) { setLoading(!!clients.length); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase!.from("business_impact_entries").select("*").eq("client_id", clientId).eq("period_month", period).eq("source", "agency").maybeSingle();
      if (!active) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e: any = data ?? {};
      const f: Record<string, string> = {};
      METRIC_FIELDS.forEach((m) => { f[m.key] = e[m.key] != null ? String(e[m.key]) : ""; });
      setForm(f);
      setRevenue(e.revenue_estimate != null ? String(e.revenue_estimate) : "");
      setObjections(e.objections_heard ?? "");
      setFeedback(e.qualitative_feedback ?? "");
      const { data: hist } = await supabase!.from("business_impact_entries").select("period_month, revenue_estimate").eq("client_id", clientId).eq("source", "agency").order("period_month", { ascending: true }).limit(12);
      setTrend((hist ?? []).map((h) => ({ label: new Date(h.period_month + "T00:00:00").toLocaleString("ro-RO", { month: "short" }), revenue: Math.round(Number(h.revenue_estimate ?? 0) / 1000) })));
      setLoading(false);
    })();
    return () => { active = false; };
    // Intentionally NOT keyed on clients.length: a background client-list reload
    // must not re-fetch and clobber the user's unsaved edits for the same client.
  }, [live, clientId, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientName = clients.find((c) => c.id === clientId)?.name ?? (live ? "clientul tău" : "Altmark Residences");

  async function save() {
    setSaving(true);
    if (live && supabase && clientId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any = { agency_id: currentAgency.id, client_id: clientId, period_month: period, source: "agency" };
      METRIC_FIELDS.forEach((m) => { row[m.key] = form[m.key] ? Number(form[m.key]) : null; });
      row.revenue_estimate = revenue ? Number(revenue) : null;
      row.objections_heard = objections || null;
      row.qualitative_feedback = feedback || null;
      const { error } = await supabase.from("business_impact_entries").upsert(row, { onConflict: "client_id,period_month,source" });
      if (error) { setSaving(false); push({ tone: "danger", title: "Nu s-a putut salva", description: error.message }); return; }
      setTrend((prev) => {
        const lbl = new Date(period + "T00:00:00").toLocaleString("ro-RO", { month: "short" });
        const rev = Math.round(num(revenue) / 1000);
        const found = prev.some((p) => p.label === lbl);
        return found ? prev.map((p) => (p.label === lbl ? { ...p, revenue: rev } : p)) : [...prev, { label: lbl, revenue: rev }];
      });
    }
    setSaving(false);
    push({ tone: "success", title: "Impact salvat", description: `${clientName} · luna aceasta a fost înregistrată cu succes` });
  }

  if (loading) return <PageSkeleton variant="dashboard" />;

  const inbound = num(form.calls_received) + num(form.relevant_dms);

  return (
    <>
      <PageHeader title="Monitor de impact în afacere" subtitle={`Rezultate reale pentru ${clientName} · introduse de agenție sau client`}>
        {live ? (
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10" disabled={clients.length === 0}>
            {clients.length === 0 ? <option>Încă niciun client</option> : clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        ) : (
          <Select className="h-10">{["Altmark Residences", "IronPeak Gym", "Verde Bistro"].map((c) => <option key={c}>{c}</option>)}</Select>
        )}
        <Button variant="primary" onClick={save} disabled={saving || (live && clients.length === 0)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvează luna</Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel className="p-5"><Euro className="h-5 w-5 text-success" /><p className="mt-2 font-display text-2xl font-800">{eurK(num(revenue))}</p><p className="text-xs text-muted-foreground">Venituri atribuite</p></Panel>
        <Panel className="p-5"><ShoppingBag className="h-5 w-5 text-primary" /><p className="mt-2 font-display text-2xl font-800">{num(form.sales)}</p><p className="text-xs text-muted-foreground">Vânzări luna aceasta</p></Panel>
        <Panel className="p-5"><Phone className="h-5 w-5 text-info" /><p className="mt-2 font-display text-2xl font-800">{inbound}</p><p className="text-xs text-muted-foreground">Contacte primite</p></Panel>
        <Panel className="p-5"><CalendarCheck className="h-5 w-5 text-[hsl(var(--warning))]" /><p className="mt-2 font-display text-2xl font-800">{num(form.viewings)}</p><p className="text-xs text-muted-foreground">Vizionări programate</p></Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Date introduse luna aceasta" subtitle="Fiecare câmp este editabil — salvat per client și lună">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METRIC_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-4 w-4" /></span>
                <span className="flex-1 text-sm font-600">{f.label}</span>
                <Input type="number" value={form[f.key] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} className="h-9 w-20 text-right" placeholder="0" />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-700 text-muted-foreground">Estimare venituri (€)</p>
              <Input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <p className="mb-1 text-xs font-700 text-muted-foreground">Obiecții auzite</p>
              <Input value={objections} onChange={(e) => setObjections(e.target.value)} placeholder="ex. preț, locație, timing…" />
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs font-700 text-muted-foreground">Feedback calitativ de la clienți</p>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="min-h-[80px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Ce au spus de fapt clienții?" />
          </div>
        </SectionCard>

        <SectionCard title="Tendință impact venituri" subtitle="mii €">
          {trend.length > 0 ? (
            <Bars data={trend} keys={[{ key: "revenue", name: "Venituri (€k)" }]} height={200} prefix="€" />
          ) : (
            <div className="grid h-[200px] place-items-center text-center text-sm text-muted-foreground">Salvează o lună pentru a începe tendința.</div>
          )}
          <div className="mt-3 rounded-lg bg-success/10 p-3 text-xs text-success">
            <Badge tone="success">Live</Badge> Cifrele persistă per client și lună și alimentează raportul AI.
          </div>
        </SectionCard>
      </div>
    </>
  );
}
