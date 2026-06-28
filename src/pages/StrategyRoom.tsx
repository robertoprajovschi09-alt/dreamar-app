import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Panel, Button, Badge, Select } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { useWorkspace } from "@/lib/workspace";
import { AiComingSoon } from "@/components/AiSoon";
import { strategySuggestions } from "@/data/sample";
import { ArrowUp, Mic, Paperclip, Plus, Share2, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: number; role: "user" | "assistant"; content: string };
let msgId = 1;

const recent = ["Plan de 30 de zile pentru Altmark", "Cele mai bune hook-uri — iunie", "De ce scade SmileLab?", "Scripturi pentru reels IronPeak"];

function buildResponse(prompt: string, client: string): string {
  const p = prompt.toLowerCase();
  const first = client.split(" ")[0];
  if (p.includes("30") || p.includes("plan") || p.includes("content plan")) {
    return `Iată un plan de conținut de 30 de zile pentru ${client}, construit din cele 42 de videoclipuri înregistrate și obiectivele lunii acesteia.

## Săptămâna 1 — Mizează pe ce funcționează
• 2× TikTok-uri tur de proprietate (hook-ul tău "vândut în 3 zile" a adus un plus de 3,2×)
• 1× Reel cu obiecții ale cumpărătorului ("E un moment bun să cumperi acum?")
• 1× secvență de Story din culise

## Săptămâna 2 — Testează unghiuri noi
• 1× prezentare de cartier (școli, cafenele, transport)
• 1× testimonial client / moment de predare a cheilor
• 1× comparație "ce primești pentru €X în Cluj"

## Săptămâna 3 — Autoritate + încredere
• 1× sesiune de întrebări cu agentul (finanțare, acte, termene)
• 1× talking head cu actualizări de piață
• 1× tur rapid al apartamentului Garden cu 3 camere

## Săptămâna 4 — Conversie
• 1× postare de urgență "ultimele unități disponibile"
• 1× recap de open-house cu dovadă socială
• 1× reel cu CTA de la DM la vizionare

Țintă: peste 37 de cereri de vizionare calificate, la un cost sub €6 per lead. Vrei să schițez scripturile pentru Săptămâna 1?`;
  }
  if (p.includes("hook")) {
    return `Clasate după retenția la 3 secunde și impactul în afacere pentru ${client}:

• "Acest apartament de €450k s-a vândut în 3 zile pentru că…" — scor AI 92, retenție 71%, 64 DM-uri
• "POV: prima ta săptămână în noua casă" — scor 84, multe salvări
• "Ce nu îți va spune agentul tău despre…" — scor 79, multe comentarii

Tiparul câștigător: curiozitate + o ancoră de preț concretă în primele 2 secunde. Aș transforma asta într-un șablon pentru Garden cu 3 camere și Riverside Villa în continuare.`;
  }
  if (p.includes("stop")) {
    return `Pe baza ultimelor 30 de zile ale ${first}, aș renunța la:

• Postări generice "tocmai listat" — retenție 31%, sub benchmark
• Montaje lungi de tip aftermovie (>45s) — rata de finalizare se prăbușește după 14s
• Repostarea aceluiași hook de 3+ ori într-o săptămână — randament în scădere

Realocă timpul respectiv către formatele de tur + obiecții, care țin contul pe linia de plutire.`;
  }
  if (p.includes("script")) {
    return `Script — "Vândut în 3 zile" (30s, TikTok), adaptat la vocea brandului ${client}:

Hook (0-2s): "Acest apartament s-a vândut în 3 zile — uite exact de ce."
Conținut (2-22s): Prezintă spațiul, evidențiază singura caracteristică la care au reacționat cumpărătorii, plasează ancora de preț, arată cererea ("am avut 11 vizionări programate în 48 de ore").
CTA (22-30s): "Trimite-mi 'TUR' în DM și ți-l trimit pe următorul înainte să ajungă pe piață."

Vrei încă 4 variante pentru testare A/B?`;
  }
  if (p.includes("summar") || p.includes("perform")) {
    return `${client} — rezumat de performanță pentru iunie:

• Reach +32% față de luna trecută, generat aproape în întregime de tururile TikTok
• 37 de cereri de vizionare calificate, cost de €6,40 per lead (-18%)
• 9 oferte, 2 unități rezervate → pipeline atribuibil de ~€430k
• Scor de sănătate 86 (risc scăzut)

Cea mai mare pârghie pentru luna viitoare: scalează formatul de tur și adaugă o serie de obiecții ale cumpărătorului.`;
  }
  return `Întrebare bună. Pe baza videoclipurilor stocate, metricilor, feedback-ului și obiectivelor ${client}, iată interpretarea mea:

Cel mai puternic semnal al tău este formatul tur de proprietate cu un hook bazat pe curiozitate — depășește orice altceva la retenție și DM-uri. Aș miza puternic pe asta, aș testa o serie de obiecții ale cumpărătorului și aș tăia postările "tocmai listat" cu retenție scăzută. Vrei să transform asta într-un plan concret de 30 de zile sau să schițez câteva scripturi?`;
}

function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="pt-2 font-display text-sm font-800">{line.slice(3)}</p>;
        if (line.startsWith("• ")) return (
          <p key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span>{line.slice(2)}</span></p>
        );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

function Orb({ size = 32 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-500 to-cyan-400 opacity-80 blur-[2px]" />
      <span className="relative grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
        <Sparkles className="h-1/2 w-1/2" />
      </span>
    </span>
  );
}

export default function StrategyRoom() {
  const { push } = useToast();
  const { live } = useWorkspace();
  const [client, setClient] = useState("Altmark Residences");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Receive a question routed from the ⌘K command palette and answer it immediately.
  // Deferred past mount so StrictMode's mount/cleanup churn doesn't drop the send;
  // clearing the router state after firing prevents re-sends while allowing repeat asks.
  useEffect(() => {
    const ask = (location.state as { ask?: string } | null)?.ask;
    if (!ask) return;
    const t = window.setTimeout(() => {
      send(ask);
      navigate(location.pathname, { replace: true, state: {} });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function send(text: string) {
    if (!text.trim() || streaming || thinking) return;
    setMessages((prev) => [...prev, { id: msgId++, role: "user", content: text.trim() }]);
    setInput("");
    setThinking(true);
    const full = buildResponse(text, client);
    const t1 = window.setTimeout(() => {
      setThinking(false);
      setStreaming(true);
      const id = msgId++;
      setMessages((prev) => [...prev, { id, role: "assistant", content: "" }]);
      let i = 0;
      const step = () => {
        i += 5;
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: full.slice(0, i) } : m)));
        if (i < full.length) {
          const t = window.setTimeout(step, 14);
          timers.current.push(t);
        } else {
          setStreaming(false);
        }
      };
      step();
    }, 700);
    timers.current.push(t1);
  }

  const empty = messages.length === 0;

  if (live) return (
    <AiComingSoon
      title="Cameră de strategie AI"
      subtitle="Asistent de strategie pe datele fiecărui client"
      blurb="Camera de strategie va folosi AI ca să-ți recomande planuri de conținut, hook-uri și scripturi pornind de la videoclipurile, metricile și feedback-ul fiecărui client. O activăm în curând — momentan poți planifica manual în Calendar și Sarcini."
    />
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Left rail */}
      <div className="hidden space-y-4 lg:block">
        <Panel className="p-4">
          <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Strategie pentru</p>
          <Select className="mt-2 h-10 w-full" value={client} onChange={(e) => setClient(e.target.value)}>
            {["Altmark Residences", "AuraLux Beauty", "IronPeak Gym", "Verde Bistro", "SmileLab Clinic"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <p className="mt-3 text-xs text-muted-foreground">Bazat pe videoclipurile, metricile, feedback-ul, obiectivele și rapoartele acestui client.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="primary">42 videoclipuri</Badge>
            <Badge tone="neutral">6 rapoarte</Badge>
            <Badge tone="success">14 hook-uri</Badge>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Recente</p>
            <button onClick={() => setMessages([])} className="text-primary"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1">
            {recent.map((r) => (
              <button key={r} onClick={() => send(r)} className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted">
                {r}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Chat area */}
      <Panel className="relative flex h-[calc(100vh-7rem)] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Orb size={30} />
            <div>
              <p className="font-display text-sm font-700">Cameră de strategie AI</p>
              <p className="text-[11px] text-muted-foreground">{client}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMessages([])}><Plus className="h-4 w-4" /> Conversație nouă</Button>
            <Button variant="outline" size="sm" onClick={() => push({ tone: "success", title: "Link de partajare copiat", description: "Oricine din echipa ta poate deschide această conversație" })}><Share2 className="h-4 w-4" /> Partajează</Button>
          </div>
        </div>

        {/* Messages / empty state */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10">
              <div className="relative mb-6 h-20 w-20">
                <div className="absolute inset-0 animate-float rounded-full bg-gradient-to-br from-indigo-500 via-indigo-500 to-cyan-400 opacity-70 blur-md" />
                <div className="absolute inset-2 grid place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white"><Sparkles className="h-7 w-7" /></div>
              </div>
              <h2 className="font-display text-2xl font-800 tracking-tight">Ce ar trebui să creăm în continuare?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Întreabă orice despre strategia, conținutul sau performanța {client}.</p>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {strategySuggestions.map((s) => (
                  <button key={s.title} onClick={() => send(s.title)} className="rounded-xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft">
                    <p className="text-sm font-700">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex items-start justify-end gap-3">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm gradient-primary px-4 py-2.5 text-sm text-white shadow-soft">{m.content}</div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><User className="h-4 w-4" /></span>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-3">
                    <Orb />
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-soft">
                      <RichText text={m.content} />
                    </div>
                  </div>
                )
              )}
              {thinking && (
                <div className="flex items-center gap-3">
                  <Orb />
                  <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft focus-within:ring-2 focus-within:ring-ring/50">
            <button className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Paperclip className="h-4 w-4" /></button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={`Întreabă orice despre ${client}…`}
              className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Mic className="h-4 w-4" /></button>
            <button onClick={() => send(input)} disabled={!input.trim() || streaming || thinking} className={cn("grid h-9 w-9 place-items-center rounded-lg gradient-primary text-white transition", (!input.trim() || streaming || thinking) && "opacity-40")}>
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
