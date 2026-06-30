import { useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { useClients } from "@/lib/clients";
import { useCampaigns } from "@/lib/campaigns";
import { useToast } from "@/lib/toast";
import { useInbox, type InboxItem } from "@/lib/inbox";
import { InboxCard } from "@/components/mobile/InboxCard";
import { Bolt, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const eurK = (n: number) => (n >= 1000 ? `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `€${Math.round(n)}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MobileHome({ onOpenInbox, onOpenClients }: { onOpenInbox: () => void; onOpenClients: () => void }) {
  const { profile } = useWorkspace();
  const { clients } = useClients();
  const { campaigns } = useCampaigns();
  const { push } = useToast();
  const { now, count, loading } = useInbox();
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const clock = new Date();
  const timeLabel = `${cap(clock.toLocaleDateString("ro-RO", { weekday: "long" }))}, ${clock.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const top = now.slice(0, 3);
  const allClear = !loading && count === 0;

  async function act(item: InboxItem) {
    if (inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    setBusy(item.id);
    try {
      const res = await item.act?.();
      if (res?.error) push({ tone: "danger", title: "Nu a mers", description: res.error });
      else push({ tone: "success", title: item.kind === "changes" ? "Retrimis" : "Trimis clientului" });
    } finally {
      inFlight.current.delete(item.id);
      setBusy((b) => (b === item.id ? null : b));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{timeLabel}</p>
          <p className="font-display text-xl font-800">Bună, {firstName}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/12 text-sm font-800 text-primary">{firstName.slice(0, 2).toUpperCase()}</span>
      </div>

      <button onClick={onOpenInbox} className={cn("w-full rounded-2xl p-4 text-left transition active:scale-[0.99]", count ? "bg-warning/15" : allClear ? "bg-success/12" : "bg-muted")}>
        <p className={cn("inline-flex items-center gap-1.5 text-sm font-700", count ? "text-[hsl(var(--warning))]" : allClear ? "text-success" : "text-muted-foreground")}>
          {count ? <Bolt className="h-4 w-4" /> : allClear ? <Sparkles className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
          {count ? `${count} ${count === 1 ? "lucru are" : "lucruri au"} nevoie de tine` : allClear ? "Ești la zi" : "Se încarcă…"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{count ? "Deschide inbox-ul și rezolvă-le rapid." : allClear ? "Nimic urgent. Bun moment de o pauză." : "Îți pregătim ziua."}</p>
      </button>

      {top.length > 0 && (
        <div className="space-y-2.5">
          {top.map((item) => <InboxCard key={item.id} item={item} busy={busy === item.id} onAct={item.act ? () => act(item) : undefined} />)}
          {count > top.length && <button onClick={onOpenInbox} className="w-full py-1 text-sm font-700 text-primary">Vezi toate ({count})</button>}
        </div>
      )}

      <button onClick={onOpenClients} className="flex w-full items-center justify-between rounded-2xl border border-border p-4 transition active:scale-[0.99]">
        <span className="text-sm text-muted-foreground">{clients.length} clienți · {eurK(spend)} ads · {roas.toFixed(1)}× ROAS</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}
