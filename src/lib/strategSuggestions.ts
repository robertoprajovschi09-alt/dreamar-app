import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "./workspace";
import { useSnapshotBuilder } from "./strategSnapshot";
import { streamStrateg, type StrategRoom } from "./strateg";

/*
 * Daily Strateg suggestions for the Azi screen. Generated at most ONCE per day
 * per device (cached in localStorage per agency + date), plus at most one manual
 * refresh. Any failure (network, parse, rate limit) yields an empty list —
 * never a toast, never a blocked Azi. Demo mode never calls the API.
 */

export type StrategSuggestion = {
  text: string;
  camera: StrategRoom;   // the room the tap opens
  client: string;        // client NAME from the snapshot, "" if none
  mesaj: string;         // the message that opens the conversation
};

const KEY = "dreamar-strateg-suggestions";
const ROOMS = new Set(["analiza", "scripturi", "obiective", "reincercat", "brainstorm"]);
const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

type Cache = { date: string; agencyId: string; items: StrategSuggestion[]; hidden: boolean; refreshCount?: number };

function loadCache(): Cache | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function saveCache(c: Cache) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private */ } }

// Pull the ```sugestii fenced block out of the reply (same fence shape as
// parseSegments) and keep at most 3 well-formed items.
export function parseSuggestions(text: string): StrategSuggestion[] {
  const m = text.match(/```sugestii\s*\n([\s\S]*?)```/);
  if (!m) return [];
  let parsed: unknown = null;
  try { parsed = JSON.parse(m[1].trim()); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const out: StrategSuggestion[] = [];
  for (const v of parsed) {
    if (out.length >= 3) break;
    if (!v || typeof v !== "object") continue;
    const s = v as Record<string, unknown>;
    if (typeof s.text !== "string" || !s.text.trim()) continue;
    if (typeof s.camera !== "string" || !ROOMS.has(s.camera)) continue;
    if (typeof s.mesaj !== "string" || !s.mesaj.trim()) continue;
    out.push({ text: s.text.trim(), camera: s.camera as StrategRoom, client: typeof s.client === "string" ? s.client.trim() : "", mesaj: s.mesaj.trim() });
  }
  return out;
}

export function useStrategSuggestions() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const buildSnapshot = useSnapshotBuilder();
  const [items, setItems] = useState<StrategSuggestion[]>([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const generating = useRef(false);

  const generate = useCallback(async (nextRefreshCount: number) => {
    if (generating.current || !live || !agencyId) return;
    generating.current = true;
    setLoading(true);
    try {
      let snapshot: unknown = {};
      try { snapshot = await buildSnapshot(null); } catch { snapshot = {}; }
      const res = await streamStrateg({
        room: "sugestii",
        messages: [{ role: "user", content: "Dă-mi sugestiile de azi." }],
        snapshot,
        onToken: () => { /* no streaming UI — only the final text matters */ },
      });
      const parsed = res.text ? parseSuggestions(res.text) : [];
      setItems(parsed);
      saveCache({ date: todayISO(), agencyId, items: parsed, hidden: false, refreshCount: nextRefreshCount });
    } catch {
      setItems([]); // silent: Azi must never block on this
    } finally {
      generating.current = false;
      setLoading(false);
    }
  }, [live, agencyId, buildSnapshot]);

  // On mount (once the agency is known): cache hit for today = instant, no
  // request; otherwise generate once per day per device. Demo mode: nothing.
  useEffect(() => {
    if (!live || !agencyReady || !agencyId) return;
    const c = loadCache();
    if (c && c.date === todayISO() && c.agencyId === agencyId) {
      setItems(Array.isArray(c.items) ? c.items.slice(0, 3) : []);
      setHidden(!!c.hidden);
      setRefreshCount(c.refreshCount ?? 0);
      return;
    }
    void generate(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, agencyReady, agencyId]);

  // Manual refresh: at most ONE regeneration per day (no spam).
  const refresh = useCallback(() => {
    if (loading || refreshCount >= 1) return;
    setRefreshCount(1);
    void generate(1);
  }, [loading, refreshCount, generate]);

  const hideForToday = useCallback(() => {
    setHidden(true);
    const c = loadCache();
    if (c && c.date === todayISO() && c.agencyId === agencyId) saveCache({ ...c, hidden: true });
    else saveCache({ date: todayISO(), agencyId, items, hidden: true, refreshCount });
  }, [agencyId, items, refreshCount]);

  return { items: hidden ? [] : items, loading, refresh, canRefresh: refreshCount < 1 && !loading, hideForToday };
}
