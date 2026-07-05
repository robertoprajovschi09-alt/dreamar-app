import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";

/*
 * The script - the head of the graph: Script -> Clip -> Postare -> Rezultate -> Raport.
 * A script belongs to a client OR a niche (or is general), holds Hook / Desfășurare
 * (body) / CTA, has a status, and links many-to-many to the clips that used it.
 * Live-backed by `scripts` + `clip_scripts`; demo mode keeps it in memory.
 */

export type ScriptStatus = "to_test" | "works" | "dead";
export const SCRIPT_STATUS: { key: ScriptStatus; label: string; cls: string; dot: string }[] = [
  { key: "to_test", label: "De testat", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  { key: "works", label: "Funcționează", cls: "bg-success/15 text-success", dot: "bg-success" },
  { key: "dead", label: "Mort", cls: "bg-danger/15 text-danger", dot: "bg-danger" },
];
export const scriptStatusLabel = (s: ScriptStatus) => SCRIPT_STATUS.find((x) => x.key === s)?.label ?? s;

export type Script = {
  id: string;
  clientId: string | null;
  clientName: string;
  niche: string | null;      // set when the script targets a whole niche instead of one client
  title: string;
  hook: string;
  body: string;              // Desfășurare
  cta: string;
  status: ScriptStatus;
};

export type NewScriptInput = { clientId: string | null; niche?: string | null; title: string; hook?: string; body?: string; cta?: string; status?: ScriptStatus };
export type ScriptLink = { clipId: string; scriptId: string };

let demoSeq = 0;
const SAMPLE_SCRIPTS: Script[] = [
  { id: "s1", clientId: "geomar", clientName: "Geomar", niche: null, status: "works", title: "3 greșeli când cumperi un apartament nou", hook: "Nu semna nimic până nu vezi asta.", body: "Fațada, apoi 3 clipuri scurte cu fiecare greșeală.", cta: "Scrie-ne pentru o vizionare." },
  { id: "s2", clientId: "modern", clientName: "Modern Glass & Doors", niche: null, status: "to_test", title: "Cum alegi geamul termopan corect", hook: "Geamul ăsta te costă 300 lei pe lună dacă alegi greșit.", body: "Explică profilul, sticla, montajul.", cta: "Cere o ofertă." },
];
const SAMPLE_LINKS: ScriptLink[] = [];

type ScriptsCtx = {
  scripts: Script[];
  links: ScriptLink[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createScript: (input: NewScriptInput) => Promise<{ error?: string; id?: string }>;
  updateScript: (id: string, patch: Partial<Omit<Script, "id" | "clientName">>) => Promise<{ error?: string }>;
  deleteScript: (id: string) => Promise<{ error?: string }>;
  attachScript: (clipId: string, scriptId: string) => Promise<{ error?: string }>;
  detachScript: (clipId: string, scriptId: string) => Promise<{ error?: string }>;
  scriptIdsForClip: (clipId: string) => string[];
  clipIdsForScript: (scriptId: string) => string[];
  usageCount: (scriptId: string) => number;
};

const Ctx = createContext<ScriptsCtx | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Script {
  return {
    id: r.id, clientId: r.client_id, clientName: r.client?.name ?? "Fără client", niche: r.niche ?? null,
    title: r.title ?? "", hook: r.hook ?? "", body: r.body ?? "", cta: r.cta ?? "", status: (r.status ?? "to_test") as ScriptStatus,
  };
}

export function ScriptsProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients } = useClients();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [scripts, setScripts] = useState<Script[]>(live ? [] : SAMPLE_SCRIPTS);
  const [links, setLinks] = useState<ScriptLink[]>(live ? [] : SAMPLE_LINKS);
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const [s, l] = await Promise.all([
      supabase.from("scripts").select("id, client_id, niche, title, hook, body, cta, status, client:clients(name)").eq("agency_id", agencyId).order("created_at", { ascending: false }),
      supabase.from("clip_scripts").select("clip_id, script_id").eq("agency_id", agencyId),
    ]);
    if (agencyRef.current !== agencyId) return;
    if (s.error) console.error("[scripts] load failed:", s.error.message);
    if (!s.error && s.data) setScripts(s.data.map(mapRow));
    if (l.error) console.error("[scripts] links load failed:", l.error.message);
    if (!l.error && l.data) setLinks(l.data.map((r) => ({ clipId: r.clip_id, scriptId: r.script_id })));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setScripts(SAMPLE_SCRIPTS); setLinks(SAMPLE_LINKS); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const clientName = useCallback((id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Fără client" : "Fără client"), [clients]);

  const createScript = useCallback(async (input: NewScriptInput) => {
    const base = { clientId: input.clientId, niche: input.niche ?? null, title: input.title, hook: input.hook ?? "", body: input.body ?? "", cta: input.cta ?? "", status: input.status ?? "to_test" as ScriptStatus };
    if (!live || !supabase || !agencyId) {
      const id = "demo-script-" + ++demoSeq;
      setScripts((prev) => [{ id, clientName: clientName(input.clientId), ...base }, ...prev]);
      return { id };
    }
    const { data, error } = await supabase.from("scripts").insert({ agency_id: agencyId, client_id: base.clientId, niche: base.niche, title: base.title, hook: base.hook, body: base.body, cta: base.cta, status: base.status }).select("id").single();
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
    if (patch.niche !== undefined) db.niche = patch.niche;
    if (patch.title !== undefined) db.title = patch.title;
    if (patch.hook !== undefined) db.hook = patch.hook;
    if (patch.body !== undefined) db.body = patch.body;
    if (patch.cta !== undefined) db.cta = patch.cta;
    if (patch.status !== undefined) db.status = patch.status;
    const { error } = await supabase.from("scripts").update(db).eq("id", id);
    if (error) { console.error("[scripts] update failed:", error.message); return { error: error.message }; }
    return {};
  }, [live, clientName]);

  const deleteScript = useCallback(async (id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
    setLinks((prev) => prev.filter((l) => l.scriptId !== id));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("scripts").delete().eq("id", id);
    if (error) return { error: error.message };
    return {};
  }, [live]);

  const attachScript = useCallback(async (clipId: string, scriptId: string) => {
    setLinks((prev) => (prev.some((l) => l.clipId === clipId && l.scriptId === scriptId) ? prev : [...prev, { clipId, scriptId }]));
    if (!live || !supabase || !agencyId) return {};
    const { error } = await supabase.from("clip_scripts").upsert({ agency_id: agencyId, clip_id: clipId, script_id: scriptId }, { onConflict: "clip_id,script_id", ignoreDuplicates: true });
    if (error) { console.error("[scripts] attach failed:", error.message); return { error: error.message }; }
    return {};
  }, [live, agencyId]);

  const detachScript = useCallback(async (clipId: string, scriptId: string) => {
    setLinks((prev) => prev.filter((l) => !(l.clipId === clipId && l.scriptId === scriptId)));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("clip_scripts").delete().eq("clip_id", clipId).eq("script_id", scriptId);
    if (error) return { error: error.message };
    return {};
  }, [live]);

  const scriptIdsForClip = useCallback((clipId: string) => links.filter((l) => l.clipId === clipId).map((l) => l.scriptId), [links]);
  const clipIdsForScript = useCallback((scriptId: string) => links.filter((l) => l.scriptId === scriptId).map((l) => l.clipId), [links]);
  const usageCount = useCallback((scriptId: string) => links.filter((l) => l.scriptId === scriptId).length, [links]);

  const value = useMemo(() => ({
    scripts, links, loading, live, reload, createScript, updateScript, deleteScript,
    attachScript, detachScript, scriptIdsForClip, clipIdsForScript, usageCount,
  }), [scripts, links, loading, live, reload, createScript, updateScript, deleteScript, attachScript, detachScript, scriptIdsForClip, clipIdsForScript, usageCount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScripts() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScripts must be used within ScriptsProvider");
  return ctx;
}
