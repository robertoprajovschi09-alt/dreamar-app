import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} style={style} />;
}

export function SkeletonStat() {
  return (
    <Panel className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-20" />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </Panel>
  );
}

export function SkeletonCard() {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-md" />
        <Skeleton className="h-6 w-14 rounded-md" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="mx-auto h-5 w-10" />
            <Skeleton className="mx-auto h-2.5 w-12" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Panel className="p-2">
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-3 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-40" : "flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function SkeletonStatsRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonStat key={i} />)}
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <Panel className={cn("p-5", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-1.5 h-3 w-56" />
      <div className="mt-5 flex h-[220px] items-end gap-2">
        {[40, 65, 50, 80, 60, 90, 70, 95, 55, 85, 75, 100].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </Panel>
  );
}

/** A full-page loading state. Variants cover the common page shapes. */
export function PageSkeleton({ variant = "table" }: { variant?: "table" | "grid" | "dashboard" }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <SkeletonStatsRow />
      {variant === "table" && <SkeletonRows rows={7} cols={6} />}
      {variant === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {variant === "dashboard" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SkeletonChart className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      )}
    </div>
  );
}
