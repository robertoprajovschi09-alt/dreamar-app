import { useMemo } from "react";
import { useContent } from "./content";
import { useCampaigns } from "./campaigns";
import { useClients } from "./clients";
import { CalendarClock, CalendarPlus, CheckCircle2, Clock, FileEdit, Send, Wallet, type LucideIcon } from "lucide-react";

export type Severity = "red" | "amber" | "green" | "grey";
export type InboxKind = "changes" | "send" | "campaign" | "nocontent" | "awaiting" | "approved";
export type InboxItem = {
  id: string;
  kind: InboxKind;
  severity: Severity;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  clientName: string;
  actionLabel: string;
  // Present only on actionable items. Runs the optimistic mutation.
  act?: () => Promise<{ error?: string }>;
};

const eur = (n: number) => `€${Math.round(n).toLocaleString("ro-RO")}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const RANK: Record<Severity, number> = { red: 0, amber: 1, green: 2, grey: 3 };

// One prioritized stream of everything that needs (or rewards) the owner.
// Home shows the top of it; Inbox shows all of it. Pure-derived for now —
// the events/notifications + messages source plugs in here later.
export function useInbox() {
  const { posts, requestApproval, loading: lc } = useContent();
  const { campaigns, loading: lk } = useCampaigns();
  const { clients, loading: lcl } = useClients();
  const loading = lc || lk || lcl;

  return useMemo(() => {
    const items: InboxItem[] = [];
    const today = todayISO();
    const soon = addDaysISO(7);

    // 🔴 client asked for a change → revise & resend
    posts.filter((p) => p.approvalStatus === "approved_with_changes" || p.approvalStatus === "rejected").forEach((p) => {
      items.push({ id: `ch-${p.id}`, kind: "changes", severity: "red", icon: FileEdit, clientName: p.clientName, title: `${p.clientName} a cerut o schimbare`, subtitle: p.title, actionLabel: "Retrimite", act: () => requestApproval(p) });
    });
    // 🔴 marked "for approval" but not sent to the client yet
    posts.filter((p) => p.status === "approval" && !p.approvalStatus).forEach((p) => {
      items.push({ id: `snd-${p.id}`, kind: "send", severity: "red", icon: Send, clientName: p.clientName, title: "Trimite spre aprobare", subtitle: `${p.title} · ${p.clientName}`, actionLabel: "Trimite", act: () => requestApproval(p) });
    });
    // 🟡 campaign over budget / ending soon
    campaigns.filter((c) => c.budget > 0 && c.spend > c.budget).forEach((c) => {
      items.push({ id: `cob-${c.id}`, kind: "campaign", severity: "amber", icon: Wallet, clientName: c.clientName, title: `${c.name} a depășit bugetul`, subtitle: `${c.clientName} · ${eur(c.spend)} / ${eur(c.budget)}`, actionLabel: "" });
    });
    campaigns.filter((c) => c.status === "active" && c.endDate && c.endDate >= today && c.endDate <= soon).forEach((c) => {
      items.push({ id: `cend-${c.id}`, kind: "campaign", severity: "amber", icon: CalendarClock, clientName: c.clientName, title: `${c.name} se termină curând`, subtitle: `${c.clientName} · până la ${c.endDate}`, actionLabel: "" });
    });
    // 🟡 client with nothing scheduled (match by id)
    clients.filter((c) => !posts.some((p) => p.clientId === c.id && p.status === "scheduled")).forEach((c) => {
      items.push({ id: `nc-${c.id}`, kind: "nocontent", severity: "amber", icon: CalendarPlus, clientName: c.name, title: `${c.name} — fără conținut programat`, subtitle: "Planifică-i săptămâna pe desktop", actionLabel: "" });
    });
    // 🟢 client approved content (a win + a nudge)
    posts.filter((p) => p.approvalStatus === "approved").forEach((p) => {
      items.push({ id: `ap-${p.id}`, kind: "approved", severity: "green", icon: CheckCircle2, clientName: p.clientName, title: `${p.clientName} a aprobat`, subtitle: `${p.title} · gata de programat`, actionLabel: "" });
    });
    // ⚪ sent, waiting on the client
    posts.filter((p) => p.approvalStatus === "pending").forEach((p) => {
      items.push({ id: `aw-${p.id}`, kind: "awaiting", severity: "grey", icon: Clock, clientName: p.clientName, title: `Trimis lui ${p.clientName}`, subtitle: `${p.title} · așteaptă decizia`, actionLabel: "" });
    });

    const feed = items.slice().sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    const urgent = items.filter((i) => i.severity === "red").length;
    const review = items.filter((i) => i.severity === "amber").length;
    return { feed, items, urgent, review, count: urgent + review, loading };
  }, [posts, campaigns, clients, loading, requestApproval]);
}
