import { useMemo } from "react";
import { useContent } from "./content";
import { useCampaigns } from "./campaigns";
import { useClients } from "./clients";
import { CalendarClock, CalendarPlus, Clock, FileEdit, Send, Wallet, type LucideIcon } from "lucide-react";

export type InboxKind = "changes" | "send" | "campaign" | "nocontent" | "awaiting";
export type InboxItem = {
  id: string;
  kind: InboxKind;
  tone: "danger" | "warning" | "primary" | "muted";
  icon: LucideIcon;
  title: string;
  subtitle: string;
  clientName: string;
  group: "now" | "later";
  actionLabel: string;
  // Present only on actionable items. Runs the optimistic mutation.
  act?: () => Promise<{ error?: string }>;
};

const eur = (n: number) => `€${Math.round(n).toLocaleString("ro-RO")}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// One normalized stream of everything that needs the owner. Home shows the top
// of it; Inbox shows all of it. Derived purely from the data providers.
export function useInbox() {
  const { posts, requestApproval, loading: lc } = useContent();
  const { campaigns, loading: lk } = useCampaigns();
  const { clients, loading: lcl } = useClients();
  const loading = lc || lk || lcl;

  return useMemo(() => {
    const items: InboxItem[] = [];
    const today = todayISO();
    const soon = addDaysISO(7);

    // Client asked for a change → revise & resend.
    posts.filter((p) => p.approvalStatus === "approved_with_changes" || p.approvalStatus === "rejected").forEach((p) => {
      items.push({ id: `ch-${p.id}`, kind: "changes", tone: "danger", icon: FileEdit, clientName: p.clientName, title: `${p.clientName} a cerut o schimbare`, subtitle: p.title, group: "now", actionLabel: "Retrimite", act: () => requestApproval(p) });
    });

    // Marked "for approval" in the calendar but not yet sent to the client.
    posts.filter((p) => p.status === "approval" && !p.approvalStatus).forEach((p) => {
      items.push({ id: `snd-${p.id}`, kind: "send", tone: "primary", icon: Send, clientName: p.clientName, title: "Trimite spre aprobare", subtitle: `${p.title} · ${p.clientName}`, group: "now", actionLabel: "Trimite", act: () => requestApproval(p) });
    });

    // Campaigns over budget (now) / ending soon (later).
    campaigns.filter((c) => c.budget > 0 && c.spend > c.budget).forEach((c) => {
      items.push({ id: `cob-${c.id}`, kind: "campaign", tone: "warning", icon: Wallet, clientName: c.clientName, title: `${c.name} a depășit bugetul`, subtitle: `${c.clientName} · ${eur(c.spend)} / ${eur(c.budget)}`, group: "now", actionLabel: "" });
    });
    campaigns.filter((c) => c.status === "active" && c.endDate && c.endDate >= today && c.endDate <= soon).forEach((c) => {
      items.push({ id: `cend-${c.id}`, kind: "campaign", tone: "warning", icon: CalendarClock, clientName: c.clientName, title: `${c.name} se termină curând`, subtitle: `${c.clientName} · până la ${c.endDate}`, group: "later", actionLabel: "" });
    });

    // Clients with nothing scheduled (match by id — names can change).
    clients.filter((c) => !posts.some((p) => p.clientId === c.id && p.status === "scheduled")).forEach((c) => {
      items.push({ id: `nc-${c.id}`, kind: "nocontent", tone: "muted", icon: CalendarPlus, clientName: c.name, title: `${c.name} — fără conținut programat`, subtitle: "Planifică-i săptămâna pe desktop", group: "later", actionLabel: "" });
    });

    // Sent, waiting on the client (informational).
    posts.filter((p) => p.approvalStatus === "pending").forEach((p) => {
      items.push({ id: `aw-${p.id}`, kind: "awaiting", tone: "muted", icon: Clock, clientName: p.clientName, title: `Trimis lui ${p.clientName}`, subtitle: `${p.title} · așteaptă decizia`, group: "later", actionLabel: "" });
    });

    const now = items.filter((i) => i.group === "now");
    const later = items.filter((i) => i.group === "later");
    return { items, now, later, count: now.length, loading };
  }, [posts, campaigns, clients, loading, requestApproval]);
}
