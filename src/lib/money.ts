import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";

/*
 * "Bani" — the money layer. Live-backed by money_settings / collections /
 * yanis_deals / tampon_entries (agency-scoped RLS); demo mode persists to
 * localStorage under the same shapes.
 */

export type MoneySettings = { personalFix: number; operational: number; tampon: number; operationalBurn: number };
export type Collection = { id: string; clientId: string | null; amount: number; dueDay: number; collected: boolean };
export type OverdueCollection = Collection & { daysOverdue: number };
export type YanisDeal = { id: string; date: string; car: string; clipLink: string; sold: boolean; commission: number; markup: number; paid: boolean };
export type YanisDealInit = { date?: string; car?: string; commission?: number; sold?: boolean; markup?: number; clipLink?: string; paid?: boolean };
export type TamponEntry = { id: string; date: string; description: string; amount: number };
export type InvoiceStatus = "not_issued" | "issued" | "collected";
export type Invoice = { id: string; clientId: string; amount: number; status: InvoiceStatus };

const DEFAULT_SETTINGS: MoneySettings = { personalFix: 2150, operational: 0, tampon: 0, operationalBurn: 0 };

const pad = (n: number) => String(n).padStart(2, "0");
const monthStartISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const K = {
  settings: "dreamar-money-settings-demo",
  collections: "dreamar-money-collections-demo",
  deals: "dreamar-money-deals-demo",
  tampon: "dreamar-money-tampon-demo",
  invoices: "dreamar-money-invoices-demo",
};
function lsGet<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function lsSet(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }
let seq = 0;
const newId = () => `demo-${++seq}-${Date.now()}`;

// Toast push signature (kept local so money.ts stays free of React-context deps).
type ToastPush = (t: { tone: "success" | "info" | "warning" | "danger"; title: string; description?: string; action?: { label: string; run: () => void } }) => void;
// Deferred-delete window; longer than the toast action lifetime so the real
// DELETE only fires once "Anulează" is gone.
const UNDO_MS = 5500;
function insertAt<T>(arr: T[], index: number, item: T): T[] {
  const next = arr.slice();
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
}

export function useMoney() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const month = monthStartISO();

  const [loading, setLoading] = useState(live);
  const [settings, setSettings] = useState<MoneySettings>(DEFAULT_SETTINGS);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [deals, setDeals] = useState<YanisDeal[]>([]);
  const [tampon, setTampon] = useState<TamponEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const reload = useCallback(async () => {
    if (!live) {
      setSettings(lsGet(K.settings, DEFAULT_SETTINGS));
      // Demo collections carry a `month` tag; keep only the current month.
      const allCol = lsGet<(Collection & { month?: string })[]>(K.collections, []);
      setCollections(allCol.filter((c) => c.month === month).map(({ month: _m, ...c }) => c));
      setDeals(lsGet<YanisDeal[]>(K.deals, []));
      setTampon(lsGet<TamponEntry[]>(K.tampon, []));
      const allInv = lsGet<(Invoice & { month?: string })[]>(K.invoices, []);
      setInvoices(allInv.filter((i) => i.month === month).map(({ month: _m, ...i }) => i));
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId) return;
    setLoading(true);
    const [s, c, d, t, inv] = await Promise.all([
      supabase.from("money_settings").select("personal_fix, operational, tampon, operational_burn").eq("agency_id", agencyId).maybeSingle(),
      supabase.from("collections").select("id, client_id, amount, due_day, collected").eq("agency_id", agencyId).eq("period_month", month).order("due_day"),
      supabase.from("yanis_deals").select("id, deal_date, car, clip_link, sold, commission, markup, paid").eq("agency_id", agencyId).order("deal_date", { ascending: false }),
      supabase.from("tampon_entries").select("id, entry_date, description, amount").eq("agency_id", agencyId).order("created_at", { ascending: false }),
      supabase.from("invoices").select("id, client_id, amount, status").eq("agency_id", agencyId).eq("period_month", month),
    ]);
    if (s.data) setSettings({ personalFix: Number(s.data.personal_fix), operational: Number(s.data.operational), tampon: Number(s.data.tampon), operationalBurn: Number(s.data.operational_burn) });
    else { await supabase.from("money_settings").insert({ agency_id: agencyId, personal_fix: DEFAULT_SETTINGS.personalFix }); setSettings(DEFAULT_SETTINGS); }
    setCollections((c.data ?? []).map((r) => ({ id: r.id, clientId: r.client_id, amount: Number(r.amount), dueDay: r.due_day, collected: r.collected })));
    setDeals((d.data ?? []).map((r) => ({ id: r.id, date: r.deal_date, car: r.car, clipLink: r.clip_link ?? "", sold: r.sold, commission: Number(r.commission), markup: Number(r.markup), paid: r.paid })));
    setTampon((t.data ?? []).map((r) => ({ id: r.id, date: r.entry_date, description: r.description, amount: Number(r.amount) })));
    setInvoices((inv.data ?? []).map((r) => ({ id: r.id, clientId: r.client_id, amount: Number(r.amount), status: r.status as InvoiceStatus })));
    setLoading(false);
  }, [live, agencyId, month]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  // ── Settings ───────────────────────────────────────────────────────────────
  const saveSettings = useCallback(async (patch: Partial<MoneySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (!live) lsSet(K.settings, next);
      return next;
    });
    if (live && supabase && agencyId) {
      const db: Record<string, number> = {};
      if (patch.personalFix !== undefined) db.personal_fix = patch.personalFix;
      if (patch.operational !== undefined) db.operational = patch.operational;
      if (patch.tampon !== undefined) db.tampon = patch.tampon;
      if (patch.operationalBurn !== undefined) db.operational_burn = patch.operationalBurn;
      await supabase.from("money_settings").upsert({ agency_id: agencyId, ...db }, { onConflict: "agency_id" });
    }
  }, [live, agencyId]);

  // ── Collections ──────────────────────────────────────────────────────────────
  const persistDemoCollections = (rows: Collection[]) => {
    const others = lsGet<(Collection & { month?: string })[]>(K.collections, []).filter((c) => c.month !== month);
    lsSet(K.collections, [...others, ...rows.map((r) => ({ ...r, month }))]);
  };
  const addCollection = useCallback(async (clientId: string | null, amount: number, dueDay: number) => {
    if (!live || !supabase || !agencyId) {
      const row: Collection = { id: newId(), clientId, amount, dueDay, collected: false };
      setCollections((prev) => { const next = [...prev, row]; persistDemoCollections(next); return next; });
      return;
    }
    const { data } = await supabase.from("collections").insert({ agency_id: agencyId, client_id: clientId, period_month: month, amount, due_day: dueDay }).select("id, client_id, amount, due_day, collected").single();
    if (data) setCollections((prev) => [...prev, { id: data.id, clientId: data.client_id, amount: Number(data.amount), dueDay: data.due_day, collected: data.collected }]);
  }, [live, agencyId, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const updateCollection = useCallback(async (id: string, patch: Partial<Pick<Collection, "amount" | "dueDay" | "collected">>) => {
    setCollections((prev) => { const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c)); if (!live) persistDemoCollections(next); return next; });
    if (live && supabase) {
      const db: Record<string, unknown> = {};
      if (patch.amount !== undefined) db.amount = patch.amount;
      if (patch.dueDay !== undefined) db.due_day = patch.dueDay;
      if (patch.collected !== undefined) db.collected = patch.collected;
      await supabase.from("collections").update(db).eq("id", id);
    }
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  // Optimistic delete + "Anulează" toast; the real DELETE (and demo persist) run
  // only once the window passes. Restores the row on undo or on a failed delete.
  const removeCollection = useCallback((id: string, push: ToastPush) => {
    const at = collections.findIndex((c) => c.id === id);
    const item = collections[at];
    if (!item) return;
    setCollections((prev) => prev.filter((c) => c.id !== id));
    let cancelled = false;
    const restore = () => setCollections((prev) => insertAt(prev, at, item));
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (live && supabase) {
        const { error } = await supabase.from("collections").delete().eq("id", id);
        if (error) { restore(); push({ tone: "danger", title: "Nu s-a putut șterge. A revenit." }); return; }
      } else {
        setCollections((prev) => { persistDemoCollections(prev); return prev; });
      }
    }, UNDO_MS);
    push({ tone: "warning", title: "Încasare ștearsă", action: { label: "Anulează", run: () => { cancelled = true; window.clearTimeout(timer); restore(); } } });
  }, [collections, live]); // eslint-disable-line react-hooks/exhaustive-deps
  // Add one row per retainer client that has no row this month yet.
  const generateFromRetainers = useCallback(async (clients: { id: string; billingType?: string; retainer: number }[]) => {
    const have = new Set(collections.map((c) => c.clientId));
    const targets = clients.filter((c) => (c.billingType ?? "retainer") === "retainer" && c.retainer > 0 && !have.has(c.id));
    for (const c of targets) await addCollection(c.id, c.retainer, 1);
  }, [collections, addCollection]);

  // ── Yanis deals ──────────────────────────────────────────────────────────────
  const addDeal = useCallback(async (init?: YanisDealInit) => {
    const base = { date: init?.date || todayISO(), car: init?.car ?? "", clipLink: init?.clipLink ?? "", sold: init?.sold ?? false, commission: init?.commission ?? 0, markup: init?.markup ?? 0, paid: init?.paid ?? false };
    if (!live || !supabase || !agencyId) {
      const row: YanisDeal = { id: newId(), ...base };
      setDeals((prev) => { const next = [row, ...prev]; lsSet(K.deals, next); return next; });
      return;
    }
    const { data } = await supabase.from("yanis_deals").insert({ agency_id: agencyId, deal_date: base.date, car: base.car, clip_link: base.clipLink || null, sold: base.sold, commission: base.commission, markup: base.markup, paid: base.paid }).select("id, deal_date, car, clip_link, sold, commission, markup, paid").single();
    if (data) setDeals((prev) => [{ id: data.id, date: data.deal_date, car: data.car, clipLink: data.clip_link ?? "", sold: data.sold, commission: Number(data.commission), markup: Number(data.markup), paid: data.paid }, ...prev]);
  }, [live, agencyId]);
  const updateDeal = useCallback(async (id: string, patch: Partial<Omit<YanisDeal, "id">>) => {
    setDeals((prev) => { const next = prev.map((d) => (d.id === id ? { ...d, ...patch } : d)); if (!live) lsSet(K.deals, next); return next; });
    if (live && supabase) {
      const db: Record<string, unknown> = {};
      if (patch.date !== undefined) db.deal_date = patch.date;
      if (patch.car !== undefined) db.car = patch.car;
      if (patch.clipLink !== undefined) db.clip_link = patch.clipLink || null;
      if (patch.sold !== undefined) db.sold = patch.sold;
      if (patch.commission !== undefined) db.commission = patch.commission;
      if (patch.markup !== undefined) db.markup = patch.markup;
      if (patch.paid !== undefined) db.paid = patch.paid;
      await supabase.from("yanis_deals").update(db).eq("id", id);
    }
  }, [live]);
  const removeDeal = useCallback((id: string, push: ToastPush) => {
    const at = deals.findIndex((d) => d.id === id);
    const item = deals[at];
    if (!item) return;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    let cancelled = false;
    const restore = () => setDeals((prev) => insertAt(prev, at, item));
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (live && supabase) {
        const { error } = await supabase.from("yanis_deals").delete().eq("id", id);
        if (error) { restore(); push({ tone: "danger", title: "Nu s-a putut șterge. A revenit." }); return; }
      } else {
        setDeals((prev) => { lsSet(K.deals, prev); return prev; });
      }
    }, UNDO_MS);
    push({ tone: "warning", title: "Rând șters", action: { label: "Anulează", run: () => { cancelled = true; window.clearTimeout(timer); restore(); } } });
  }, [deals, live]);

  // ── Tampon entries (also adjust the tampon balance) ──────────────────────────
  const addTamponEntry = useCallback(async (description: string, amount: number) => {
    const date = todayISO();
    if (!live || !supabase || !agencyId) {
      const row: TamponEntry = { id: newId(), date, description, amount };
      setTampon((prev) => { const next = [row, ...prev]; lsSet(K.tampon, next); return next; });
    } else {
      const { data } = await supabase.from("tampon_entries").insert({ agency_id: agencyId, description, amount }).select("id, entry_date, description, amount").single();
      if (data) setTampon((prev) => [{ id: data.id, date: data.entry_date, description: data.description, amount: Number(data.amount) }, ...prev]);
    }
    await saveSettings({ tampon: settings.tampon + amount });
  }, [live, agencyId, settings.tampon, saveSettings]);
  const removeTamponEntry = useCallback((id: string, push: ToastPush) => {
    const at = tampon.findIndex((t) => t.id === id);
    const item = tampon[at];
    if (!item) return;
    const balanceBefore = settings.tampon;
    // Hide the row and adjust the balance instantly so the UI stays consistent.
    setTampon((prev) => prev.filter((t) => t.id !== id));
    void saveSettings({ tampon: balanceBefore - item.amount });
    let cancelled = false;
    const restore = () => { setTampon((prev) => insertAt(prev, at, item)); void saveSettings({ tampon: balanceBefore }); };
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (live && supabase) {
        const { error } = await supabase.from("tampon_entries").delete().eq("id", id);
        if (error) { restore(); push({ tone: "danger", title: "Nu s-a putut șterge. A revenit." }); return; }
      } else {
        setTampon((prev) => { lsSet(K.tampon, prev); return prev; });
      }
    }, UNDO_MS);
    push({ tone: "warning", title: "Intrare ștearsă", action: { label: "Anulează", run: () => { cancelled = true; window.clearTimeout(timer); restore(); } } });
  }, [live, tampon, settings.tampon, saveSettings]);

  // ── Invoices (data prep only — the firm issues the fiscal invoice elsewhere) ──
  const persistDemoInvoices = (rows: Invoice[]) => {
    const others = lsGet<(Invoice & { month?: string })[]>(K.invoices, []).filter((i) => i.month !== month);
    lsSet(K.invoices, [...others, ...rows.map((r) => ({ ...r, month }))]);
  };
  const setInvoice = useCallback(async (clientId: string, amount: number, status: InvoiceStatus) => {
    setInvoices((prev) => {
      const exists = prev.some((i) => i.clientId === clientId);
      const next = exists ? prev.map((i) => (i.clientId === clientId ? { ...i, amount, status } : i)) : [...prev, { id: newId(), clientId, amount, status }];
      if (!live) persistDemoInvoices(next);
      return next;
    });
    if (live && supabase && agencyId) {
      await supabase.from("invoices").upsert({ agency_id: agencyId, client_id: clientId, period_month: month, amount, status }, { onConflict: "client_id,period_month" });
    }
  }, [live, agencyId, month]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Overdue collections (unpaid + due day already passed this month) ─────────
  const dayOfMonth = new Date().getDate();
  const overdueCollections: OverdueCollection[] = collections
    .filter((c) => !c.collected && c.dueDay < dayOfMonth)
    .map((c) => ({ ...c, daysOverdue: dayOfMonth - c.dueDay }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    loading, settings, saveSettings,
    collections, overdueCollections, addCollection, updateCollection, removeCollection, generateFromRetainers,
    invoices, setInvoice,
    deals, addDeal, updateDeal, removeDeal,
    tampon, addTamponEntry, removeTamponEntry,
  };
}
