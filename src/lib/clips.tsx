import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";

/*
 * The clip - the central object of the app. A single 6-state pipeline is the one
 * source of truth; the content calendar is just a view over the scheduled/posted
 * clips. Nothing else keeps its own copy of this data.
 */

export type ClipState = "idea" | "to_film" | "filmed" | "edited" | "scheduled" | "posted";

export const CLIP_STATES: { key: ClipState; label: string; cls: string; dot: string }[] = [
  { key: "idea", label: "Idee", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  { key: "to_film", label: "De filmat", cls: "bg-info/15 text-info", dot: "bg-info" },
  { key: "filmed", label: "Filmat", cls: "bg-indigo-500/15 text-indigo-500", dot: "bg-indigo-500" },
  { key: "edited", label: "Editat", cls: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]", dot: "bg-[hsl(var(--warning))]" },
  { key: "scheduled", label: "Programat", cls: "bg-primary/15 text-primary", dot: "bg-primary" },
  { key: "posted", label: "Postat", cls: "bg-success/15 text-success", dot: "bg-success" },
];
export const CLIP_STATE_ORDER = CLIP_STATES.map((s) => s.key);
export const CALENDAR_STATES: ClipState[] = ["scheduled", "posted"];
const STATE_LABEL = Object.fromEntries(CLIP_STATES.map((s) => [s.key, s.label])) as Record<ClipState, string>;
export const clipStateLabel = (s: ClipState) => STATE_LABEL[s] ?? s;

export type Clip = {
  id: string;
  clientId: string | null;
  clientName: string;
  title: string;
  state: ClipState;
  platform: string;          // proper-cased label, "" if none
  scheduledDate: string | null; // yyyy-mm-dd (only for scheduled/posted)
  assigned: string;
  notes: string;
  finalLink: string;
};

export type NewClipInput = {
  clientId: string | null;
  title: string;
  state: ClipState;
  platform?: string;
  scheduledDate?: string | null;
  notes?: string;
  finalLink?: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube",
  linkedin: "LinkedIn", twitter: "Twitter", whatsapp: "WhatsApp",
};
const platformLabel = (p: string | null) => (p ? PLATFORM_LABEL[p] ?? p : "");
const platformDb = (p?: string) => (p ? p.toLowerCase() : null);

// Demo clips spread across every state so the pipeline/calendar/tampon all show
// data in the sandbox. Dates around the prototype "today" (early July 2026).
let demoSeq = 0;
const SAMPLE_CLIPS: Clip[] = [
  { id: "c1", clientId: "altmark", clientName: "Altmark Residences", title: "Idee: tur apartament nou", state: "idea", platform: "TikTok", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c2", clientId: "verde", clientName: "Verde Bistro", title: "Idee: meniu de vară", state: "idea", platform: "Instagram", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c3", clientId: "ironpeak", clientName: "IronPeak Gym", title: "De filmat: transformare client", state: "to_film", platform: "Instagram", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c4", clientId: "altmark", clientName: "Altmark Residences", title: "De filmat: open house", state: "to_film", platform: "YouTube", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c5", clientId: "smile", clientName: "SmileLab Clinic", title: "Filmat: mituri albire", state: "filmed", platform: "Instagram", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c6", clientId: "auralux", clientName: "AuraLux Beauty", title: "Editat: glass skin", state: "edited", platform: "TikTok", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c7", clientId: "auralux", clientName: "AuraLux Beauty", title: "Editat: promo luciu păr", state: "edited", platform: "Instagram", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c8", clientId: "auralux", clientName: "AuraLux Beauty", title: "Editat: rutină de seară", state: "edited", platform: "TikTok", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c9", clientId: "ironpeak", clientName: "IronPeak Gym", title: "Editat: Q&A antrenor", state: "edited", platform: "TikTok", scheduledDate: null, assigned: "", notes: "", finalLink: "" },
  { id: "c10", clientId: "altmark", clientName: "Altmark Residences", title: "Programat: Sky 2 camere", state: "scheduled", platform: "TikTok", scheduledDate: "2026-07-08", assigned: "", notes: "", finalLink: "" },
  { id: "c11", clientId: "verde", clientName: "Verde Bistro", title: "Programat: scenetă meniu", state: "scheduled", platform: "Instagram", scheduledDate: "2026-07-11", assigned: "", notes: "", finalLink: "" },
  { id: "c12", clientId: "mareluna", clientName: "Mare Luna Hotel", title: "Postat: dezvăluire suită", state: "posted", platform: "Instagram", scheduledDate: "2026-07-01", assigned: "", notes: "", finalLink: "" },
  { id: "c13", clientId: "drivex", clientName: "DriveX Motors", title: "Postat: noutăți în stoc", state: "posted", platform: "Facebook", scheduledDate: "2026-06-28", assigned: "", notes: "", finalLink: "" },
];

type ClipsCtx = {
  clips: Clip[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createClip: (input: NewClipInput) => Promise<{ error?: string; id?: string }>;
  updateClip: (id: string, patch: Partial<Omit<Clip, "id" | "clientName">>) => Promise<{ error?: string }>;
  deleteClip: (id: string) => Promise<{ error?: string }>;
  batchCreate: (clientId: string | null, state: ClipState, count: number, titlePrefix: string) => Promise<{ error?: string }>;
};

const Ctx = createContext<ClipsCtx | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Clip {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.name ?? "Fără client",
    title: r.title ?? "",
    state: r.state as ClipState,
    platform: platformLabel(r.platform),
    scheduledDate: r.scheduled_date ?? null,
    assigned: r.assigned ?? "",
    notes: r.notes ?? "",
    finalLink: r.final_link ?? "",
  };
}

export function ClipsProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients } = useClients();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [clips, setClips] = useState<Clip[]>(live ? [] : SAMPLE_CLIPS);
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clips")
      .select("id, client_id, title, state, platform, scheduled_date, assigned, notes, final_link, client:clients(name)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: true });
    if (agencyRef.current !== agencyId) return; // drop stale response after an agency switch
    if (error) console.error("[clips] load failed:", error.message);
    if (!error && data) setClips(data.map(mapRow));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setClips(SAMPLE_CLIPS); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const clientName = useCallback((id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Fără client" : "Fără client"), [clients]);

  const createClip = useCallback(async (input: NewClipInput) => {
    if (!live || !supabase || !agencyId) {
      const id = "demo-clip-" + ++demoSeq;
      setClips((prev) => [...prev, {
        id, clientId: input.clientId, clientName: clientName(input.clientId), title: input.title,
        state: input.state, platform: input.platform ?? "", scheduledDate: input.scheduledDate ?? null,
        assigned: "", notes: input.notes ?? "", finalLink: input.finalLink ?? "",
      }]);
      return { id };
    }
    const { data, error } = await supabase.from("clips").insert({
      agency_id: agencyId, client_id: input.clientId, title: input.title, state: input.state,
      platform: platformDb(input.platform), scheduled_date: input.scheduledDate ?? null,
      notes: input.notes ?? "", final_link: input.finalLink ?? null,
    }).select("id").single();
    if (error) return { error: error.message };
    await reload();
    return { id: data?.id as string };
  }, [live, agencyId, reload, clientName]);

  const updateClip = useCallback(async (id: string, patch: Partial<Omit<Clip, "id" | "clientName">>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, clientName: patch.clientId !== undefined ? clientName(patch.clientId) : c.clientName } : c)));
    if (!live || !supabase) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = {};
    if (patch.clientId !== undefined) db.client_id = patch.clientId;
    if (patch.title !== undefined) db.title = patch.title;
    if (patch.state !== undefined) db.state = patch.state;
    if (patch.platform !== undefined) db.platform = platformDb(patch.platform);
    if (patch.scheduledDate !== undefined) db.scheduled_date = patch.scheduledDate;
    if (patch.assigned !== undefined) db.assigned = patch.assigned;
    if (patch.notes !== undefined) db.notes = patch.notes;
    if (patch.finalLink !== undefined) db.final_link = patch.finalLink || null;
    const { error } = await supabase.from("clips").update(db).eq("id", id);
    if (error) { console.error("[clips] update failed:", error.message); return { error: error.message }; }
    return {};
  }, [live, clientName]);

  const deleteClip = useCallback(async (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("clips").delete().eq("id", id);
    if (error) return { error: error.message };
    return {};
  }, [live]);

  const batchCreate = useCallback(async (clientId: string | null, state: ClipState, count: number, titlePrefix: string) => {
    const n = Math.max(1, Math.min(50, Math.floor(count)));
    const base = titlePrefix.trim() || "Clip";
    if (!live || !supabase || !agencyId) {
      const name = clientName(clientId);
      setClips((prev) => [
        ...prev,
        ...Array.from({ length: n }, (_, i) => ({
          id: "demo-clip-" + ++demoSeq, clientId, clientName: name, title: `${base} ${i + 1}`,
          state, platform: "", scheduledDate: null, assigned: "", notes: "", finalLink: "",
        } as Clip)),
      ]);
      return {};
    }
    const rows = Array.from({ length: n }, (_, i) => ({
      agency_id: agencyId, client_id: clientId, title: `${base} ${i + 1}`, state,
    }));
    const { error } = await supabase.from("clips").insert(rows);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [live, agencyId, reload, clientName]);

  return (
    <Ctx.Provider value={{ clips, loading, live, reload, createClip, updateClip, deleteClip, batchCreate }}>
      {children}
    </Ctx.Provider>
  );
}

export function useClips() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClips must be used within ClipsProvider");
  return ctx;
}
