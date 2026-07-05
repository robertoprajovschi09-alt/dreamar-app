import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";

// "De filmat" — a lightweight filming shot list. Live-backed by the film_shots
// table (agency-scoped RLS); demo mode persists to localStorage.
export type FilmShot = { id: string; clientId: string | null; description: string; done: boolean };

const DEMO_KEY = "dreamar-filmshots-demo";
let demoSeq = 0;

export function useFilmShots() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const [shots, setShots] = useState<FilmShot[]>([]);
  const [loading, setLoading] = useState(live);

  const persistDemo = (next: FilmShot[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(next)); } catch { /* private mode */ } };

  const reload = useCallback(async () => {
    if (!live) {
      try { setShots(JSON.parse(localStorage.getItem(DEMO_KEY) || "[]")); } catch { setShots([]); }
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("film_shots")
      .select("id, client_id, description, done")
      .eq("agency_id", agencyId)
      .order("done", { ascending: true })
      .order("created_at", { ascending: false });
    if (!error && data) setShots(data.map((r) => ({ id: r.id, clientId: r.client_id, description: r.description, done: r.done })));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const addShot = useCallback(async (description: string, clientId: string | null) => {
    const desc = description.trim();
    if (!desc) return;
    if (!live || !supabase || !agencyId) {
      const s: FilmShot = { id: `demo-fs-${++demoSeq}-${Date.now()}`, clientId, description: desc, done: false };
      setShots((prev) => { const next = [s, ...prev]; persistDemo(next); return next; });
      return;
    }
    const { data, error } = await supabase
      .from("film_shots")
      .insert({ agency_id: agencyId, client_id: clientId, description: desc })
      .select("id, client_id, description, done")
      .single();
    if (!error && data) setShots((prev) => [{ id: data.id, clientId: data.client_id, description: data.description, done: data.done }, ...prev]);
  }, [live, agencyId]);

  const toggleShot = useCallback(async (id: string, done: boolean) => {
    setShots((prev) => { const next = prev.map((s) => (s.id === id ? { ...s, done } : s)); if (!live) persistDemo(next); return next; });
    if (live && supabase) await supabase.from("film_shots").update({ done }).eq("id", id);
  }, [live]);

  const removeShot = useCallback(async (id: string) => {
    setShots((prev) => { const next = prev.filter((s) => s.id !== id); if (!live) persistDemo(next); return next; });
    if (live && supabase) await supabase.from("film_shots").delete().eq("id", id);
  }, [live]);

  return { shots, loading, addShot, toggleShot, removeShot };
}
