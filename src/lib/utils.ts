import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// All money in the app is Romanian lei. Formats "3.000 lei" (ro-RO grouping).
export function formatCurrency(value: number) {
  const n = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
  return `${n} lei`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

// Build a CSV from a header + rows and trigger a browser download.
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (s: string | number) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// "Remember last used" — the most repeated dropdown in the app is the client
// picker. Composers preselect the remembered client instead of clients[0].
const LAST_CLIENT_KEY = "dreamar-last-client";
export function rememberClient(id: string) {
  try { localStorage.setItem(LAST_CLIENT_KEY, id); } catch { /* private mode */ }
}
export function lastClientId(clients: { id: string }[]): string {
  try {
    const saved = localStorage.getItem(LAST_CLIENT_KEY);
    if (saved && clients.some((c) => c.id === saved)) return saved;
  } catch { /* private mode */ }
  return clients[0]?.id ?? "";
}
