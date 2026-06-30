import { useRef, useState } from "react";
import { useToast } from "@/lib/toast";
import { useInbox, type InboxItem } from "@/lib/inbox";
import { FeedRow } from "@/components/mobile/FeedRow";
import { SwipeRow } from "@/components/mobile/SwipeRow";
import { CheckCircle2, Loader2 } from "lucide-react";

export function MobileInbox() {
  const { push } = useToast();
  const { feed, loading } = useInbox();
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  async function act(item: InboxItem) {
    if (inFlight.current.has(item.id)) return; // guard double-fire (tap + swipe)
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
      <p className="font-display text-xl font-800">Inbox</p>
      {loading && feed.length === 0 ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : feed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-20 text-center">
          <CheckCircle2 className="h-9 w-9 text-success" />
          <p className="text-base font-700">Ești la zi ✨</p>
          <p className="text-sm text-muted-foreground">Nimic nu te așteaptă.</p>
        </div>
      ) : (
        <>
          {feed.some((i) => i.act) && <p className="-mb-1 text-[11px] text-muted-foreground">Glisează un card la dreapta ca să-l rezolvi rapid.</p>}
          <div className="space-y-2">
            {feed.map((item) =>
              item.act ? (
                <SwipeRow key={item.id} onSwipe={() => act(item)} label={item.actionLabel}>
                  <div className="rounded-2xl border border-border bg-card"><FeedRow item={item} busy={busy === item.id} onAct={() => act(item)} /></div>
                </SwipeRow>
              ) : (
                <div key={item.id} className="rounded-2xl border border-border bg-card"><FeedRow item={item} onOpen={() => undefined} /></div>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
