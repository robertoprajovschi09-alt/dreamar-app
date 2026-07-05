import { PageHeader, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { useKillList, type EvalCondition } from "@/lib/killlist";
import { formatCurrency, cn } from "@/lib/utils";
import { Check, Lock, Target, Trophy } from "lucide-react";

const lei = (n: number) => formatCurrency(n);
const condRight = (c: EvalCondition) => (c.kind === "consecutive_income" ? `${c.current} / ${c.target} luni` : `${lei(c.current)} / ${lei(c.target)}`);

export default function KillList() {
  const { loading, items, toggleManual } = useKillList();
  if (loading) return <PageSkeleton variant="dashboard" />;

  const done = items.filter((i) => i.unlocked).length;

  return (
    <>
      <PageHeader title="Kill List" subtitle={`${done} din ${items.length} deblocate`} />
      <div className="space-y-3">
        {items.map((item) => (
          <Panel key={item.id} className={cn("p-0 overflow-hidden", item.unlocked && "ring-1 ring-success/40")}>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.unlocked ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                {item.unlocked ? <Trophy className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <p className={cn("flex-1 font-display font-800", item.unlocked && "text-success")}>{item.title}</p>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-700", item.unlocked ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                {item.unlocked ? "Deblocat" : "Blocat"}
              </span>
            </div>

            <div className="space-y-2 border-t border-border/60 px-4 py-3">
              {item.conditions.map((c, i) => (
                <div key={i}>
                  {c.numeric ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={cn("font-600", c.met ? "text-success" : "text-muted-foreground")}>{c.met && <Check className="mr-1 inline h-3.5 w-3.5" />}{c.label}</span>
                        <span className={cn("font-700", c.met ? "text-success" : "text-muted-foreground")}>{condRight(c)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all", c.met ? "bg-success" : "bg-primary")} style={{ width: `${Math.round(c.progress * 100)}%` }} />
                      </div>
                    </>
                  ) : c.manualKey ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-600">{c.label}</span>
                      <button
                        onClick={() => toggleManual(item.id, c.manualKey!)}
                        className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-700 transition", c.met ? "bg-success/15 text-success" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                      >
                        {c.met ? <><Check className="h-3.5 w-3.5" /> Da</> : "Nu"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn("grid h-4 w-4 place-items-center rounded-full", c.met ? "bg-success/20 text-success" : "bg-muted text-muted-foreground")}>{c.met ? <Check className="h-3 w-3" /> : <Target className="h-3 w-3" />}</span>
                      <span className={cn("font-600", c.met ? "text-success" : "text-muted-foreground")}>{c.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
