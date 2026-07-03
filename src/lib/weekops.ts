import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";
import { useContent, type ContentPost } from "./content";
import { useCampaigns } from "./campaigns";

/*
 * The Weekly Operating System's single source of truth. Seven queues, each a
 * list that drains to zero — derived from the data providers plus a handful of
 * targeted queries (approval aging, tasks, impact coverage, report stamps,
 * last activity). The unit of work is the ISO week (Mon–Sun).
 */

export const WEEKLY_TARGET = 3; // scheduled posts per client per week (v1 constant)
const STUCK_HOURS = 48; // sent-for-approval with no client answer
const RISK_STUCK_HOURS = 120;
const STALE_CAMPAIGN_DAYS = 7;
const NO_TOUCH_DAYS = 14;
const IMPACT_GRACE_DAY = 5; // don't nag about missing impact in the first days
const REPORT_WINDOW_DAY = 25; // reports become "due" near month end

export type BlockerRow =
  | { kind: "changes"; id: string; post: ContentPost }
  | { kind: "ready"; id: string; post: ContentPost }
  | { kind: "stuck"; id: string; post: ContentPost; approvalId: string; ageDays: number };
export type CoverageRow = { clientId: string; clientName: string; count: number; target: number };
export type CampaignAttn = { kind: "over" | "ending" | "stale"; id: string; name: string; clientName: string; detail: string };
export type ImpactGap = { clientId: string; clientName: string };
export type ReportDue = { clientId: string; clientName: string };
export type FollowupRow =
  | { kind: "task"; id: string; title: string; clientName: string; deadline: string; overdue: boolean }
  | { kind: "notouch"; id: string; clientId: string; clientName: string; days: number };
export type RiskRow = { clientId: string; clientName: string; reasons: string[] };

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

type Extras = {
  // pending approval age, keyed by post id
  pending: Map<string, { approvalId: string; requestedAt: string }>;
  impactClients: Set<string>;
  lowPulse: Set<string>;
  reportSent: Map<string, string | null>;
  tasks: { id: string; title: string; deadline: string; clientName: string }[];
  lastPostAt: Map<string, string>;
  loaded: boolean;
};
const EMPTY_EXTRAS: Extras = { pending: new Map(), impactClients: new Set(), lowPulse: new Set(), reportSent: new Map(), tasks: [], lastPostAt: new Map(), loaded: false };

export function useWeekOps() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients, loading: lc } = useClients();
  const { posts, requestApproval, loading: lp } = useContent();
  const { campaigns, loading: lk } = useCampaigns();
  const agencyId = currentAgency.id;
  const [extras, setExtras] = useState<Extras>(EMPTY_EXTRAS);

  const reloadExtras = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    const month = firstOfMonthISO();
    const sunday = new Date(mondayOf(new Date()).getTime() + 6 * DAY);
    const [appr, impact, cli, tk, acts] = await Promise.all([
      supabase.from("approvals").select("id, entity_id, requested_at").eq("agency_id", agencyId).eq("entity_type", "post").eq("status", "pending"),
      supabase.from("business_impact_entries").select("client_id, client_satisfaction").eq("agency_id", agencyId).eq("period_month", month),
      supabase.from("clients").select("id, report_sent_at").eq("agency_id", agencyId).is("archived_at", null),
      supabase.from("tasks").select("id, title, deadline, client:clients(name)").eq("agency_id", agencyId).in("status", ["todo", "in_progress", "blocked"]).not("deadline", "is", null).lte("deadline", iso(sunday)).order("deadline").limit(30),
      supabase.from("content_posts").select("client_id, created_at").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(400),
    ]);
    const pending = new Map<string, { approvalId: string; requestedAt: string }>();
    (appr.data ?? []).forEach((a) => pending.set(a.entity_id, { approvalId: a.id, requestedAt: a.requested_at }));
    const impactClients = new Set<string>();
    const lowPulse = new Set<string>();
    (impact.data ?? []).forEach((r) => {
      impactClients.add(r.client_id);
      if (r.client_satisfaction != null && r.client_satisfaction <= 2) lowPulse.add(r.client_id);
    });
    const reportSent = new Map<string, string | null>();
    (cli.data ?? []).forEach((c) => reportSent.set(c.id, c.report_sent_at));
    const lastPostAt = new Map<string, string>();
    (acts.data ?? []).forEach((p) => { if (!lastPostAt.has(p.client_id)) lastPostAt.set(p.client_id, p.created_at); });
    setExtras({
      pending, impactClients, lowPulse, reportSent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tasks: (tk.data ?? []).map((t: any) => ({ id: t.id, title: t.title, deadline: String(t.deadline).slice(0, 10), clientName: t.client?.name ?? "" })),
      lastPostAt, loaded: true,
    });
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setExtras({ ...EMPTY_EXTRAS, loaded: true }); return; }
    if (!agencyReady || !agencyId) return;
    void reloadExtras();
  }, [live, agencyReady, agencyId, reloadExtras]);

  // ── Inline actions ─────────────────────────────────────────────────────────
  const nudge = useCallback(async (approvalId: string) => {
    if (!live || !supabase) return {};
    const { error } = await supabase.from("approvals").update({ requested_at: new Date().toISOString() }).eq("id", approvalId);
    if (error) return { error: error.message };
    await reloadExtras();
    return {};
  }, [live, reloadExtras]);

  const completeTask = useCallback(async (id: string) => {
    setExtras((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    if (error) { await reloadExtras(); return { error: error.message }; }
    return {};
  }, [live, reloadExtras]);

  const createCheckin = useCallback(async (clientId: string, clientName: string) => {
    if (!live || !supabase || !agencyId) return {};
    const due = new Date(Date.now() + 2 * DAY);
    const { error } = await supabase.from("tasks").insert({
      agency_id: agencyId, client_id: clientId, title: `Check-in — ${clientName}`,
      task_type: "meeting", priority: "high", status: "todo", deadline: iso(due),
    });
    if (error) return { error: error.message };
    await reloadExtras();
    return {};
  }, [live, agencyId, reloadExtras]);

  // ── The queues ─────────────────────────────────────────────────────────────
  const ops = useMemo(() => {
    const now = Date.now();
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
    const todayISO = iso(today);

    // 1 — Publishing blockers
    const blockers: BlockerRow[] = [];
    posts.forEach((p) => {
      if (p.approvalStatus === "approved_with_changes" || p.approvalStatus === "rejected") blockers.push({ kind: "changes", id: `ch-${p.id}`, post: p });
      else if (p.status === "approval" && !p.approvalStatus) blockers.push({ kind: "ready", id: `rd-${p.id}`, post: p });
      else if (p.approvalStatus === "pending") {
        const pend = extras.pending.get(p.id);
        if (pend) {
          const ageH = (now - new Date(pend.requestedAt).getTime()) / 3600000;
          if (ageH >= STUCK_HOURS) blockers.push({ kind: "stuck", id: `st-${p.id}`, post: p, approvalId: pend.approvalId, ageDays: Math.floor(ageH / 24) });
        }
      }
    });

    // 2 — Next-week coverage
    const countNext = (clientId: string) =>
      posts.filter((p) => p.clientId === clientId && p.status === "scheduled" && p.date && p.date >= nextStart && p.date <= nextEnd).length;
    const coverage: CoverageRow[] = clients
      .map((c) => ({ clientId: c.id, clientName: c.name, count: countNext(c.id), target: WEEKLY_TARGET }))
      .filter((r) => r.count < r.target)
      .sort((a, b) => a.count - b.count);

    // 3 — Campaigns needing attention (one row per campaign, worst reason wins)
    const attn: CampaignAttn[] = [];
    campaigns.forEach((c) => {
      if (c.budget > 0 && c.spend > c.budget) attn.push({ kind: "over", id: c.id, name: c.name, clientName: c.clientName, detail: "peste buget" });
      else if (c.status === "active" && c.endDate && c.endDate >= todayISO && new Date(c.endDate).getTime() - now <= 7 * DAY) attn.push({ kind: "ending", id: c.id, name: c.name, clientName: c.clientName, detail: `se termină pe ${c.endDate.slice(8, 10)}.${c.endDate.slice(5, 7)}` });
      else if (c.status === "active" && c.updatedAt && now - new Date(c.updatedAt).getTime() > STALE_CAMPAIGN_DAYS * DAY) attn.push({ kind: "stale", id: c.id, name: c.name, clientName: c.clientName, detail: `fără cifre noi de ${Math.floor((now - new Date(c.updatedAt).getTime()) / DAY)} zile` });
    });

    // 4 — Missing business impact (after the grace window)
    const impactGaps: ImpactGap[] = (live && extras.loaded && dayOfMonth >= IMPACT_GRACE_DAY)
      ? clients.filter((c) => !extras.impactClients.has(c.id)).map((c) => ({ clientId: c.id, clientName: c.name }))
      : [];

    // 5 — Reports due (near month end, not yet sent this cycle)
    const reportsDue: ReportDue[] = (live && extras.loaded && dayOfMonth >= REPORT_WINDOW_DAY)
      ? clients.filter((c) => {
          const sent = extras.reportSent.get(c.id);
          return !sent || sent.slice(0, 10) < monthStart;
        }).map((c) => ({ clientId: c.id, clientName: c.name }))
      : [];

    // 6 — Follow-ups: tasks due this week + clients untouched for 14 days
    const followups: FollowupRow[] = extras.tasks.map((t) => ({
      kind: "task" as const, id: t.id, title: t.title, clientName: t.clientName, deadline: t.deadline, overdue: t.deadline < todayISO,
    }));
    const noTouch = new Map<string, number>();
    if (live && extras.loaded) {
      clients.forEach((c) => {
        const last = extras.lastPostAt.get(c.id);
        const days = last ? Math.floor((now - new Date(last).getTime()) / DAY) : Infinity;
        if (days > NO_TOUCH_DAYS) {
          const d = Number.isFinite(days) ? days : NO_TOUCH_DAYS + 1;
          noTouch.set(c.id, d);
          followups.push({ kind: "notouch", id: `nt-${c.id}`, clientId: c.id, clientName: c.name, days: d });
        }
      });
    }

    // 7 — At-risk clients: ≥2 independent signals, with reasons
    const stuckByClient = new Map<string, number>();
    blockers.forEach((b) => { if (b.kind === "stuck" && b.ageDays * 24 >= RISK_STUCK_HOURS) stuckByClient.set(b.post.clientId, b.ageDays); });
    const risks: RiskRow[] = clients.map((c) => {
      const reasons: string[] = [];
      const cov = coverage.find((r) => r.clientId === c.id);
      if (cov && cov.count === 0) reasons.push("fără conținut săpt. viitoare");
      if (stuckByClient.has(c.id)) reasons.push(`aprobare blocată ${stuckByClient.get(c.id)}z`);
      if (impactGaps.some((g) => g.clientId === c.id)) reasons.push("impact lipsă");
      if (extras.lowPulse.has(c.id)) reasons.push("puls scăzut");
      if (noTouch.has(c.id)) reasons.push(`inactiv ${noTouch.get(c.id)}z`);
      return { clientId: c.id, clientName: c.name, reasons };
    }).filter((r) => r.reasons.length >= 2);

    const total = blockers.length + coverage.length + attn.length + impactGaps.length + reportsDue.length + followups.length;
    return { blockers, coverage, attn, impactGaps, reportsDue, followups, risks, total, weekStart, weekEnd, weekNumber: isoWeekNumber(today) };
  }, [posts, clients, campaigns, extras, live]);

  const loading = lc || lp || lk || (live && !extras.loaded);
  return { ...ops, loading, requestApproval, nudge, completeTask, createCheckin, reloadExtras };
}
