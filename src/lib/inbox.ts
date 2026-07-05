import { useMemo } from "react";
import { useClips } from "./clips";
import { useClients } from "./clients";
import { CalendarPlus, type LucideIcon } from "lucide-react";

export type Severity = "red" | "amber" | "green" | "grey";
export type InboxKind = "nocontent";
export type InboxItem = {
  id: string;
  kind: InboxKind;
  severity: Severity;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  clientName: string;
  actionLabel: string;
  // Optional deadline (ISO date) — sorts sooner-first within the same severity.
  due?: string;
  // Present only on actionable items. Runs the optimistic mutation.
  act?: () => Promise<{ error?: string }>;
};

const RANK: Record<Severity, number> = { red: 0, amber: 1, green: 2, grey: 3 };

// One prioritized stream of everything that needs the owner's attention. With
// approvals and ads removed, the remaining signal is content coverage: which
// clients have nothing scheduled.
export function useInbox() {
  const { clips, loading: lc } = useClips();
  const { clients, loading: lcl } = useClients();
  const loading = lc || lcl;

  return useMemo(() => {
    const items: InboxItem[] = [];

    // 🟡 client with nothing scheduled (match by id)
    clients.filter((c) => !clips.some((cl) => cl.clientId === c.id && cl.state === "scheduled")).forEach((c) => {
      items.push({ id: `nc-${c.id}`, kind: "nocontent", severity: "amber", icon: CalendarPlus, clientName: c.name, title: `${c.name} — fără conținut programat`, subtitle: "Planifică-i săptămâna pe desktop", actionLabel: "" });
    });

    // Severity first; within a band, the item with the nearest deadline wins.
    const feed = items.slice().sort((a, b) => (RANK[a.severity] - RANK[b.severity]) || (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    const urgent = items.filter((i) => i.severity === "red").length;
    const review = items.filter((i) => i.severity === "amber").length;
    return { feed, items, urgent, review, count: urgent + review, loading };
  }, [clips, clients, loading]);
}
