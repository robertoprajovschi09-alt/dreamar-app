import { type InboxItem, type Severity } from "@/lib/inbox";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DOT: Record<Severity, string> = {
  red: "bg-danger",
  amber: "bg-[hsl(var(--warning))]",
  green: "bg-success",
  grey: "bg-muted-foreground/40",
};

export function FeedRow({ item, onAct, onOpen, busy }: {
  item: InboxItem;
  onAct?: () => void;
  onOpen?: () => void;
  busy?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-2.5 py-3">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[item.severity])} />
      <item.icon className="h-[19px] w-[19px] shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-600">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      {item.act && onAct ? (
        <button onClick={(e) => { e.stopPropagation(); onAct(); }} disabled={busy} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-700 text-primary-foreground transition active:scale-95 disabled:opacity-60">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{item.actionLabel}
        </button>
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
  // Whole row is tappable for non-action items (open the client / inbox).
  return item.act ? inner : <button onClick={onOpen} className="w-full text-left transition active:bg-muted/40">{inner}</button>;
}
