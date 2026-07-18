import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useToast } from "./toast";

/*
 * Weekly rhythm per client (client_weekly_metrics). One row per ISO week
 * (Monday start, computed locally). We load the recent window (~12 weeks, so
 * the monthly report can look back a couple of months) and upsert on
 * (client_id, week_start). A failed save is never silent — it toasts.
 */

export type WeeklyMetric = { weekStart: string; bioClicks: number; whatsappNew: number; priceComments: number; notes: string };
export type WeeklyInput = { bioClicks: number; whatsappNew: number; priceComments: number; notes: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monday of the week containing `d`, as YYYY-MM-DD, in local time.
export function mondayOf(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const back = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - back);
  return iso(x);
}
function shiftWeek(weekStart: string, backWeeks: number): string {
  const [y, m, day] = weekStart.split("-").map(Number);
  const x = new Date(y, m - 1, day - backWeeks * 7);
  return iso(x);
}

const WEEKS = 12;
const empty = (weekStart: string): WeeklyMetric => ({ weekStart, bioClicks: 0, whatsappNew: 0, priceComments: 0, notes: "" });

export function useWeeklyMetrics(clientId: string) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { push } = useToast();
  const pushRef = useRef(push); pushRef.current = push;
  const agencyId = currentAgency.id;
  const demoKey = `dreamar-weekly-${clientId}`;
  const [weeks, setWeeks] = useState<Record<string, WeeklyMetric>>({});
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live) {
      try { setWeeks(JSON.parse(localStorage.getItem(demoKey) || "{}")); } catch { setWeeks({}); }
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId || !clientId) return;
    setLoading(true);
    const since = shiftWeek(mondayOf(), WEEKS);
    const { data } = await supabase
      .from("client_weekly_metrics")
      .select("week_start, bio_clicks, whatsapp_new, price_comments, notes")
      .eq("client_id", clientId).gte("week_start", since).order("week_start", { ascending: false });
    const map: Record<string, WeeklyMetric> = {};
    (data ?? []).forEach((r) => {
      const w = String(r.week_start).slice(0, 10);
      map[w] = { weekStart: w, bioClicks: Number(r.bio_clicks ?? 0), whatsappNew: Number(r.whatsapp_new ?? 0), priceComments: Number(r.price_comments ?? 0), notes: r.notes ?? "" };
    });
    setWeeks(map);
    setLoading(false);
  }, [live, agencyId, clientId, demoKey]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId || !clientId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, clientId, reload]);

  const thisWeek = mondayOf();
  const current = weeks[thisWeek] ?? empty(thisWeek);
  const previous = weeks[shiftWeek(thisWeek, 1)] ?? null;

  const save = useCallback(async (input: WeeklyInput): Promise<{ error?: string }> => {
    const week = mondayOf();
    const row: WeeklyMetric = {
      weekStart: week,
      bioClicks: Math.max(0, Math.round(input.bioClicks)),
      whatsappNew: Math.max(0, Math.round(input.whatsappNew)),
      priceComments: Math.max(0, Math.round(input.priceComments)),
      notes: input.notes.trim(),
    };
    setWeeks((prev) => ({ ...prev, [week]: row }));
    if (live && supabase && agencyId) {
      const { error } = await supabase.from("client_weekly_metrics").upsert(
        { agency_id: agencyId, client_id: clientId, week_start: week, bio_clicks: row.bioClicks, whatsapp_new: row.whatsappNew, price_comments: row.priceComments, notes: row.notes || null },
        { onConflict: "client_id,week_start" }
      );
      if (error) { pushRef.current({ tone: "danger", title: "Nu s-a putut salva", description: "Cifrele săptămânii nu s-au salvat. Reîncearcă." }); return { error: error.message }; }
    } else {
      setWeeks((prev) => { const next = { ...prev, [week]: row }; try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch { /* private */ } return next; });
    }
    return {};
  }, [live, agencyId, clientId, demoKey]);

  // Weeks whose Monday falls inside a given YYYY-MM month (for the monthly report).
  const weeksInMonth = useCallback((monthKey: string): WeeklyMetric[] =>
    Object.values(weeks).filter((w) => w.weekStart.slice(0, 7) === monthKey), [weeks]);

  const allWeeks = useMemo(() => Object.values(weeks).sort((a, b) => b.weekStart.localeCompare(a.weekStart)), [weeks]);

  return { loading, current, previous, allWeeks, weeksInMonth, save };
}
