import { Panel, TrendChip } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  trend,
  sub,
  icon: Icon,
  spark,
  tone = "primary",
}: {
  label: string;
  value: string;
  trend?: number;
  sub?: string;
  icon?: LucideIcon;
  spark?: number[];
  tone?: "primary" | "info" | "warning" | "success" | "danger";
}) {
  const toneColor: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    info: "text-info bg-info/10",
    warning: "text-[hsl(var(--warning))] bg-warning/15",
    success: "text-success bg-success/10",
    danger: "text-danger bg-danger/10",
  };
  return (
    <Panel className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-600 text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-800 tracking-tight">{value}</p>
        </div>
        {Icon && (
          <span className={cn("grid h-10 w-10 place-items-center rounded-xl", toneColor[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {trend != null && trend !== 0 && <TrendChip value={trend} />}
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
        {spark && (
          <div className="h-9 w-24 shrink-0">
            <Sparkline data={spark} tone={tone === "warning" ? "#f5a524" : undefined} />
          </div>
        )}
      </div>
    </Panel>
  );
}
