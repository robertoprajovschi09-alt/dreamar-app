import { useRef, useState, type ReactNode } from "react";
import { useToast } from "@/lib/toast";
import { useInbox, type InboxItem } from "@/lib/inbox";
import { InboxCard } from "@/components/mobile/InboxCard";
import { SwipeRow } from "@/components/mobile/SwipeRow";
import { CheckCircle2, Loader2 } from "lucide-react";

export function MobileInbox() {
  const { push } = useToast();
  const { now, later, loading } = useInbox();
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

  const render = (item: InboxItem) =>
    item.act ? (
      <SwipeRow key={item.id} onSwipe={() => act(item)} label={item.actionLabel}>
        <InboxCard item={item} busy={busy === item.id} onAct={() => act(item)} />
      </SwipeRow>
    ) : (
      <InboxCard key={item.id} item={item} />
    );

  const hasAny = now.length + later.length > 0;

  return (
    <div className="space-y-5">
      <p className="font-display text-xl font-800">Inbox</p>
      {loading && !hasAny ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !hasAny ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-20 text-center">
          <CheckCircle2 className="h-9 w-9 text-success" />
          <p className="text-base font-700">Ești la zi ✨</p>
          <p className="text-sm text-muted-foreground">Nimic nu te așteaptă.</p>
        </div>
      ) : (
        <>
          {now.length > 0 && (
            <Section title="Acum">
              {now.some((i) => i.act) && <p className="-mt-1 text-[11px] text-muted-foreground">Glisează un card la dreapta ca să-l rezolvi rapid.</p>}
              {now.map(render)}
            </Section>
          )}
          {later.length > 0 && <Section title="Mai târziu">{later.map(render)}</Section>}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
