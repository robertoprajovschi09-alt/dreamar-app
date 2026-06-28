import { useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/toast";
import { useDateRange } from "@/lib/daterange";
import { Button, Input } from "@/components/ui";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DateRangeMenu() {
  const { push } = useToast();
  const { ranges, current, setRange, applyCustom } = useDateRange();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-06-30");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-600 text-muted-foreground transition hover:text-foreground sm:flex", open && "text-foreground")}
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden lg:inline">{current.range}</span>
        <span className="lg:hidden">{current.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 animate-scale-in panel overflow-hidden p-1.5">
          <p className="px-2.5 py-1.5 text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Intervale rapide</p>
          {ranges.map((r) => (
            <button
              key={r.id}
              onClick={() => { setRange(r.id); setOpen(false); push({ tone: "info", title: "Interval de date actualizat", description: `${r.label} · ${r.range}` }); }}
              className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-600 transition", current.id === r.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <span>{r.label}</span>
              {current.id === r.id ? <Check className="h-4 w-4" /> : <span className="text-[11px] text-muted-foreground/70">{r.range}</span>}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <p className="px-2.5 py-1.5 text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Personalizat</p>
          <div className="flex items-center gap-2 px-2.5 pb-1">
            <Input type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <Input type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="px-1.5 pb-1 pt-2">
            <Button variant="primary" size="sm" className="w-full" onClick={() => { applyCustom(from, to); setOpen(false); push({ tone: "info", title: "Interval personalizat aplicat", description: `${from} → ${to}` }); }}>Aplică intervalul</Button>
          </div>
        </div>
      )}
    </div>
  );
}
