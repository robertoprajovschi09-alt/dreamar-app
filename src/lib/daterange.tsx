import { createContext, useContext, useState, type ReactNode } from "react";

export type DateRange = { id: string; label: string; range: string; startDay: number; endDay: number };

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

// Ranges are computed from the real "now" at app open (not a saved value), so the
// header always reflects the current calendar month.
function computeRanges(now = new Date()): DateRange[] {
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const lbl = (day: number, m = mo) => `${day} ${MONTHS[m]} ${y}`;
  const from7 = Math.max(1, d - 6);
  return [
    { id: "today", label: "Astăzi", range: lbl(d), startDay: d, endDay: d },
    { id: "7d", label: "Ultimele 7 zile", range: `${from7} - ${lbl(d)}`, startDay: from7, endDay: d },
    { id: "30d", label: "Ultimele 30 de zile", range: `1 - ${lbl(daysInMonth)}`, startDay: 1, endDay: daysInMonth },
    { id: "month", label: "Luna aceasta", range: `1 - ${lbl(daysInMonth)}`, startDay: 1, endDay: daysInMonth },
    { id: "quarter", label: "Trimestrul acesta", range: `1 ${MONTHS[mo - (mo % 3)]} - ${lbl(daysInMonth)}`, startDay: 1, endDay: daysInMonth },
    { id: "ytd", label: "De la începutul anului", range: `1 ${MONTHS[0]} - ${lbl(d)}`, startDay: 1, endDay: daysInMonth },
  ];
}

export const RANGES: DateRange[] = computeRanges();

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
      range: `${fmt(startISO)} - ${fmt(endISO)}`,
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
