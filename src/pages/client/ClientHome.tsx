import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { ChevronRight, Coins, Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { WeeklyPulse } from "./WeeklyPulse";

const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const prevMonthISO = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return firstOfMonthISO(d); };
const monthName = () => new Date().toLocaleDateString("ro-RO", { month: "long" });
const eur = (n: number) => `€${Math.round(n).toLocaleString("ro-RO")}`;
const LEAD_FIELDS = ["calls_received", "relevant_dms", "bookings", "appointments", "viewings"] as const;

type Totals = { leads: number; revenue: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function monthTotals(rows: any[], month: string): Totals {
  const inMonth = rows.filter((r) => r.period_month === month);
  const cli = inMonth.find((r) => r.source === "client");
  const ag = inMonth.find((r) => r.source === "agency");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (f: string) => Number(((cli as any)?.[f] ?? (ag as any)?.[f]) ?? 0);
  return { leads: LEAD_FIELDS.reduce((s, f) => s + pick(f), 0), revenue: pick("revenue_estimate") };
}

export function ClientHome({ onOpenApprovals }: { onOpenApprovals: () => void }) {
  const { viewerClientId, viewerClientName } = useWorkspace();
  const clientId = viewerClientId;
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(viewerClientName || "Brandul tău");
  const [cur, setCur] = useState<Totals>({ leads: 0, revenue: 0 });
  const [prev, setPrev] = useState<Totals>({ leads: 0, revenue: 0 });
  const [invested, setInvested] = useState(0);
  const [goal, setGoal] = useState(0);
  const [weekSummary, setWeekSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [pending, setPending] = useState(0);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [reported, setReported] = useState(false);

  const month = firstOfMonthISO();
  const prevMonth = prevMonthISO();

  const load = useCallback(async () => {
    if (!supabase || !clientId) { setLoading(false); return; }
    setLoading(true);
    const [bi, inv, cl, appr] = await Promise.all([
      supabase.from("business_impact_entries")
        .select("source, period_month, calls_received, relevant_dms, bookings, appointments, viewings, revenue_estimate")
        .eq("client_id", clientId).in("period_month", [month, prevMonth]),
      supabase.rpc("client_money_invested", { p_client: clientId }),
      supabase.from("clients").select("name, agency_id, monthly_lead_goal, week_summary, next_steps").eq("id", clientId).maybeSingle(),
      supabase.from("approvals").select("id", { count: "exact", head: true })
        .eq("client_id", clientId).eq("entity_type", "post").eq("status", "pending"),
    ]);
    const rows = bi.data ?? [];
    setCur(monthTotals(rows, month));
    setPrev(monthTotals(rows, prevMonth));
    setReported(rows.some((r) => r.source === "client" && r.period_month === month));
    setInvested(Number(inv.data ?? 0));
    setName(cl.data?.name ?? viewerClientName ?? "Brandul tău");
    setAgencyId(cl.data?.agency_id ?? "");
    setGoal(Number(cl.data?.monthly_lead_goal ?? 0));
    setWeekSummary(cl.data?.week_summary ?? "");
    setNextSteps(cl.data?.next_steps ?? "");
    setPending(appr.count ?? 0);
    setLoading(false);
  }, [clientId, month, prevMonth, viewerClientName]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const leadsDiff = cur.leads - prev.leads;
  const grew = cur.leads >= prev.leads;
  const roi = invested > 0 && cur.revenue > 0 ? cur.revenue / invested : 0;
  const hasMoney = invested > 0 || cur.revenue > 0;
  const goalPct = goal > 0 ? Math.min(Math.round((cur.leads / goal) * 100), 100) : 0;
  const firstName = name.split(" ")[0];

  const fallbackSummary = cur.leads > 0
    ? `Luna aceasta te-au căutat ${cur.leads} persoane${prev.leads > 0 ? (grew ? `, mai multe decât luna trecută` : `. Am ajustat reclamele ca să crească`) : ""}.`
    : "Abia am început — primele rezultate apar pe măsură ce conținutul prinde tracțiune.";

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-xl font-800">Bună, {firstName}</p>
        <p className="text-sm text-muted-foreground">Iată cum merge afacerea ta</p>
      </div>

      {/* Growth answer */}
      <div className={`rounded-2xl p-5 ${cur.leads === 0 && cur.revenue === 0 ? "bg-muted" : grew ? "bg-success/12" : "bg-warning/15"}`}>
        <div className={`flex items-center gap-2 text-sm font-700 ${cur.leads === 0 ? "text-muted-foreground" : grew ? "text-success" : "text-[hsl(var(--warning))]"}`}>
          {cur.leads === 0 ? <Sparkles className="h-5 w-5" /> : grew ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          <span className="capitalize">{monthName()}</span>
        </div>
        {cur.leads > 0 ? (
          <>
            <p className="mt-2 font-display text-[26px] font-800 leading-tight">{cur.leads} {cur.leads === 1 ? "persoană nouă te-a contactat" : "persoane noi te-au contactat"}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {prev.leads > 0
                ? `Cu ${Math.abs(leadsDiff)} ${grew ? "mai mult" : "mai puțin"} decât luna trecută. ${grew ? "Afacerea ta crește." : "Lucrăm să revină creșterea."}`
                : "Acesta e începutul — construim de aici."}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 font-display text-xl font-800 leading-tight">Strângem primele rezultate</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Rezultatele apar aici pe măsură ce oamenii încep să te contacteze. Revino în câteva zile.</p>
          </>
        )}
      </div>

      {/* Money + ROI */}
      {hasMoney && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs text-muted-foreground">Ai investit</p>
              <p className="mt-1 font-display text-xl font-800">{eur(invested)}</p>
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs text-muted-foreground">Rezultat estimat</p>
              <p className="mt-1 font-display text-xl font-800">{eur(cur.revenue)}</p>
            </div>
          </div>
          {roi > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3.5 py-3 text-sm font-600 text-primary">
              <Coins className="h-4 w-4 shrink-0" /> La fiecare 1 € investit, ai primit ~{Math.round(roi)} € înapoi.
            </div>
          )}
        </>
      )}

      {/* Goal progress */}
      {goal > 0 && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Obiectivul lunii</span>
            <span className="font-700">{cur.leads} / {goal}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      {/* What happened / what's next */}
      <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <div>
          <p className="mb-1 text-xs font-700 uppercase tracking-wide text-muted-foreground">Ce s-a întâmplat</p>
          <p className="text-sm leading-relaxed">{weekSummary.trim() || fallbackSummary}</p>
        </div>
        {nextSteps.trim() && (
          <div className="border-t border-border pt-3">
            <p className="mb-1 text-xs font-700 uppercase tracking-wide text-muted-foreground">Ce urmează</p>
            <p className="text-sm leading-relaxed">{nextSteps.trim()}</p>
          </div>
        )}
      </div>

      {/* Primary action — the 20s pulse */}
      <button onClick={() => setPulseOpen(true)} className="w-full rounded-xl bg-primary py-3.5 text-[15px] font-700 text-primary-foreground shadow-soft transition active:scale-[0.99]">
        {reported ? "Actualizează cum a mers" : "Spune-ne cum a mers"}
      </button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">Durează 20 de secunde</p>

      {/* Pending approval peek */}
      {pending > 0 && (
        <button onClick={onOpenApprovals} className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5 text-left transition hover:bg-primary/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-700">{pending === 1 ? "O postare așteaptă aprobarea ta" : `${pending} postări așteaptă aprobarea ta`}</span>
            <span className="block text-xs text-muted-foreground">Apasă ca să vezi și să aprobi</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      )}

      <WeeklyPulse open={pulseOpen} onClose={() => setPulseOpen(false)} clientId={clientId} agencyId={agencyId} onSaved={() => { setPulseOpen(false); void load(); }} />
    </div>
  );
}
