import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMoney } from "./money";
import { useKillList } from "./killlist";
import { useClients } from "./clients";
import { useClips } from "./clips";
import { formatCurrency } from "./utils";
import { Modal } from "@/components/overlay";
import { Button, Input, Select } from "@/components/ui";
import { Clapperboard, MapPin, Plus, Send } from "lucide-react";

/*
 * The one notification center. Exactly THREE kinds, all derived (nothing else in
 * the app is allowed to nag the user):
 *   money   - overdue collections + invoices still not issued past the 1st;
 *   evening - one "Planifică ziua de mâine" per evening, at the set time;
 *   kill    - a Kill List goal that just unlocked.
 * "Seen" state lives in localStorage (single-user tool); money alerts stay until
 * the underlying problem is actually resolved.
 */

export type NotifKind = "money_overdue" | "money_invoice" | "evening_plan" | "kill_unlock";
export type Notif = {
  id: string;
  kind: NotifKind;
  ts: number;            // sort key (ms) — the list is chronological, newest first
  title: string;
  desc?: string;
  resolved: boolean;     // whether it still counts toward the badge
  to?: string;           // navigate target on tap
  focus?: string;        // Bani row id (col-<id> / fact-<id>)
  collectionId?: string; // money_overdue → "Marchează încasat"
};

const RO_MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lei = (n: number) => formatCurrency(n);
const DAY = 86400000;
export const EVENING_TIMES = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];
export const DEFAULT_EVENING = "19:30";

function lsGet<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function lsSet(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private */ } }

const K = {
  settings: "dreamar-notif-settings",
  eveningSeen: "dreamar-notif-evening-seen",
  killSeen: "dreamar-notif-kill-seen",
  killFirst: "dreamar-notif-kill-firstseen",
  pushFired: "dreamar-notif-push-fired",
};

type Settings = { eveningTime: string; push: boolean };

type NotifCtx = {
  notifications: Notif[];
  unresolvedCount: number;
  markCollected: (collectionId: string) => void;
  onPanelOpen: () => void;   // marks the visible kill-unlocks as seen
  openTomorrow: () => void;  // opens the "Mâine" sheet + resolves the evening notif
  eveningTime: string;
  setEveningTime: (t: string) => void;
  push: boolean;
  setPush: (b: boolean) => Promise<void> | void;
  pushSupported: boolean;
};

const Ctx = createContext<NotifCtx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const money = useMoney();
  const { items: killItems } = useKillList();
  const { clients } = useClients();
  const clips = useClips();

  const [settings, setSettings] = useState<Settings>(() => {
    const s = lsGet<Partial<Settings>>(K.settings, {});
    return { eveningTime: s.eveningTime || DEFAULT_EVENING, push: !!s.push };
  });
  const persistSettings = (s: Settings) => { setSettings(s); lsSet(K.settings, s); };

  const [eveningSeen, setEveningSeen] = useState<string>(() => lsGet<string>(K.eveningSeen, ""));
  const [killSeen, setKillSeen] = useState<string[]>(() => lsGet<string[]>(K.killSeen, []));
  const [killFirst, setKillFirst] = useState<Record<string, number>>(() => lsGet<Record<string, number>>(K.killFirst, {}));

  // A ticking clock so the evening notification appears the moment its time passes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(t); }, []);

  // Record when each Kill List goal first appears unlocked (for chronological order).
  useEffect(() => {
    const unlocked = killItems.filter((it) => it.unlocked).map((it) => it.id);
    const missing = unlocked.filter((id) => !(id in killFirst));
    if (missing.length) {
      setKillFirst((prev) => { const next = { ...prev }; const t = Date.now(); missing.forEach((id) => (next[id] = t)); lsSet(K.killFirst, next); return next; });
    }
  }, [killItems, killFirst]);

  const nameOf = useCallback((id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "Client" : "Fără client"), [clients]);

  const notifications = useMemo(() => {
    const out: Notif[] = [];
    const nowDate = new Date(now);
    const todayStr = isoOf(nowDate);
    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();

    // 1 · money — overdue collections
    money.overdueCollections.forEach((o) => out.push({
      id: `mo-${o.id}`, kind: "money_overdue", ts: startOfToday - Math.max(0, o.daysOverdue - 1) * DAY,
      title: `${nameOf(o.clientId)}, ${lei(o.amount)}`,
      desc: o.daysOverdue === 1 ? "întârziat cu 1 zi" : `întârziat cu ${o.daysOverdue} zile`,
      resolved: false, focus: `col-${o.id}`, collectionId: o.id,
    }));

    // 1 · money — invoices still not issued, but only after the 1st
    if (nowDate.getDate() > 1) {
      clients.filter((c) => c.invoiced && (money.invoices.find((i) => i.clientId === c.id)?.status ?? "not_issued") === "not_issued").forEach((c) => out.push({
        id: `mi-${c.id}`, kind: "money_invoice", ts: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 9).getTime(),
        title: `Factura ${c.name} pe ${RO_MONTHS[nowDate.getMonth()]} e neemisă`,
        resolved: false, focus: `fact-${c.id}`,
      }));
    }

    // 2 · evening planning — one per evening, once the set time has passed
    const [eh, em] = settings.eveningTime.split(":").map(Number);
    const eveningTs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), eh, em).getTime();
    if (now >= eveningTs) out.push({
      id: `ep-${todayStr}`, kind: "evening_plan", ts: eveningTs,
      title: "Planifică ziua de mâine", desc: "Vezi ce ai mâine și pregătește-te.",
      resolved: eveningSeen === todayStr,
    });

    // 3 · kill list — freshly unlocked goals
    killItems.filter((it) => it.unlocked).forEach((it) => out.push({
      id: `ku-${it.id}`, kind: "kill_unlock", ts: killFirst[it.id] ?? now,
      title: `Obiectiv deblocat: ${it.title}`, desc: "Vezi Kill List.",
      resolved: killSeen.includes(it.id), to: "/kill-list",
    }));

    return out.sort((a, b) => b.ts - a.ts);
  }, [money.overdueCollections, money.invoices, clients, killItems, killFirst, killSeen, settings.eveningTime, eveningSeen, now, nameOf]);

  const unresolvedCount = useMemo(() => notifications.filter((n) => !n.resolved).length, [notifications]);

  const markCollected = useCallback((collectionId: string) => { void money.updateCollection(collectionId, { collected: true }); }, [money]);

  const onPanelOpen = useCallback(() => {
    const fresh = killItems.filter((it) => it.unlocked).map((it) => it.id);
    setKillSeen((prev) => { const next = Array.from(new Set([...prev, ...fresh])); lsSet(K.killSeen, next); return next; });
  }, [killItems]);

  const [tomorrowOpen, setTomorrowOpen] = useState(false);
  const openTomorrow = useCallback(() => {
    setTomorrowOpen(true);
    const today = isoOf(new Date());
    setEveningSeen(today); lsSet(K.eveningSeen, today);
  }, []);

  // Push: request permission, then fire a LOCAL notification when the app is open
  // at the evening time. (Server-scheduled Web Push needs cron infra we don't run.)
  const pushSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const setPush = useCallback(async (b: boolean) => {
    if (b && pushSupported && Notification.permission !== "granted") {
      try { await Notification.requestPermission(); } catch { /* denied */ }
    }
    const granted = !pushSupported || Notification.permission === "granted";
    persistSettings({ ...settings, push: b && granted });
  }, [settings, pushSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  const firedRef = useRef<string>(lsGet<string>(K.pushFired, ""));
  useEffect(() => {
    if (!settings.push || !pushSupported || Notification.permission !== "granted") return;
    const todayStr = isoOf(new Date());
    const [eh, em] = settings.eveningTime.split(":").map(Number);
    const eveningTs = new Date().setHours(eh, em, 0, 0);
    if (Date.now() >= eveningTs && firedRef.current !== todayStr && eveningSeen !== todayStr) {
      firedRef.current = todayStr; lsSet(K.pushFired, todayStr);
      navigator.serviceWorker?.ready.then((reg) => {
        reg.showNotification("Planifică ziua de mâine", { body: "Vezi ce ai mâine și pregătește-te.", tag: "evening-plan", icon: "/icon-192.png", data: { url: "/dashboard" } }).catch(() => { /* noop */ });
      }).catch(() => { /* noop */ });
    }
  }, [now, settings.push, settings.eveningTime, eveningSeen, pushSupported]);

  const value: NotifCtx = {
    notifications, unresolvedCount, markCollected, onPanelOpen, openTomorrow,
    eveningTime: settings.eveningTime, setEveningTime: (t) => persistSettings({ ...settings, eveningTime: t }),
    push: settings.push, setPush, pushSupported,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <TomorrowSheet open={tomorrowOpen} onClose={() => setTomorrowOpen(false)} clips={clips} clients={clients} />
    </Ctx.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

/* ── "Mâine" sheet ───────────────────────────────────────────────────────── */
function TomorrowSheet({ open, onClose, clips, clients }: {
  open: boolean; onClose: () => void; clips: ReturnType<typeof useClips>; clients: { id: string; name: string }[];
}) {
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const tISO = isoOf(tomorrow);
  const tomorrowLabel = tomorrow.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
  const dow = tomorrow.getDay(); // 0 Sun … 6 Sat

  const scheduled = clips.clips.filter((c) => c.state === "scheduled" && c.scheduledDate === tISO);
  const filming = clips.clips.filter((c) => c.filmDate === tISO && (c.state === "idea" || c.state === "to_film" || c.state === "filmed"));
  const readyToPost = clips.clips.filter((c) => c.state === "edited");

  const [qClient, setQClient] = useState("");
  const [qTitle, setQTitle] = useState("");
  const addFilm = () => {
    if (!qTitle.trim()) return;
    void clips.createClip({ clientId: qClient || null, title: qTitle.trim(), state: "to_film", filmDate: tISO });
    setQTitle("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Mâine" subtitle={tomorrowLabel.charAt(0).toUpperCase() + tomorrowLabel.slice(1)} size="md"
      footer={<Button variant="ghost" className="ml-auto" onClick={onClose}>Închide</Button>}>
      <div className="space-y-5">
        <Group icon={Send} title="De postat mâine" count={scheduled.length}>
          {scheduled.length === 0 ? <Empty>Nimic programat pe mâine.</Empty> : scheduled.map((c) => (
            <Row key={c.id} title={c.title} sub={`${c.clientName}${c.platform ? ` · ${c.platform}` : ""}`} />
          ))}
        </Group>

        <Group icon={Clapperboard} title="De filmat mâine" count={filming.length}>
          {filming.length === 0 ? <Empty>Niciun clip cu zi de filmare mâine.</Empty> : filming.map((c) => (
            <Row key={c.id} title={c.title} sub={c.clientId ? c.clientName : "Fără client"} />
          ))}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Select value={qClient} onChange={(e) => setQClient(e.target.value)} className="sm:w-40"><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <div className="flex flex-1 gap-2">
              <Input value={qTitle} onChange={(e) => setQTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFilm(); }} placeholder="Clip de filmat mâine" className="flex-1" />
              <Button variant="primary" onClick={addFilm} disabled={!qTitle.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </Group>

        {(dow === 2 || dow === 3) && (
          <Group icon={MapPin} title={`Tura Tulcea · ${dow === 2 ? "marți" : "miercuri"}`} count={undefined}>
            <p className="text-sm text-muted-foreground">Mâine e zi de Tulcea. Vezi lista în Azi.</p>
          </Group>
        )}

        <Group icon={Send} title="Programează din Clipuri gata" count={readyToPost.length}>
          {readyToPost.length === 0 ? <Empty>Niciun clip în Editat, gata de programat.</Empty> : (
            <div className="space-y-1.5">
              {readyToPost.map((c) => (
                <button key={c.id} onClick={() => void clips.updateClip(c.id, { state: "scheduled", scheduledDate: tISO })}
                  className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-600">{c.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.clientId ? c.clientName : "Fără client"}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-700 text-primary">Programează</span>
                </button>
              ))}
            </div>
          )}
        </Group>
      </div>
    </Modal>
  );
}

function Group({ icon: Icon, title, count, children }: { icon: typeof Send; title: string; count?: number; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-800">{title}</p>
        {count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-700 text-muted-foreground">{count}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <p className="truncate text-sm font-600">{title}</p>
      <p className="truncate text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
