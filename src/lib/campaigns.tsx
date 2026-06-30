import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";

export type CampaignStatus = "planning" | "active" | "paused" | "completed";

export type Campaign = {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  platform: string; // proper-cased label
  objective: string;
  status: CampaignStatus;
  startDate: string | null; // yyyy-mm-dd
  endDate: string | null;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue: number;
  notes: string;
};

export type NewCampaignInput = {
  clientId: string; name: string; platform: string; objective: string;
  status: CampaignStatus; startDate: string | null; endDate: string | null; budget: number;
};
export type CampaignPatch = Partial<{
  name: string; platform: string; objective: string; status: CampaignStatus;
  startDate: string | null; endDate: string | null; budget: number; spend: number;
  impressions: number; clicks: number; leads: number; conversions: number; revenue: number; notes: string;
}>;

export const CAMPAIGN_PLATFORMS = ["Meta", "Google", "TikTok", "YouTube", "LinkedIn", "Altele"];
export const CAMPAIGN_OBJECTIVES = ["Notorietate", "Trafic", "Lead-uri", "Vânzări", "Reactivare"];
const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", other: "Altele",
};
const platformToDb = (p: string): string => {
  const hit = Object.entries(PLATFORM_LABEL).find(([, v]) => v === p);
  return hit ? hit[0] : p.toLowerCase();
};

const CV = "id, client_id, name, platform, objective, status, start_date, end_date, budget, spend, impressions, clicks, leads, conversions, revenue, notes, client:clients(name)";
const num = (v: unknown) => Number(v ?? 0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Campaign {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.name ?? "—",
    name: r.name,
    platform: r.platform ? (PLATFORM_LABEL[r.platform] ?? r.platform) : "",
    objective: r.objective ?? "",
    status: (r.status ?? "planning") as CampaignStatus,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    budget: num(r.budget), spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks),
    leads: num(r.leads), conversions: num(r.conversions), revenue: num(r.revenue), notes: r.notes ?? "",
  };
}

// Demo data (sample mode only — never seeded into the live DB).
const SAMPLE_CAMPAIGNS: Campaign[] = [
  { id: "c1", clientId: "altmark", clientName: "Altmark Residences", name: "Lansare primăvară — Meta", platform: "Meta", objective: "Lead-uri", status: "active", startDate: "2026-05-15", endDate: "2026-07-15", budget: 6000, spend: 3250, impressions: 421000, clicks: 8400, leads: 137, conversions: 9, revenue: 43000, notes: "" },
  { id: "c2", clientId: "altmark", clientName: "Altmark Residences", name: "Google Search — Cluj", platform: "Google", objective: "Trafic", status: "active", startDate: "2026-06-01", endDate: "2026-08-31", budget: 4500, spend: 1480, impressions: 96000, clicks: 5200, leads: 64, conversions: 4, revenue: 19000, notes: "" },
  { id: "c3", clientId: "auralux", clientName: "AuraLux Beauty", name: "TikTok Spark Ads", platform: "TikTok", objective: "Notorietate", status: "active", startDate: "2026-06-10", endDate: "2026-07-10", budget: 2500, spend: 1820, impressions: 612000, clicks: 14300, leads: 41, conversions: 22, revenue: 7600, notes: "" },
  { id: "c4", clientId: "ironpeak", clientName: "IronPeak Gym", name: "Promo abonamente — Meta", platform: "Meta", objective: "Vânzări", status: "completed", startDate: "2026-04-01", endDate: "2026-05-31", budget: 3000, spend: 3000, impressions: 280000, clicks: 9100, leads: 210, conversions: 88, revenue: 21120, notes: "" },
  { id: "c5", clientId: "verde", clientName: "Verde Bistro", name: "Retargeting Q3", platform: "Meta", objective: "Reactivare", status: "planning", startDate: "2026-07-01", endDate: "2026-09-30", budget: 2000, spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0, notes: "" },
];

type CampaignsCtx = {
  campaigns: Campaign[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createCampaign: (input: NewCampaignInput) => Promise<{ error?: string }>;
  updateCampaign: (id: string, patch: CampaignPatch) => Promise<{ error?: string }>;
  deleteCampaign: (id: string) => Promise<{ error?: string }>;
};

const Ctx = createContext<CampaignsCtx | null>(null);
let demoSeq = 0;

export function CampaignsProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients } = useClients();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [campaigns, setCampaigns] = useState<Campaign[]>(live ? [] : SAMPLE_CAMPAIGNS);
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns").select(CV).eq("agency_id", agencyId)
      .order("start_date", { ascending: false, nullsFirst: false });
    if (agencyRef.current !== agencyId) return;
    if (error) console.error("[campaigns] load failed:", error.message);
    else if (data) setCampaigns(data.map(mapRow));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setCampaigns(SAMPLE_CAMPAIGNS); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const createCampaign = useCallback(async (input: NewCampaignInput) => {
    if (!live || !supabase || !agencyId) {
      const id = "demo-c-" + ++demoSeq;
      const clientName = clients.find((c) => c.id === input.clientId)?.name ?? input.clientId;
      setCampaigns((prev) => [{ id, clientId: input.clientId, clientName, name: input.name, platform: input.platform, objective: input.objective, status: input.status, startDate: input.startDate, endDate: input.endDate, budget: input.budget, spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0, notes: "" }, ...prev]);
      return {};
    }
    const { error } = await supabase.from("campaigns").insert({
      agency_id: agencyId, client_id: input.clientId, name: input.name,
      platform: input.platform ? platformToDb(input.platform) : null,
      objective: input.objective || null, status: input.status,
      start_date: input.startDate, end_date: input.endDate, budget: input.budget,
    });
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [live, agencyId, reload, clients]);

  const updateCampaign = useCallback(async (id: string, patch: CampaignPatch) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (!live || !supabase) return {};
    const db: Record<string, unknown> = {};
    if (patch.name !== undefined) db.name = patch.name;
    if (patch.platform !== undefined) db.platform = patch.platform ? platformToDb(patch.platform) : null;
    if (patch.objective !== undefined) db.objective = patch.objective || null;
    if (patch.status !== undefined) db.status = patch.status;
    if (patch.startDate !== undefined) db.start_date = patch.startDate;
    if (patch.endDate !== undefined) db.end_date = patch.endDate;
    if (patch.budget !== undefined) db.budget = patch.budget;
    if (patch.spend !== undefined) db.spend = patch.spend;
    if (patch.impressions !== undefined) db.impressions = patch.impressions;
    if (patch.clicks !== undefined) db.clicks = patch.clicks;
    if (patch.leads !== undefined) db.leads = patch.leads;
    if (patch.conversions !== undefined) db.conversions = patch.conversions;
    if (patch.revenue !== undefined) db.revenue = patch.revenue;
    if (patch.notes !== undefined) db.notes = patch.notes || null;
    const { error } = await supabase.from("campaigns").update(db).eq("id", id);
    if (error) { console.error("[campaigns] update failed:", error.message); return { error: error.message }; }
    return {};
  }, [live]);

  const deleteCampaign = useCallback(async (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) return { error: error.message };
    return {};
  }, [live]);

  return (
    <Ctx.Provider value={{ campaigns, loading, live, reload, createCampaign, updateCampaign, deleteCampaign }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCampaigns() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCampaigns must be used within CampaignsProvider");
  return ctx;
}
