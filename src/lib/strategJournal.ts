import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";

/*
 * The Strateg's journal: one event per applied operation, as a list of
 * (author, action, object, date). This is the foundation of the future
 * multi-user activity feed, so the shape stays structured even though the
 * UI today is a simple list.
 */

export type JournalEvent = { id: string; author: string; action: string; object: string; createdAt: string };

const DEMO_KEY = "dreamar-strateg-journal-demo";
let seq = 0;

function demoLoad(): JournalEvent[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); } catch { return []; }
}
function demoSave(rows: JournalEvent[]) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows.slice(0, 200))); } catch { /* private */ } }

export function useStrategJournal() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const [events, setEvents] = useState<JournalEvent[]>([]);

  const reload = useCallback(async () => {
    if (!live) { setEvents(demoLoad()); return; }
    if (!supabase || !agencyId) return;
    const { data, error } = await supabase.from("strateg_journal")
      .select("id, author, action, object, created_at")
      .eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(50);
    if (error) { console.error("[strateg] journal load failed:", error.message); return; }
    setEvents((data ?? []).map((r) => ({ id: r.id, author: r.author, action: r.action, object: r.object, createdAt: r.created_at })));
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId) return;
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const addEvent = useCallback(async (action: string, object: string) => {
    const ev: JournalEvent = { id: `j-${++seq}-${Date.now()}`, author: "Strategul", action, object, createdAt: new Date().toISOString() };
    setEvents((prev) => [ev, ...prev].slice(0, 200));
    if (!live || !supabase || !agencyId) { demoSave([ev, ...demoLoad()]); return; }
    await supabase.from("strateg_journal").insert({ agency_id: agencyId, author: ev.author, action, object });
  }, [live, agencyId]);

  return { events, addEvent, reload };
}
