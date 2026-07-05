import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";

/*
 * The script - the head of the graph: Script -> Clip -> Postare -> Rezultate -> Raport.
 * A script is a written idea/text that belongs to a Client and later becomes a
 * clip in the pipeline. Live-backed by the `scripts` table; demo mode keeps an
 * in-memory list.
 */

export type Script = {
  id: string;
  clientId: string | null;
  clientName: string;
  title: string;
  body: string;
};

export type NewScriptInput = { clientId: string | null; title: string; body?: string };

let demoSeq = 0;
const SAMPLE_SCRIPTS: Script[] = [
  { id: "s1", clientId: "geomar", clientName: "Geomar", title: "3 greșeli când cumperi un apartament nou", body: "Hook: „Nu semna nimic până nu vezi asta.\"\nCadre: fațada, apoi 3 clipuri scurte cu fiecare greșeală.\nCTA: scrie-ne pentru o vizionare." },
  { id: "s2", clientId: "modern", clientName: "Modern Glass & Doors", title: "Cum alegi geamul termopan corect", body: "Hook: „Geamul ăsta te costă 300 lei pe lună dacă alegi greșit.\"\nExplică profilul, sticla, montajul.\nCTA: cere o ofertă." },
];

type ScriptsCtx = {
  scripts: Script[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createScript: (input: NewScriptInput) => Promise<{ error?: string; id?: string }>;
  updateScript: (id: string, patch: Partial<Omit<Script, "id" | "clientName">>) => Promise<{ error?: string }>;
  deleteScript: (id: string) => Promise<{ error?: string }>;
};

const Ctx = createContext<ScriptsCtx | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Script {
  return { id: r.id, clientId: r.client_id, clientName: r.client?.name ?? "Fără client", title: r.title ?? "", body: r.body ?? "" };
}

export function ScriptsProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients } = useClients();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [scripts, setScripts] = useState<Script[]>(live ? [] : SAMPLE_SCRIPTS);
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("scripts")
      .select("id, client_id, title, body, client:clients(name)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (agencyRef.current !== agencyId) return;
    if (error) console.error("[scripts] load failed:", error.message);
    if (!error && data) setScripts(data.map(mapRow));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setScripts(SAMPLE_SCRIPTS); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const clientName = useCallback((id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Fără client" : "Fără client"), [clients]);

  const createScript = useCallback(async (input: NewScriptInput) => {
    if (!live || !supabase || !agencyId) {
      const id = "demo-script-" + ++demoSeq;
      setScripts((prev) => [{ id, clientId: input.clientId, clientName: clientName(input.clientId), title: input.title, body: input.body ?? "" }, ...prev]);
      return { id };
    }
    const { data, error } = await supabase.from("scripts").insert({ agency_id: agencyId, client_id: input.clientId, title: input.title, body: input.body ?? "" }).select("id").single();
    if (error) return { error: error.message };
    await reload();
    return { id: data?.id as string };
  }, [live, agencyId, reload, clientName]);

  const updateScript = useCallback(async (id: string, patch: Partial<Omit<Script, "id" | "clientName">>) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, clientName: patch.clientId !== undefined ? clientName(patch.clientId) : s.clientName } : s)));
    if (!live || !supabase) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = {};
    if (patch.clientId !== undefined) db.client_id = patch.clientId;
    if (patch.title !== undefined) db.title = patch.title;
    if (patch.body !== undefined) db.body = patch.body;
    const { error } = await supabase.from("scripts").update(db).eq("id", id);
    if (error) { console.error("[scripts] update failed:", error.message); return { error: error.message }; }
    return {};
  }, [live, clientName]);

  const deleteScript = useCallback(async (id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("scripts").delete().eq("id", id);
    if (error) return { error: error.message };
    return {};
  }, [live]);

  return (
    <Ctx.Provider value={{ scripts, loading, live, reload, createScript, updateScript, deleteScript }}>
      {children}
    </Ctx.Provider>
  );
}

export function useScripts() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScripts must be used within ScriptsProvider");
  return ctx;
}
