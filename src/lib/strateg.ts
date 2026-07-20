import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";

/*
 * Strategul - data layer. Conversations + messages persist like everything else
 * (strateg_conversations / strateg_messages live, localStorage in demo). A
 * weekly report is simply a conversation in the "analiza" room: the first
 * assistant message is the report, follow-ups continue the thread.
 * The model call goes through the server proxy /api/strateg (the key never
 * touches the client).
 */

export type StrategRoom = "analiza" | "scripturi" | "obiective" | "reincercat" | "brainstorm";

export const STRATEG_ROOMS: { key: StrategRoom; label: string; needsClient: boolean; teach: string }[] = [
  { key: "scripturi", label: "Scripturi", needsClient: true, teach: "Camera asta scrie scripturi noi pentru clientul ales, în formatul casei: Hook, Desfășurare, CTA." },
  { key: "obiective", label: "Obiective", needsClient: false, teach: "Camera asta propune obiective măsurabile, legate de cifrele tale reale." },
  { key: "reincercat", label: "De reîncercat", needsClient: true, teach: "Camera asta caută în datele tale ce merită refăcut sub altă formă. Alege un client și întreabă." },
  { key: "brainstorm", label: "Brainstorm", needsClient: false, teach: "Camera asta e liberă: idei, unghiuri, campanii, ancorate în datele agenției." },
];
export const ANALIZA_TEACH = "Strategul citește datele săptămânii și scrie ce merge, ce e blocat și trei recomandări.";

export type StrategConvo = { id: string; room: StrategRoom; clientId: string | null; title: string; createdAt: string; updatedAt: string };
export type StrategMsg = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

export const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 57) + "…" : t || "Conversație";
};

/* ── store ───────────────────────────────────────────────────────────────── */
const DEMO_KEY = "dreamar-strateg-demo";
type DemoConvo = StrategConvo & { messages: StrategMsg[] };
let demoSeq = 0;
const demoId = (p: string) => `${p}-${++demoSeq}-${Date.now()}`;

function demoLoad(): DemoConvo[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); } catch { return []; }
}
function demoSave(rows: DemoConvo[]) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); } catch { /* private */ } }

export function useStrategStore() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const [convos, setConvos] = useState<StrategConvo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!live) {
      setConvos(demoLoad().map(({ messages: _m, ...c }) => c).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setLoading(false);
      return;
    }
    if (!supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase.from("strateg_conversations")
      .select("id, room, client_id, title, created_at, updated_at")
      .eq("agency_id", agencyId).order("updated_at", { ascending: false });
    if (error) console.error("[strateg] load failed:", error.message);
    if (!error && data) setConvos(data.map((r) => ({ id: r.id, room: r.room as StrategRoom, clientId: r.client_id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at })));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { void reload(); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const createConvo = useCallback(async (room: StrategRoom, clientId: string | null, title: string): Promise<StrategConvo | null> => {
    const nowISO = new Date().toISOString();
    if (!live || !supabase || !agencyId) {
      const convo: DemoConvo = { id: demoId("convo"), room, clientId, title, createdAt: nowISO, updatedAt: nowISO, messages: [] };
      demoSave([convo, ...demoLoad()]);
      const { messages: _m, ...c } = convo;
      setConvos((prev) => [c, ...prev]);
      return c;
    }
    const { data, error } = await supabase.from("strateg_conversations")
      .insert({ agency_id: agencyId, room, client_id: clientId, title })
      .select("id, room, client_id, title, created_at, updated_at").single();
    if (error || !data) { console.error("[strateg] create failed:", error?.message); return null; }
    const c: StrategConvo = { id: data.id, room: data.room as StrategRoom, clientId: data.client_id, title: data.title, createdAt: data.created_at, updatedAt: data.updated_at };
    setConvos((prev) => [c, ...prev]);
    return c;
  }, [live, agencyId]);

  const deleteConvo = useCallback(async (id: string) => {
    setConvos((prev) => prev.filter((c) => c.id !== id));
    if (!live || !supabase) { demoSave(demoLoad().filter((c) => c.id !== id)); return; }
    await supabase.from("strateg_conversations").delete().eq("id", id);
  }, [live]);

  const loadMessages = useCallback(async (convoId: string): Promise<StrategMsg[]> => {
    if (!live || !supabase) return demoLoad().find((c) => c.id === convoId)?.messages ?? [];
    const { data, error } = await supabase.from("strateg_messages")
      .select("id, role, content, created_at").eq("conversation_id", convoId).order("created_at");
    if (error) { console.error("[strateg] messages load failed:", error.message); return []; }
    return (data ?? []).map((r) => ({ id: r.id, role: r.role as "user" | "assistant", content: r.content, createdAt: r.created_at }));
  }, [live]);

  const addMessage = useCallback(async (convoId: string, role: "user" | "assistant", content: string): Promise<StrategMsg> => {
    const nowISO = new Date().toISOString();
    setConvos((prev) => prev.map((c) => (c.id === convoId ? { ...c, updatedAt: nowISO } : c)));
    if (!live || !supabase || !agencyId) {
      const msg: StrategMsg = { id: demoId("msg"), role, content, createdAt: nowISO };
      demoSave(demoLoad().map((c) => (c.id === convoId ? { ...c, updatedAt: nowISO, messages: [...c.messages, msg] } : c)));
      return msg;
    }
    const { data, error } = await supabase.from("strateg_messages")
      .insert({ agency_id: agencyId, conversation_id: convoId, role, content })
      .select("id, role, content, created_at").single();
    if (error || !data) { console.error("[strateg] message save failed:", error?.message); return { id: `tmp-${Date.now()}`, role, content, createdAt: nowISO }; }
    void supabase.from("strateg_conversations").update({ updated_at: nowISO }).eq("id", convoId);
    return { id: data.id, role: data.role as "user" | "assistant", content: data.content, createdAt: data.created_at };
  }, [live, agencyId]);

  return { convos, loading, createConvo, deleteConvo, loadMessages, addMessage };
}

/* ── streaming client ────────────────────────────────────────────────────── */
export type StreamResult = { text: string; error?: string };

// POST to the server proxy and consume its SSE stream. Only `content` deltas
// arrive (the server strips reasoning). Errors come back as friendly text.
export async function streamStrateg(opts: {
  // "sugestii" is a server-side-only room (daily suggestions); it never creates
  // a saved conversation, so it stays out of the StrategRoom union.
  room: StrategRoom | "sugestii";
  messages: { role: "user" | "assistant"; content: string }[];
  snapshot: unknown;
  clientId?: string | null;
  onToken: (full: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  let auth: string | null = null;
  try {
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    auth = session?.access_token ?? null;
  } catch { /* demo mode: no session */ }

  let res: Response;
  try {
    res = await fetch("/api/strateg", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify({ room: opts.room, messages: opts.messages, snapshot: opts.snapshot, clientId: opts.clientId ?? null }),
      signal: opts.signal,
    });
  } catch {
    return { text: "", error: "Strategul nu a putut fi contactat. Verifică conexiunea și încearcă din nou." };
  }

  if (!res.ok) {
    let msg = "Strategul nu a putut răspunde acum. Încearcă din nou.";
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    return { text: "", error: msg };
  }
  if (!res.body) return { text: "", error: "Strategul nu a trimis niciun răspuns." };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          if (typeof obj.content === "string") { text += obj.content; opts.onToken(text); }
          else if (obj.error) return { text, error: obj.error };
        } catch { /* skip malformed chunk */ }
      }
    }
  } catch {
    if (text) return { text }; // stream cut mid-way: keep what arrived
    return { text: "", error: "Strategul s-a întrerupt. Încearcă din nou." };
  }
  return text ? { text } : { text: "", error: "Strategul nu a răspuns nimic. Încearcă din nou." };
}
