import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";
import { useContent } from "./content";

/*
 * The Weekly Operating System — trimmed to the two operational queues that
 * aren't alerts, ads or approvals: next-week content coverage, and monthly
 * reports due near month end. The unit of work is the ISO week (Mon–Sun).
 */

export const WEEKLY_TARGET = 3; // scheduled posts per client per week (v1 constant)
const REPORT_WINDOW_DAY = 25; // reports become "due" near month end

export type CoverageRow = { clientId: string; clientName: string; count: number; target: number };
export type ReportDue = { clientId: string; clientName: string };

const DAY = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const firstOfMonthISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function isoWeekNumber(d: Date) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}

type Extras = { reportSent: Map<string, string | null>; loaded: boolean };
const EMPTY_EXTRAS: Extras = { reportSent: new Map(), loaded: false };

export function useWeekOps() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients, loading: lc } = useClients();
  const { posts, loading: lp } = useContent();
  const agencyId = currentAgency.id;
  const [extras, setExtras] = useState<Extras>(EMPTY_EXTRAS);

  const reloadExtras = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    const cli = await supabase.from("clients").select("id, report_sent_at").eq("agency_id", agencyId).is("archived_at", null);
    const reportSent = new Map<string, string | null>();
    (cli.data ?? []).forEach((c) => reportSent.set(c.id, c.report_sent_at));
    setExtras({ reportSent, loaded: true });
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setExtras({ ...EMPTY_EXTRAS, loaded: true }); return; }
    if (!agencyReady || !agencyId) return;
    void reloadExtras();
  }, [live, agencyReady, agencyId, reloadExtras]);

  const ops = useMemo(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const monday = mondayOf(today);
    const nextMon = new Date(monday.getTime() + 7 * DAY);
    const nextSun = new Date(monday.getTime() + 13 * DAY);
    const weekStart = iso(monday);
    const weekEnd = iso(new Date(monday.getTime() + 6 * DAY));
    const nextStart = iso(nextMon);
    const nextEnd = iso(nextSun);
    const monthStart = firstOfMonthISO();

    // 1 — Next-week coverage
    const countNext = (clientId: string) =>
      posts.filter((p) => p.clientId === clientId && p.status === "scheduled" && p.date && p.date >= nextStart && p.date <= nextEnd).length;
    const coverage: CoverageRow[] = clients
      .map((c) => ({ clientId: c.id, clientName: c.name, count: countNext(c.id), target: WEEKLY_TARGET }))
      .filter((r) => r.count < r.target)
      .sort((a, b) => a.count - b.count);

    // 2 — Reports due (near month end, not yet sent this cycle)
    const reportsDue: ReportDue[] = (live && extras.loaded && dayOfMonth >= REPORT_WINDOW_DAY)
      ? clients.filter((c) => {
          const sent = extras.reportSent.get(c.id);
          return !sent || sent.slice(0, 10) < monthStart;
        }).map((c) => ({ clientId: c.id, clientName: c.name }))
      : [];

    const total = coverage.length + reportsDue.length;
    return { coverage, reportsDue, total, weekStart, weekEnd, weekNumber: isoWeekNumber(today) };
  }, [posts, clients, extras, live]);

  const loading = lc || lp || (live && !extras.loaded);
  return { ...ops, loading, reloadExtras };
}
