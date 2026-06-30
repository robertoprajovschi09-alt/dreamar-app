import { type InboxItem } from "@/lib/inbox";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE: Record<InboxItem["tone"], string> = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/15 text-[hsl(var(--warning))]",
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
};

export function InboxCard({ item, onAct, busy }: { item: InboxItem; onAct?: () => void; busy?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", TONE[item.tone])}>
        <item.icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-700">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      {item.act && onAct && (
        <button onClick={onAct} disabled={busy} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-700 text-primary-foreground transition active:scale-95 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{item.actionLabel}
        </button>
      )}
    </div>
  );
}
