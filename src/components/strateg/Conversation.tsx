import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useClients } from "@/lib/clients";
import { useSnapshotBuilder } from "@/lib/strategSnapshot";
import { useActionExecutor } from "@/lib/strategActions";
import { streamStrateg, titleFrom, STRATEG_ROOMS, useStrategStore, type StrategConvo, type StrategMsg, type StrategRoom } from "@/lib/strateg";
import { parseSegments, parseStreaming, BlockCard, type BlockKind, type SavedRef, type ScriptBlock, type ObiectivBlock, type ClipBlock } from "./blocks";
import { ActionsCard } from "./ActionsCard";
import { ArrowLeft, ArrowUp, Compass, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * One Strateg conversation: the thread, the streaming reply ("Strategul citește
 * datele" until the first token) and the composer. Assistant replies are parsed
 * into text + action blocks.
 */

type Store = ReturnType<typeof useStrategStore>;
export type DraftConvo = { room: StrategRoom; clientId: string | null };

const roomLabel = (r: StrategRoom) => (r === "analiza" ? "Analiza săptămânii" : STRATEG_ROOMS.find((x) => x.key === r)?.label ?? r);

export function Conversation({ convo, draft, store, initialMessage, onCreated, onBack, onApplied }: {
  convo: StrategConvo | null;          // null while still a draft (no message sent yet)
  draft: DraftConvo | null;
  store: Store;
  initialMessage?: string;             // auto-sent once (the analysis generator)
  onCreated: (c: StrategConvo) => void;
  onBack: () => void;
  onApplied: (action: string, label: string) => void;   // journal write (page-owned)
}) {
  const { clients } = useClients();
  const executor = useActionExecutor();
  const buildSnapshot = useSnapshotBuilder();

  const room = convo?.room ?? draft?.room ?? "brainstorm";
  const clientId = convo?.clientId ?? draft?.clientId ?? null;
  const clientName = clientId ? clients.find((c) => c.id === clientId)?.name ?? null : null;

  const [msgs, setMsgs] = useState<StrategMsg[]>([]);
  const msgsRef = useRef(msgs); msgsRef.current = msgs;
  const [pending, setPending] = useState<string | null>(null); // "" = waiting for the first token
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState<Record<string, SavedRef>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const convoRef = useRef<StrategConvo | null>(convo);
  const skipLoad = useRef<string | null>(null); // a convo we just created locally: don't clobber optimistic msgs
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streaming = pending !== null;

  useEffect(() => {
    convoRef.current = convo;
    if (!convo) { setMsgs([]); return; }
    if (skipLoad.current === convo.id) return;
    let on = true;
    void store.loadMessages(convo.id).then((m) => { if (on) setMsgs(m); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo?.id]);

  // Smart auto-scroll: follow the end of the thread ONLY while the user is near
  // the bottom (the page scrolls on mobile). Scrolling up detaches; coming back
  // within ~120px re-attaches. Passive listener, reads only — no layout writes.
  const stickToEnd = useRef(true);
  const touching = useRef(false); // finger down = never fight the user's gesture
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      stickToEnd.current = window.innerHeight + window.scrollY >= doc.scrollHeight - 120;
    };
    const onTouchStart = () => { touching.current = true; };
    const onTouchEnd = () => { touching.current = false; };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
  // Coalesce follow-scrolls to ONE per animation frame. Tokens arrive many per
  // frame; a synchronous scrollIntoView for each forces layout every time and
  // makes the whole page stutter on the phone while the reply streams.
  const scrollQueued = useRef(false);
  useEffect(() => {
    if (scrollQueued.current) return;
    scrollQueued.current = true;
    requestAnimationFrame(() => {
      scrollQueued.current = false;
      if (stickToEnd.current && !touching.current) endRef.current?.scrollIntoView({ block: "end" });
    });
  }, [msgs.length, pending]);

  // Composer grows with its content up to max-h-32, then scrolls internally.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [input]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || pending !== null) return;
    setErr(null);
    let c = convoRef.current;
    if (!c) {
      const d = draft ?? { room, clientId };
      const title = d.room === "analiza"
        ? "Analiza · " + new Date().toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
        : titleFrom(text);
      c = await store.createConvo(d.room, d.clientId, title);
      if (!c) { setErr("Nu am putut porni conversația. Încearcă din nou."); return; }
      convoRef.current = c;
      skipLoad.current = c.id;
      onCreated(c);
    }
    const userMsg = await store.addMessage(c.id, "user", text);
    stickToEnd.current = true; // a fresh user message always scrolls to the end
    setMsgs((prev) => [...prev, userMsg]);
    setInput("");
    setPending(""); // "Strategul citește datele"

    const apiMsgs = [...msgsRef.current, userMsg].map((m) => ({ role: m.role, content: m.content }));
    let snapshot: unknown = {};
    try { snapshot = await buildSnapshot(c.clientId); } catch { snapshot = {}; }
    const res = await streamStrateg({ room: c.room, messages: apiMsgs, snapshot, clientId: c.clientId, onToken: setPending });
    if (res.error && !res.text) { setErr(res.error); setPending(null); return; }
    const aMsg = await store.addMessage(c.id, "assistant", res.text);
    setMsgs((prev) => [...prev, aMsg]);
    setPending(null);
    if (res.error) setErr(res.error);
  }, [pending, draft, room, clientId, store, onCreated, buildSnapshot]);

  // Auto-send exactly once (Generează analiza).
  const autoSent = useRef(false);
  useEffect(() => {
    if (initialMessage && !autoSent.current && !convo && msgs.length === 0) {
      autoSent.current = true;
      void send(initialMessage);
    }
  }, [initialMessage, convo, msgs.length, send]);

  const findClient = useCallback((name?: string) => executor.findClient(name) ?? clientId, [executor, clientId]);

  const saveBlock = useCallback(async (key: string, kind: BlockKind, data: ScriptBlock & ObiectivBlock & ClipBlock) => {
    if (saved[key] || savingKey) return;
    setSavingKey(key);
    try {
      if (kind === "script") {
        const cid = findClient(data.client);
        const res = await executor.createScript({ clientId: cid, title: data.titlu, hook: data.hook ?? "", body: data.desfasurare ?? "", cta: data.cta ?? "", status: "to_test" });
        if (!res.error) setSaved((p) => ({ ...p, [key]: { label: "Salvat în Scripturi", to: "/scripts" } }));
        else setErr("Nu am putut salva scriptul. Încearcă din nou.");
      } else if (kind === "obiectiv") {
        executor.addCustomItem(data.titlu, (data as ObiectivBlock).descriere ?? "");
        setSaved((p) => ({ ...p, [key]: { label: "Adăugat în Kill List", to: "/kill-list" } }));
      } else {
        const cid = findClient(data.client);
        const res = await executor.createClip({ clientId: cid, title: data.titlu, state: "idea" });
        if (!res.error) setSaved((p) => ({ ...p, [key]: { label: "Creat în Idee", to: cid ? `/pipeline?client=${cid}` : "/pipeline" } }));
        else setErr("Nu am putut crea clipul. Încearcă din nou.");
      }
    } finally {
      setSavingKey(null);
    }
  }, [saved, savingKey, findClient, executor]);


  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Înapoi" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition active:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-800">{convo?.title || roomLabel(room)}</h1>
          <p className="text-xs text-muted-foreground">{roomLabel(room)}{clientName ? ` · ${clientName}` : ""}</p>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-4">
        {msgs.map((m) => m.role === "user" ? (
          <div key={m.id} className="flex justify-end animate-fade-in motion-reduce:animate-none">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm">{m.content}</p>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2.5 animate-fade-in motion-reduce:animate-none">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--strateg))]/12 text-[hsl(var(--strateg))]"><Compass className="h-4 w-4" /></span>
            <AssistantBody msgId={m.id} content={m.content} executor={executor} saved={saved} savingKey={savingKey} onSaveBlock={saveBlock} onApplied={onApplied} />
          </div>
        ))}

        {pending !== null && (
          <div className="flex gap-2.5 animate-fade-in motion-reduce:animate-none">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--strateg))]/12 text-[hsl(var(--strateg))]"><Compass className="h-4 w-4 animate-pulse" /></span>
            {pending === "" ? (
              <p className="py-1 text-sm text-muted-foreground">Strategul citește datele<span className="animate-pulse">…</span></p>
            ) : (
              <StreamingBody content={pending} />
            )}
          </div>
        )}

        {err && <p className="rounded-xl border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-sm text-danger">{err}</p>}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] mt-4 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 md:bottom-4">
        <textarea
          ref={textareaRef}
          value={input} onChange={(e) => setInput(e.target.value)} rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          placeholder={clientName ? `Întreabă despre ${clientName}…` : "Întreabă Strategul…"}
          className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none"
        />
        <Button aria-label="Trimite" disabled={!input.trim() || streaming} onClick={() => void send(input)}
          className={cn("h-11 w-11 shrink-0 rounded-xl p-0 text-[hsl(var(--strateg-foreground))]", "bg-[hsl(var(--strateg))] hover:bg-[hsl(var(--strateg))]/90")}>
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// Module-level (NOT nested in Conversation): a nested definition would get a new
// component identity on every parent render, remounting ActionsCard and wiping
// its checklist state mid-apply.
// The reply while it streams: text renders live, a COMPLETE fenced block shows
// as a non-interactive preview, and an open fence at the tail shows as an
// animated placeholder. Raw ``` content never reaches the screen, and nothing
// here can execute — interactivity exists only on the saved final message.
function StreamingBody({ content }: { content: string }) {
  const { segments, open } = parseStreaming(content);
  return (
    <div className="min-w-0 flex-1">
      {segments.map((s, i) => {
        if (s.kind === "text") return s.text.trim() ? <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{s.text.trim()}</p> : null;
        if (s.kind === "actiuni") return <StreamPlaceholder key={i} label="Strategul pregătește operațiile…" />;
        return <BlockCard key={i} kind={s.kind} data={s.data as ScriptBlock & ObiectivBlock & ClipBlock} saved={null} busy={false} onSave={() => {}} preview />;
      })}
      {open !== null && <StreamPlaceholder label={open === "actiuni" ? "Strategul pregătește operațiile…" : "Strategul pregătește o propunere…"} />}
    </div>
  );
}
function StreamPlaceholder({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-2 rounded-xl border border-[hsl(var(--strateg))]/35 bg-[hsl(var(--strateg))]/[0.05] px-3 py-2.5 animate-scale-in motion-reduce:animate-none">
      <ListChecks className="h-4 w-4 animate-pulse text-[hsl(var(--strateg))]" />
      <span className="text-sm text-muted-foreground">{label}<span className="animate-pulse">…</span></span>
    </div>
  );
}

function AssistantBody({ msgId, content, executor, saved, savingKey, onSaveBlock, onApplied }: {
  msgId: string; content: string;
  executor: ReturnType<typeof useActionExecutor>;
  saved: Record<string, SavedRef>; savingKey: string | null;
  onSaveBlock: (key: string, kind: BlockKind, data: ScriptBlock & ObiectivBlock & ClipBlock) => Promise<void>;
  onApplied: (action: string, label: string) => void;
}) {
  const segments = parseSegments(content);
  return (
    <div className="min-w-0 flex-1">
      {segments.map((s, i) => {
        if (s.kind === "text") return s.text.trim() ? <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{s.text.trim()}</p> : null;
        if (s.kind === "actiuni") return <ActionsCard key={i} ops={s.ops} executor={executor} onApplied={onApplied} />;
        return <BlockCard key={i} kind={s.kind} data={s.data as ScriptBlock & ObiectivBlock & ClipBlock}
          saved={saved[`${msgId}-${i}`] ?? null} busy={savingKey === `${msgId}-${i}`}
          onSave={() => void onSaveBlock(`${msgId}-${i}`, s.kind as BlockKind, s.data as ScriptBlock & ObiectivBlock & ClipBlock)} />;
      })}
    </div>
  );
}
