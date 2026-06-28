import { Panel } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

export function NicheKpis({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((k) => (
        <Panel key={k.label} className="p-5">
          <p className="text-xs font-600 text-muted-foreground">{k.label}</p>
          <p className="mt-2 font-display text-2xl font-800 tracking-tight">{k.value}</p>
          {k.sub && <p className="mt-1 text-xs text-success">{k.sub}</p>}
        </Panel>
      ))}
    </div>
  );
}

export function NicheTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-display text-sm font-800 uppercase tracking-wide text-muted-foreground">{children}</h2>
    </div>
  );
}

export function IntentRow({ text, handle }: { text: string; handle?: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-sm leading-snug">{text}</p>
      {handle && <p className="mt-1 text-xs text-muted-foreground">{handle}</p>}
    </div>
  );
}
