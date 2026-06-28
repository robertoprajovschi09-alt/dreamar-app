import { StatCard } from "@/components/StatCard";
import { AreaTrend } from "@/components/charts";
import { growthTrend } from "@/data/sample";
import { CalendarCheck2, Users, Sparkles, AlertTriangle } from "lucide-react";

// A framed, real-component preview of the agency dashboard for the landing page.
export function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-600/20 via-indigo-500/10 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-indigo-950/20">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="ml-3 flex-1 rounded-md bg-background/60 px-3 py-1 text-center text-[11px] text-muted-foreground">
            app.drea.mar/dashboard
          </span>
        </div>

        <div className="grid grid-cols-[140px_1fr] text-left">
          {/* Mini sidebar */}
          <div className="hidden border-r border-border p-3 sm:block">
            <div className="flex items-center gap-2 px-1 pb-3">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 text-[11px] font-800 text-white">d</span>
              <span className="text-xs font-800">drea.mar</span>
            </div>
            {["Dashboard", "Clients", "Calendar", "Videos", "Reports", "AI Room"].map((l, i) => (
              <div key={l} className={`mb-0.5 rounded-md px-2 py-1.5 text-[11px] font-600 ${i === 0 ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                {l}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard label="Active Clients" value="12" trend={9.1} icon={Users} spark={[6, 7, 8, 9, 10, 12]} />
              <StatCard label="Scheduled" value="38" trend={12.4} icon={CalendarCheck2} tone="info" spark={[20, 24, 28, 34, 38]} />
              <StatCard label="Avg Health" value="74" trend={6} icon={Sparkles} tone="success" spark={[60, 66, 70, 72, 74]} />
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-700">Engagement & Growth</p>
                <span className="flex items-center gap-1 text-[10px] text-success"><AlertTriangle className="h-3 w-3" /> 3 AI alerts</span>
              </div>
              <AreaTrend data={growthTrend} keys={[{ key: "reach", name: "Reach" }, { key: "followers", name: "Followers" }]} height={130} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
