import { useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { useInbox, type InboxItem } from "@/lib/inbox";
import { FeedRow } from "@/components/mobile/FeedRow";
import { Bolt, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MobileHome({ onOpenInbox, onOpenClient }: { onOpenInbox: () => void; onOpenClient: (name: string) => void }) {
  const { profile } = useWorkspace();
  const { push } = useToast();
  const { feed, urgent, review, count, loading } = useInbox();
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const firstName = profile.name.trim().split(/\s+/)[0] || "prietene";
  const clock = new Date();
  const timeLabel = `${cap(clock.toLocaleDateString("ro-RO", { weekday: "long" }))}, ${clock.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;
  const top = feed.slice(0, 6);
  const allClear = !loading && count === 0;
  const statusText = count
    ? [urgent ? `${urgent} ${urgent === 1 ? "urgent" : "urgente"}` : "", review ? `${review} de văzut` : ""].filter(Boolean).join(" · ")
    : allClear ? "Ești la zi" : "Se încarcă…";

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

      <div className={cn("flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-700", count ? "bg-warning/15 text-[hsl(var(--warning))]" : allClear ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
        {count ? <Bolt className="h-4 w-4" /> : allClear ? <Sparkles className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {statusText}
      </div>

      {loading && top.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn("flex items-center gap-3 px-2.5 py-3.5", i > 0 && "border-t border-border/60")}>
              <span className="h-2 w-2 shrink-0 rounded-full bg-muted" />
              <span className="h-5 w-5 shrink-0 rounded bg-muted" />
              <span className="h-3 flex-1 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <Sparkles className="h-8 w-8 text-success" />
          <p className="text-sm font-700">Ești la zi ✨</p>
          <p className="text-xs text-muted-foreground">Nimic urgent. Bun moment de o pauză.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {top.map((item, i) => (
            <div key={item.id} className={cn(i > 0 && "border-t border-border/60")}>
              <FeedRow item={item} busy={busy === item.id} onAct={item.act ? () => act(item) : undefined} onOpen={() => onOpenClient(item.clientName)} />
            </div>
          ))}
          {feed.length > top.length && <button onClick={onOpenInbox} className="w-full border-t border-border/60 py-2.5 text-sm font-700 text-primary">Vezi tot ({feed.length})</button>}
        </div>
      )}
    </div>
  );
}
