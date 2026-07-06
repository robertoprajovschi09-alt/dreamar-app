import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { formatCurrency } from "./utils";

/*
 * "Kill List" — milestones that unlock themselves when their conditions are met.
 * Conditions read live from the money layer (current-month income, Tampon,
 * consecutive months over a threshold) or are manual toggles. Unlock is STICKY:
 * once achieved it stays unlocked even if the numbers later dip.
 *
 * income(month) = sum of that month's `collections` amounts that are marked
 * Încasat (collected) — money actually in the bank, NOT the invoiced total.
 */

export type Condition =
  | { kind: "income_month"; threshold: number }
  | { kind: "tampon"; threshold: number }
  | { kind: "consecutive_income"; threshold: number; months: number }
  | { kind: "manual"; key: string; label: string }
  | { kind: "item"; itemId: string };

export type KillItem = { id: string; title: string; conditions: Condition[] };

export const KILL_LIST: KillItem[] = [
  { id: "primul-client-constanta", title: "Primul client Constanța", conditions: [{ kind: "manual", key: "done", label: "Am primul client din Constanța" }] },
  { id: "cashflow-4000", title: "Încasări 4.000 euro pe lună", conditions: [{ kind: "income_month", threshold: 21000 }] },
  { id: "iphone-17", title: "iPhone 17 Pro Max nr. 1", conditions: [{ kind: "item", itemId: "primul-client-constanta" }, { kind: "tampon", threshold: 8000 }] },
  { id: "iphone-2-camera", title: "iPhone nr. 2 + cameră", conditions: [{ kind: "consecutive_income", threshold: 21000, months: 2 }] },
  { id: "masina-15000", title: "Mașină, buget 15.000 euro", conditions: [{ kind: "manual", key: "permis", label: "Permis luat" }, { kind: "consecutive_income", threshold: 21000, months: 3 }, { kind: "tampon", threshold: 15000 }] },
  { id: "drum-7000", title: "Drum spre 7.000 euro", conditions: [{ kind: "income_month", threshold: 36700 }] },
];

export type EvalCondition = { kind: Condition["kind"]; label: string; met: boolean; numeric: boolean; progress: number; current: number; target: number; itemId?: string; manualKey?: string };
export type EvalItem = { id: string; title: string; conditions: EvalCondition[]; unlocked: boolean };
type ItemState = { unlocked?: boolean; manual?: Record<string, boolean> };
type State = Record<string, ItemState>;
// Custom objectives (added by the Strateg or by hand) live in the same persisted
// blob under a reserved key, so no data migration is needed.
export type CustomKill = { id: string; title: string; note: string };
const CUSTOM_KEY = "_customItems";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function splitState(raw: any): { state: State; custom: CustomKill[] } {
  if (!raw || typeof raw !== "object") return { state: {}, custom: [] };
  const { [CUSTOM_KEY]: custom, ...state } = raw;
  return { state: state as State, custom: Array.isArray(custom) ? custom : [] };
}

const pad = (n: number) => String(n).padStart(2, "0");
const curMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
function shiftMonthKey(base: string, back: number) {
  const [y, m] = base.split("-").map(Number);
  const d = new Date(y, m - 1 - back, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
const DEMO_KEY = "dreamar-killlist-demo";
const lei = (n: number) => formatCurrency(n);

export function useKillList() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const [loading, setLoading] = useState(live);
  const [state, setState] = useState<State>({});
  const [custom, setCustom] = useState<CustomKill[]>([]);
  const [tampon, setTampon] = useState(0);
  const [incomeByMonth, setIncomeByMonth] = useState<Record<string, number>>({});
  const stateRef = useRef(state); stateRef.current = state;
  const customRef = useRef(custom); customRef.current = custom;

  const reload = useCallback(async () => {
    if (!live) {
      try { const s = splitState(JSON.parse(localStorage.getItem(DEMO_KEY) || "{}")); setState(s.state); setCustom(s.custom); } catch { setState({}); setCustom([]); }
      try { const s = JSON.parse(localStorage.getItem("dreamar-money-settings-demo") || "{}"); setTampon(Number(s.tampon) || 0); } catch { setTampon(0); }
      try {
        const cols = JSON.parse(localStorage.getItem("dreamar-money-collections-demo") || "[]") as { amount: number; month?: string; collected?: boolean }[];
        const by: Record<string, number> = {};
        // Income = money actually COLLECTED (marked Încasat), not invoiced.
        cols.forEach((c) => { const k = (c.month ?? "").slice(0, 7); if (k && c.collected) by[k] = (by[k] ?? 0) + Number(c.amount || 0); });
        setIncomeByMonth(by);
      } catch { setIncomeByMonth({}); }
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId) return;
    setLoading(true);
    const [st, ms, col] = await Promise.all([
      supabase.from("kill_list_state").select("state").eq("agency_id", agencyId).maybeSingle(),
      supabase.from("money_settings").select("tampon").eq("agency_id", agencyId).maybeSingle(),
      supabase.from("collections").select("period_month, amount, collected").eq("agency_id", agencyId),
    ]);
    const parsed = splitState(st.data?.state);
    setState(parsed.state); setCustom(parsed.custom);
    setTampon(Number(ms.data?.tampon) || 0);
    const by: Record<string, number> = {};
    // Income = money actually COLLECTED (marked Încasat), not invoiced.
    (col.data ?? []).forEach((c) => { const k = String(c.period_month).slice(0, 7); if (c.collected) by[k] = (by[k] ?? 0) + Number(c.amount || 0); });
    setIncomeByMonth(by);
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const persist = useCallback((next: State, nextCustom?: CustomKill[]) => {
    const blob = { ...next, [CUSTOM_KEY]: nextCustom ?? customRef.current };
    if (live && supabase && agencyId) void supabase.from("kill_list_state").upsert({ agency_id: agencyId, state: blob }, { onConflict: "agency_id" });
    else try { localStorage.setItem(DEMO_KEY, JSON.stringify(blob)); } catch { /* private mode */ }
  }, [live, agencyId]);

  // A custom objective = a manual condition; unlocks when you tick it, like the rest.
  const addCustomItem = useCallback((title: string, note: string) => {
    const item: CustomKill = { id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, title: title.trim() || "Obiectiv", note: note.trim() };
    setCustom((prev) => { const next = [...prev, item]; persist(stateRef.current, next); return next; });
    return item;
  }, [persist]);

  const consecutive = useCallback((threshold: number) => {
    const base = curMonthKey();
    let count = 0;
    for (let i = 0; i < 60; i++) { if ((incomeByMonth[shiftMonthKey(base, i)] ?? 0) >= threshold) count++; else break; }
    return count;
  }, [incomeByMonth]);

  const evaluated = useMemo(() => {
    const income = incomeByMonth[curMonthKey()] ?? 0;
    const effective: Record<string, boolean> = {};
    const allItems: KillItem[] = [
      ...KILL_LIST,
      ...custom.map((c) => ({ id: c.id, title: c.title, conditions: [{ kind: "manual", key: "done", label: c.note || "Bifează când e gata" } as Condition] })),
    ];
    const items: (EvalItem & { currentlyMet: boolean })[] = allItems.map((item) => {
      const conditions: EvalCondition[] = item.conditions.map((c) => {
        if (c.kind === "income_month") { const p = c.threshold > 0 ? Math.min(1, income / c.threshold) : 1; return { kind: c.kind, label: `Încasări luna asta ≥ ${lei(c.threshold)}`, met: income >= c.threshold, numeric: true, progress: p, current: income, target: c.threshold }; }
        if (c.kind === "tampon") { const p = c.threshold > 0 ? Math.min(1, tampon / c.threshold) : 1; return { kind: c.kind, label: `Rezervă ≥ ${lei(c.threshold)}`, met: tampon >= c.threshold, numeric: true, progress: p, current: tampon, target: c.threshold }; }
        if (c.kind === "consecutive_income") { const n = consecutive(c.threshold); const p = c.months > 0 ? Math.min(1, n / c.months) : 1; return { kind: c.kind, label: `${c.months} luni consecutive ≥ ${lei(c.threshold)}`, met: n >= c.months, numeric: true, progress: p, current: n, target: c.months }; }
        if (c.kind === "manual") { const on = !!state[item.id]?.manual?.[c.key]; return { kind: c.kind, label: c.label, met: on, numeric: false, progress: on ? 1 : 0, current: on ? 1 : 0, target: 1, manualKey: c.key }; }
        // item dependency
        const dep = allItems.find((k) => k.id === c.itemId);
        const on = !!effective[c.itemId];
        return { kind: c.kind, label: `„${dep?.title ?? "Item"}" deblocat`, met: on, numeric: false, progress: on ? 1 : 0, current: on ? 1 : 0, target: 1, itemId: c.itemId };
      });
      const currentlyMet = conditions.every((c) => c.met);
      const unlocked = !!state[item.id]?.unlocked || currentlyMet;
      effective[item.id] = unlocked;
      return { id: item.id, title: item.title, conditions, unlocked, currentlyMet };
    });
    return items;
  }, [incomeByMonth, tampon, state, custom, consecutive]);

  // Sticky unlock: persist any item that just met all conditions.
  useEffect(() => {
    const toFlip = evaluated.filter((it) => it.currentlyMet && !state[it.id]?.unlocked);
    if (!toFlip.length) return;
    setState((prev) => {
      const next = { ...prev };
      toFlip.forEach((it) => { next[it.id] = { ...next[it.id], unlocked: true }; });
      persist(next);
      return next;
    });
  }, [evaluated, state, persist]);

  const toggleManual = useCallback((itemId: string, key: string) => {
    setState((prev) => {
      const cur = prev[itemId] ?? {};
      const next = { ...prev, [itemId]: { ...cur, manual: { ...(cur.manual ?? {}), [key]: !cur.manual?.[key] } } };
      persist(next);
      return next;
    });
  }, [persist]);

  const items: EvalItem[] = evaluated.map(({ currentlyMet: _c, ...it }) => it);
  return { loading, items, toggleManual, addCustomItem };
}
