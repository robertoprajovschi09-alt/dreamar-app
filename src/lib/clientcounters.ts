import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";

// The fixed set of barter deliverable counters (Super Pasta et al.). Values
// persist per client in client_counters (live) / localStorage (demo).
export const BARTER_COUNTERS: { key: string; label: string }[] = [
  { key: "locatii_filmate", label: "Locații filmate" },
  { key: "intro_uri", label: "Intro-uri obținute" },
  { key: "intalniri_patroni", label: "Întâlniri cu patroni" },
];
export const BARTER_DEADLINE = "31 august";

export function useClientCounters(clientId: string) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const [values, setValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(live);
  const demoKey = `dreamar-clientcounters-${clientId}`;

  const reload = useCallback(async () => {
    if (!live) {
      try { setValues(JSON.parse(localStorage.getItem(demoKey) || "{}")); } catch { setValues({}); }
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId || !clientId) return;
    setLoading(true);
    const { data } = await supabase.from("client_counters").select("key, value").eq("client_id", clientId);
    const v: Record<string, number> = {};
    (data ?? []).forEach((r) => { v[r.key] = r.value; });
    setValues(v);
    setLoading(false);
  }, [live, agencyId, clientId, demoKey]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId || !clientId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, clientId, reload]);

  const persist = useCallback((key: string, label: string, val: number, next: Record<string, number>) => {
    if (live && supabase && agencyId) void supabase.from("client_counters").upsert(
      { agency_id: agencyId, client_id: clientId, key, label, value: val }, { onConflict: "client_id,key" });
    else try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch { /* private */ }
  }, [live, agencyId, clientId, demoKey]);

  // Functional delta update so rapid +/- taps don't drop increments.
  const bump = useCallback((key: string, label: string, delta: number) => {
    setValues((prev) => {
      const val = Math.max(0, (prev[key] ?? 0) + delta);
      const next = { ...prev, [key]: val };
      persist(key, label, val, next);
      return next;
    });
  }, [persist]);

  return { values, loading, bump };
}
