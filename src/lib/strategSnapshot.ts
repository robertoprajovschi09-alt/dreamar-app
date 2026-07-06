import { useCallback } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";
import { useClips, CLIP_STATES } from "./clips";
import { useScripts, scriptStatusLabel } from "./scripts";
import { useMoney } from "./money";
import { useKillList } from "./killlist";
import { BARTER_COUNTERS } from "./clientcounters";
import { nicheLabels, billingTypeLabels } from "@/data/sample";

/*
 * buildSnapshot() - the compact JSON "instantaneu" the Strateg receives with
 * every request. Everything the model may claim about the agency comes from
 * here. Titles are truncated to 60 characters to keep the payload small.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const t60 = (s: string) => { const t = (s || "").replace(/\s+/g, " ").trim(); return t.length > 60 ? t.slice(0, 57) + "…" : t; };
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

type MonthlyRow = { reach: number; dmLeads: number };

export function useSnapshotBuilder() {
  const { live, currentAgency } = useWorkspace();
  const agencyId = currentAgency.id;
  const { clients } = useClients();
  const { clips } = useClips();
  const { scripts, usageCount } = useScripts();
  const money = useMoney();
  const { items: killItems } = useKillList();

  return useCallback(async (clientAlesId?: string | null) => {
    const now = new Date();
    const curKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    // Monthly results (reach + leads) for the current and previous month.
    const results = new Map<string, MonthlyRow>(); // `${clientId}-${monthKey}`
    if (live && supabase && agencyId) {
      const { data } = await supabase.from("monthly_results")
        .select("client_id, period_month, reach, dm_leads")
        .eq("agency_id", agencyId).in("period_month", [`${curKey}-01`, `${prevKey}-01`]);
      (data ?? []).forEach((r) => results.set(`${r.client_id}-${String(r.period_month).slice(0, 7)}`, { reach: Number(r.reach) || 0, dmLeads: Number(r.dm_leads) || 0 }));
    } else {
      for (const c of clients) for (const k of [curKey, prevKey]) {
        try {
          const raw = localStorage.getItem(`dreamar-results-${c.id}-${k}`);
          if (raw) { const v = JSON.parse(raw); results.set(`${c.id}-${k}`, { reach: Number(v.reach) || 0, dmLeads: Number(v.dmLeads) || 0 }); }
        } catch { /* ignore */ }
      }
    }

    // Barter deliverable counters (Eduard / Super Pasta).
    const barterVals = new Map<string, Record<string, number>>();
    const barterClients = clients.filter((c) => (c.billingType ?? "retainer") === "barter");
    if (live && supabase && barterClients.length) {
      const { data } = await supabase.from("client_counters").select("client_id, key, value").in("client_id", barterClients.map((c) => c.id));
      (data ?? []).forEach((r) => { const m = barterVals.get(r.client_id) ?? {}; m[r.key] = Number(r.value) || 0; barterVals.set(r.client_id, m); });
    } else {
      for (const c of barterClients) {
        try { barterVals.set(c.id, JSON.parse(localStorage.getItem(`dreamar-clientcounters-${c.id}`) || "{}")); } catch { /* ignore */ }
      }
    }

    const postedIn = (clientId: string, k: string) => clips.filter((c) => c.clientId === clientId && c.state === "posted" && (c.scheduledDate ?? "").startsWith(k)).length;

    // Every clip and script carries its id so the Strateg can reference objects
    // precisely (the action executor resolves by id first).
    const pipeline: Record<string, unknown> = {};
    for (const c of clients) {
      const own = clips.filter((x) => x.clientId === c.id);
      const etape: Record<string, number> = {};
      CLIP_STATES.forEach((s) => { etape[s.label] = own.filter((x) => x.state === s.key).length; });
      const stateLabel = (k: string) => CLIP_STATES.find((s) => s.key === k)?.label ?? k;
      pipeline[c.name] = {
        etape,
        clipuri: own.filter((x) => x.state !== "posted").map((x) => ({
          id: x.id, titlu: t60(x.title), etapa: stateLabel(x.state),
          ...(x.filmDate ? { ziFilmare: x.filmDate } : {}), ...(x.scheduledDate ? { ziPostare: x.scheduledDate } : {}),
        })),
        ultimelePostate: own.filter((x) => x.state === "posted" && x.scheduledDate)
          .sort((a, b) => (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? "")).slice(0, 10)
          .map((x) => ({ id: x.id, titlu: t60(x.title), data: x.scheduledDate })),
      };
    }

    const rezultatePerClient: Record<string, unknown> = {};
    for (const c of clients) {
      const cur = results.get(`${c.id}-${curKey}`);
      const prev = results.get(`${c.id}-${prevKey}`);
      const row: Record<string, unknown> = {
        lunaCurenta: { postari: postedIn(c.id, curKey), reach: cur?.reach ?? null, leaduri: cur?.dmLeads ?? null },
        lunaTrecuta: { postari: postedIn(c.id, prevKey), reach: prev?.reach ?? null, leaduri: prev?.dmLeads ?? null },
      };
      if ((c.billingType ?? "retainer") === "barter") {
        const v = barterVals.get(c.id) ?? {};
        row.barter = Object.fromEntries(BARTER_COUNTERS.map((b) => [b.label, v[b.key] ?? 0]));
      }
      rezultatePerClient[c.name] = row;
    }

    const incasat = money.collections.filter((r) => r.collected).reduce((s, r) => s + r.amount, 0);
    const deIncasat = money.collections.filter((r) => !r.collected).reduce((s, r) => s + r.amount, 0);
    const burn = money.settings.personalFix + money.settings.operationalBurn;
    const nameOf = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Client" : "Fără client");

    return {
      generatLa: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      ...(clientAlesId ? { clientAles: nameOf(clientAlesId) } : {}),
      tintaClipuriGataPerClient: "3-5 în Editat",
      clienti: clients.map((c) => ({
        nume: c.name,
        tip: billingTypeLabels[c.billingType ?? "retainer"],
        retainerLei: (c.billingType ?? "retainer") === "retainer" ? c.retainer : null,
        nisa: nicheLabels[c.niche] ?? c.niche,
      })),
      pipeline,
      rezultate: { lunaCurenta: curKey, lunaTrecuta: prevKey, perClient: rezultatePerClient },
      scripturi: scripts.map((s) => ({ id: s.id, titlu: t60(s.title), client: s.clientId ? s.clientName : s.niche ?? "general", status: scriptStatusLabel(s.status), folosit: usageCount(s.id) })),
      bani: {
        incasatLunaAstaLei: incasat,
        deIncasatLunaAstaLei: deIncasat,
        intarzieri: money.overdueCollections.map((o) => ({ client: nameOf(o.clientId), sumaLei: o.amount, zile: o.daysOverdue })),
        rezervaLei: money.settings.tampon,
        catTeTinBaniiLuni: burn > 0 ? Math.round((money.settings.tampon / burn) * 10) / 10 : null,
      },
      killList: killItems.map((it) => ({
        titlu: it.title,
        deblocat: it.unlocked,
        conditii: it.conditions.map((c) => ({ conditie: c.label, progres: c.numeric ? `${c.current}/${c.target}` : c.met ? "da" : "nu" })),
      })),
    };
  }, [live, agencyId, clients, clips, scripts, usageCount, money, killItems]);
}
