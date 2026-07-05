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
export type YanisDeal = { id: string; date: string; car: string; clipLink: string; sold: boolean; commission: number; markup: number; paid: boolean };
export type TamponEntry = { id: string; date: string; description: string; amount: number };

const DEFAULT_SETTINGS: MoneySettings = { personalFix: 2150, operational: 0, tampon: 0, operationalBurn: 0 };

const pad = (n: number) => String(n).padStart(2, "0");
const monthStartISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const K = {
  settings: "dreamar-money-settings-demo",
  collections: "dreamar-money-collections-demo",
  deals: "dreamar-money-deals-demo",
  tampon: "dreamar-money-tampon-demo",
};
function lsGet<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function lsSet(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }
let seq = 0;
const newId = () => `demo-${++seq}-${Date.now()}`;

export function useMoney() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const month = monthStartISO();

  const [loading, setLoading] = useState(live);
  const [settings, setSettings] = useState<MoneySettings>(DEFAULT_SETTINGS);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [deals, setDeals] = useState<YanisDeal[]>([]);
  const [tampon, setTampon] = useState<TamponEntry[]>([]);

  const reload = useCallback(async () => {
    if (!live) {
      setSettings(lsGet(K.settings, DEFAULT_SETTINGS));
      // Demo collections carry a `month` tag; keep only the current month.
      const allCol = lsGet<(Collection & { month?: string })[]>(K.collections, []);
      setCollections(allCol.filter((c) => c.month === month).map(({ month: _m, ...c }) => c));
      setDeals(lsGet<YanisDeal[]>(K.deals, []));
      setTampon(lsGet<TamponEntry[]>(K.tampon, []));
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId) return;
    setLoading(true);
    const [s, c, d, t] = await Promise.all([
      supabase.from("money_settings").select("personal_fix, operational, tampon, operational_burn").eq("agency_id", agencyId).maybeSingle(),
      supabase.from("collections").select("id, client_id, amount, due_day, collected").eq("agency_id", agencyId).eq("period_month", month).order("due_day"),
      supabase.from("yanis_deals").select("id, deal_date, car, clip_link, sold, commission, markup, paid").eq("agency_id", agencyId).order("deal_date", { ascending: false }),
      supabase.from("tampon_entries").select("id, entry_date, description, amount").eq("agency_id", agencyId).order("created_at", { ascending: false }),
    ]);
    if (s.data) setSettings({ personalFix: Number(s.data.personal_fix), operational: Number(s.data.operational), tampon: Number(s.data.tampon), operationalBurn: Number(s.data.operational_burn) });
    else { await supabase.from("money_settings").insert({ agency_id: agencyId, personal_fix: DEFAULT_SETTINGS.personalFix }); setSettings(DEFAULT_SETTINGS); }
    setCollections((c.data ?? []).map((r) => ({ id: r.id, clientId: r.client_id, amount: Number(r.amount), dueDay: r.due_day, collected: r.collected })));
    setDeals((d.data ?? []).map((r) => ({ id: r.id, date: r.deal_date, car: r.car, clipLink: r.clip_link ?? "", sold: r.sold, commission: Number(r.commission), markup: Number(r.markup), paid: r.paid })));
    setTampon((t.data ?? []).map((r) => ({ id: r.id, date: r.entry_date, description: r.description, amount: Number(r.amount) })));
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
  const removeCollection = useCallback(async (id: string) => {
    setCollections((prev) => { const next = prev.filter((c) => c.id !== id); if (!live) persistDemoCollections(next); return next; });
    if (live && supabase) await supabase.from("collections").delete().eq("id", id);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  // Add one row per retainer client that has no row this month yet.
  const generateFromRetainers = useCallback(async (clients: { id: string; billingType?: string; retainer: number }[]) => {
    const have = new Set(collections.map((c) => c.clientId));
    const targets = clients.filter((c) => (c.billingType ?? "retainer") === "retainer" && c.retainer > 0 && !have.has(c.id));
    for (const c of targets) await addCollection(c.id, c.retainer, 1);
  }, [collections, addCollection]);

  // ── Yanis deals ──────────────────────────────────────────────────────────────
  const addDeal = useCallback(async () => {
    if (!live || !supabase || !agencyId) {
      const row: YanisDeal = { id: newId(), date: todayISO(), car: "", clipLink: "", sold: false, commission: 0, markup: 0, paid: false };
      setDeals((prev) => { const next = [row, ...prev]; lsSet(K.deals, next); return next; });
      return;
    }
    const { data } = await supabase.from("yanis_deals").insert({ agency_id: agencyId }).select("id, deal_date, car, clip_link, sold, commission, markup, paid").single();
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
  const removeDeal = useCallback(async (id: string) => {
    setDeals((prev) => { const next = prev.filter((d) => d.id !== id); if (!live) lsSet(K.deals, next); return next; });
    if (live && supabase) await supabase.from("yanis_deals").delete().eq("id", id);
  }, [live]);

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
  const removeTamponEntry = useCallback(async (id: string) => {
    const entry = tampon.find((t) => t.id === id);
    setTampon((prev) => { const next = prev.filter((t) => t.id !== id); if (!live) lsSet(K.tampon, next); return next; });
    if (live && supabase) await supabase.from("tampon_entries").delete().eq("id", id);
    if (entry) await saveSettings({ tampon: settings.tampon - entry.amount });
  }, [live, tampon, settings.tampon, saveSettings]);

  return {
    loading, settings, saveSettings,
    collections, addCollection, updateCollection, removeCollection, generateFromRetainers,
    deals, addDeal, updateDeal, removeDeal,
    tampon, addTamponEntry, removeTamponEntry,
  };
}
