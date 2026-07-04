import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { clients as sampleClients, type Client, type Niche, type BillingType } from "@/data/sample";

let demoClientSeq = 0; // collision-free temp ids for demo-created clients

// DB platform enum is lowercase; the UI shows proper-cased labels.
const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube",
  linkedin: "LinkedIn", twitter: "Twitter", whatsapp: "WhatsApp",
};

export type NewClientInput = {
  name: string;
  niche: Niche;
  city?: string;
  website?: string;
  contact?: string;
  retainer?: number | null;
  billingType?: BillingType;
  deliverables?: number | null;
  phone?: string;
  notes?: string;
  platforms: string[];
  objectives?: string[];
  brandVoice?: string;
};
export type ClientPatch = {
  name?: string; niche?: Niche; city?: string; website?: string; contact?: string;
  retainer?: number | null; status?: Client["status"]; platforms?: string[];
  billingType?: BillingType; deliverables?: number | null; phone?: string; notes?: string;
};

// Per-client extras the list view doesn't need but the detail view does.
export type ClientDetails = { objectives: string[]; feedback: string; email: string; phone: string; website: string };

type ClientsCtx = {
  clients: Client[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createClient: (input: NewClientInput) => Promise<{ error?: string; id?: string }>;
  updateClient: (id: string, patch: ClientPatch) => Promise<{ error?: string }>;
  archiveClient: (id: string) => Promise<{ error?: string }>;
  getClient: (id: string) => Client | undefined;
  detailsFor: (id: string) => ClientDetails | undefined;
  objectivesFor: (id: string) => string[];
  feedbackFor: (id: string) => string;
  addObjective: (id: string, text: string) => void;
  removeObjective: (id: string, idx: number) => void;
  applyObjectivesToAll: (ids: string[], objectives: string[]) => Promise<void>;
};

const Ctx = createContext<ClientsCtx | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Client {
  return {
    id: r.id,
    name: r.name,
    niche: r.niche,
    city: r.city ?? "",
    contact: r.contact_person ?? "",
    retainer: Number(r.monthly_retainer ?? 0),
    billingType: (r.billing_type ?? "retainer") as BillingType,
    deliverables: r.monthly_deliverables ?? 0,
    phone: r.contact_phone ?? "",
    notes: r.notes ?? "",
    // "onboarding" is retired — treat any legacy row as active.
    status: (r.status === "archived" || r.status === "paused" ? "paused" : "active") as Client["status"],
    health: r.health_score ?? 0,
    risk: r.risk ?? "low",
    platforms: (r.platforms ?? []).map((p: string) => PLATFORM_LABEL[p] ?? p),
    trend: 0,
  };
}

export function ClientsProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [clients, setClients] = useState<Client[]>(live ? [] : sampleClients);
  const [details, setDetails] = useState<Record<string, ClientDetails>>({});
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    // NOTE: health_score/risk live in client_health_scores (Phase 3 moved them
    // off the clients row for column-level isolation). mapRow defaults them
    // until the health-score function + view are wired in.
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, niche, city, contact_person, contact_email, contact_phone, website, monthly_retainer, billing_type, monthly_deliverables, notes, status, platforms, objectives, feedback")
      .eq("agency_id", agencyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    // Ignore a stale response from a previous agency (rapid switch ordering).
    if (agencyRef.current !== agencyId) return;
    if (error) console.error("[clients] load failed:", error.message);
    if (!error && data) {
      setClients(data.map(mapRow));
      const d: Record<string, ClientDetails> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.forEach((r: any) => {
        d[r.id] = { objectives: r.objectives ?? [], feedback: r.feedback ?? "", email: r.contact_email ?? "", phone: r.contact_phone ?? "", website: r.website ?? "" };
      });
      setDetails(d);
    }
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setClients(sampleClients); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const createClient = useCallback(
    async (input: NewClientInput) => {
      if (!live || !supabase || !agencyId) {
        // demo: append locally so the new client actually shows up + is navigable
        const id = "demo-" + ++demoClientSeq;
        const c: Client = {
          id, name: input.name, niche: input.niche, city: input.city ?? "", contact: input.contact ?? "",
          retainer: input.retainer ?? 0, billingType: input.billingType ?? "retainer", deliverables: input.deliverables ?? 0,
          phone: input.phone ?? "", notes: input.notes ?? "",
          status: "active", health: 0, risk: "low", platforms: input.platforms, trend: 0,
        };
        setClients((prev) => [c, ...prev]);
        setDetails((prev) => ({ ...prev, [id]: { objectives: input.objectives ?? [], feedback: "", email: "", phone: input.phone ?? "", website: input.website ?? "" } }));
        return { id };
      }
      const { data, error } = await supabase
        .from("clients")
        .insert({
          agency_id: agencyId,
          name: input.name,
          niche: input.niche,
          city: input.city || null,
          website: input.website || null,
          contact_person: input.contact || null,
          contact_phone: input.phone || null,
          monthly_retainer: input.billingType && input.billingType !== "retainer" ? null : (input.retainer ?? null),
          billing_type: input.billingType ?? "retainer",
          monthly_deliverables: input.deliverables ?? null,
          notes: input.notes || null,
          status: "active",
          platforms: input.platforms.map((p) => p.toLowerCase()),
          objectives: input.objectives ?? [],
          brand_voice: input.brandVoice || null,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      await reload();
      return { id: data?.id as string };
    },
    [live, agencyId, reload]
  );

  const updateClient = useCallback(async (id: string, patch: ClientPatch) => {
    if (!live || !supabase || !agencyId) {
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, retainer: patch.retainer ?? c.retainer } as Client : c)));
      return {};
    }
    const db: Record<string, unknown> = {};
    if (patch.name !== undefined) db.name = patch.name;
    if (patch.niche !== undefined) db.niche = patch.niche;
    if (patch.city !== undefined) db.city = patch.city || null;
    if (patch.website !== undefined) db.website = patch.website || null;
    if (patch.contact !== undefined) db.contact_person = patch.contact || null;
    if (patch.retainer !== undefined) db.monthly_retainer = patch.retainer;
    if (patch.billingType !== undefined) {
      db.billing_type = patch.billingType;
      // Non-retainer clients don't carry a monthly retainer.
      if (patch.billingType !== "retainer") db.monthly_retainer = null;
    }
    if (patch.deliverables !== undefined) db.monthly_deliverables = patch.deliverables;
    if (patch.phone !== undefined) db.contact_phone = patch.phone || null;
    if (patch.notes !== undefined) db.notes = patch.notes || null;
    if (patch.status !== undefined) db.status = patch.status;
    if (patch.platforms !== undefined) db.platforms = patch.platforms.map((p) => p.toLowerCase());
    const { error } = await supabase.from("clients").update(db).eq("id", id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [live, agencyId, reload]);

  const archiveClient = useCallback(async (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (live && supabase) {
      const { error } = await supabase.from("clients").update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (error) { await reload(); return { error: error.message }; }
    }
    return {};
  }, [live, reload]);

  const getClient = useCallback((id: string) => clients.find((c) => c.id === id), [clients]);
  const detailsFor = useCallback((id: string) => details[id], [details]);
  const objectivesFor = useCallback((id: string) => details[id]?.objectives ?? [], [details]);
  const feedbackFor = useCallback((id: string) => details[id]?.feedback ?? "", [details]);

  const blank = { objectives: [] as string[], feedback: "", email: "", phone: "", website: "" };
  const persistObjectives = useCallback((id: string, next: string[]) => {
    if (live && supabase) {
      supabase.from("clients").update({ objectives: next }).eq("id", id).then(({ error }) => {
        if (error) console.error("[clients] objectives update failed:", error.message);
      });
    }
  }, [live]);
  // Compute the next array from the LATEST state (functional updater) to avoid
  // lost updates when two edits land in the same render frame.
  const addObjective = useCallback((id: string, text: string) => {
    setDetails((prev) => {
      const next = [...(prev[id]?.objectives ?? []), text];
      persistObjectives(id, next);
      return { ...prev, [id]: { ...(prev[id] ?? blank), objectives: next } };
    });
  }, [persistObjectives]); // eslint-disable-line react-hooks/exhaustive-deps
  const removeObjective = useCallback((id: string, idx: number) => {
    setDetails((prev) => {
      const next = (prev[id]?.objectives ?? []).filter((_, i) => i !== idx);
      persistObjectives(id, next);
      return { ...prev, [id]: { ...(prev[id] ?? blank), objectives: next } };
    });
  }, [persistObjectives]); // eslint-disable-line react-hooks/exhaustive-deps
  const applyObjectivesToAll = useCallback(async (ids: string[], objectives: string[]) => {
    setDetails((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = { ...(prev[id] ?? blank), objectives: [...objectives] }; });
      return next;
    });
    if (live && supabase) {
      await Promise.all(ids.map((id) => supabase!.from("clients").update({ objectives }).eq("id", id)));
    }
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={{ clients, loading, live, reload, createClient, updateClient, archiveClient, getClient, detailsFor, objectivesFor, feedbackFor, addObjective, removeObjective, applyObjectivesToAll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useClients() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClients must be used within ClientsProvider");
  return ctx;
}
