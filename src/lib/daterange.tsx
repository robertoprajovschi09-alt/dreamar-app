import { createContext, useContext, useState, type ReactNode } from "react";

export type DateRange = { id: string; label: string; range: string; startDay: number; endDay: number };

// June 2026 is the prototype's "current month"; ranges map onto day-of-month bounds
// so the sample data (dated within June) visibly filters.
export const RANGES: DateRange[] = [
  { id: "today", label: "Astăzi", range: "20 iun 2026", startDay: 20, endDay: 20 },
  { id: "7d", label: "Ultimele 7 zile", range: "14 — 20 iun 2026", startDay: 14, endDay: 20 },
  { id: "30d", label: "Ultimele 30 de zile", range: "21 mai — 20 iun 2026", startDay: 1, endDay: 30 },
  { id: "month", label: "Luna aceasta", range: "1 — 30 iun 2026", startDay: 1, endDay: 30 },
  { id: "quarter", label: "Trimestrul acesta", range: "1 apr — 30 iun 2026", startDay: 1, endDay: 30 },
  { id: "ytd", label: "De la începutul anului", range: "1 ian — 20 iun 2026", startDay: 1, endDay: 30 },
];

type Ctx = {
  ranges: DateRange[];
  current: DateRange;
  setRange: (id: string) => void;
  applyCustom: (startISO: string, endISO: string) => void;
  inRange: (day: number) => boolean;
  parseDay: (label: string) => number;
};

const DateCtx = createContext<Ctx | null>(null);

// "18 Jun" -> 18
function parseDay(label: string): number {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// "2026-06-14" -> 14 (day of month). The prototype data lives in June 2026.
function dayFromISO(iso: string): number {
  const m = iso.match(/^\d{4}-\d{2}-(\d{2})$/);
  return m ? parseInt(m[1], 10) : 1;
}
function fmt(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const months = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
  return m ? `${parseInt(m[2], 10)} ${months[parseInt(m[1], 10) - 1]} 2026` : iso;
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState("month");
  const [custom, setCustom] = useState<DateRange | null>(null);

  const current = custom ?? RANGES.find((r) => r.id === id) ?? RANGES[3];
  const inRange = (day: number) => day >= current.startDay && day <= current.endDay;

  const setRange = (next: string) => { setCustom(null); setId(next); };
  const applyCustom = (startISO: string, endISO: string) => {
    const startDay = dayFromISO(startISO);
    const endDay = dayFromISO(endISO);
    setCustom({
      id: "custom",
      label: "Personalizat",
      range: `${fmt(startISO)} — ${fmt(endISO)}`,
      startDay: Math.min(startDay, endDay),
      endDay: Math.max(startDay, endDay),
    });
  };

  return (
    <DateCtx.Provider value={{ ranges: RANGES, current, setRange, applyCustom, inRange, parseDay }}>
      {children}
    </DateCtx.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateCtx);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
