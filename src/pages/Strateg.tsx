import { useState } from "react";
import { PageHeader, Panel, Button } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useClients } from "@/lib/clients";
import { useStrategStore, STRATEG_ROOMS, ANALIZA_TEACH, type StrategConvo, type StrategRoom } from "@/lib/strateg";
import { useStrategJournal } from "@/lib/strategJournal";
import { Conversation, type DraftConvo } from "@/components/strateg/Conversation";
import { FileText, History, Lightbulb, Plus, RotateCcw, ScrollText, Sparkles, Target, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Strategul - the section home. NOT a chat: at the top the weekly-analysis card
 * (generate + past reports), below it the four rooms, each with its own
 * conversation list. The whole section carries its own teal accent.
 */

const ROOM_ICON: Record<StrategRoom, LucideIcon> = {
  analiza: FileText, scripturi: ScrollText, obiective: Target, reincercat: RotateCcw, brainstorm: Lightbulb,
};
const A = "text-[hsl(var(--strateg))]";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }).replace(".", "");
// Journal timestamps read naturally: "azi, 14:20" / "ieri, 09:05" / "3 iul, 14:20".
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const hm = d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  if (day(d) === day(now)) return `azi, ${hm}`;
  if (day(d) === day(yesterday)) return `ieri, ${hm}`;
  return `${fmtDate(iso)}, ${hm}`;
}

type View =
  | { mode: "home" }
  | { mode: "convo"; convo: StrategConvo }
  | { mode: "draft"; draft: DraftConvo; initialMessage?: string };

export default function Strateg() {
  const store = useStrategStore();
  const { events, addEvent } = useStrategJournal();
  const { clients } = useClients();
  const [view, setView] = useState<View>({ mode: "home" });
  const [pickFor, setPickFor] = useState<StrategRoom | null>(null); // client chips before scripturi/reincercat
  const [delTarget, setDelTarget] = useState<StrategConvo | null>(null);

  const reports = store.convos.filter((c) => c.room === "analiza");

  function newConvo(room: StrategRoom) {
    const meta = STRATEG_ROOMS.find((r) => r.key === room);
    if (meta?.needsClient) { setPickFor(room); return; }
    setView({ mode: "draft", draft: { room, clientId: null } });
  }

  if (view.mode !== "home") {
    return (
      <Conversation
        convo={view.mode === "convo" ? view.convo : null}
        draft={view.mode === "draft" ? view.draft : null}
        store={store}
        initialMessage={view.mode === "draft" ? view.initialMessage : undefined}
        onCreated={(c) => setView({ mode: "convo", convo: c })}
        onBack={() => setView({ mode: "home" })}
        onApplied={(action, label) => void addEvent(action, label)}
      />
    );
  }

  return (
    <>
      <PageHeader title="Strategul" help="strateg" subtitle="Specialistul de marketing al agenției. Pornește de la datele tale reale." />

      {/* Analiza săptămânii */}
      <Panel className="overflow-hidden border-[hsl(var(--strateg))]/30 p-0">
        <div className="flex flex-wrap items-center gap-3 bg-[hsl(var(--strateg))]/[0.07] px-4 py-3.5">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--strateg))]/15", A)}><Sparkles className="h-4.5 w-4.5" /></span>
          <div className="min-w-[200px] flex-1">
            <p className="font-display text-sm font-800">Analiza săptămânii</p>
            <p className="text-xs text-muted-foreground">{ANALIZA_TEACH}</p>
          </div>
          <Button onClick={() => setView({ mode: "draft", draft: { room: "analiza", clientId: null }, initialMessage: "Generează analiza săptămânii." })}
            className="w-full bg-[hsl(var(--strateg))] text-[hsl(var(--strateg-foreground))] hover:bg-[hsl(var(--strateg))]/90 sm:w-auto">
            <Sparkles className="h-4 w-4" /> Generează analiza
          </Button>
        </div>
        {reports.length > 0 && reports.map((r) => (
          <ConvoRow key={r.id} convo={r} onOpen={() => setView({ mode: "convo", convo: r })} onDelete={() => setDelTarget(r)} />
        ))}
      </Panel>

      {/* The four rooms */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {STRATEG_ROOMS.map((room) => {
          const Icon = ROOM_ICON[room.key];
          const list = store.convos.filter((c) => c.room === room.key);
          return (
            <Panel key={room.key} className="flex flex-col p-0">
              <div className="flex items-center gap-2.5 px-4 py-3">
                <Icon className={cn("h-4 w-4 shrink-0", A)} />
                <p className="font-display text-sm font-800">{room.label}</p>
                <button onClick={() => newConvo(room.key)}
                  className={cn("ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-700 transition", A, "bg-[hsl(var(--strateg))]/10 hover:bg-[hsl(var(--strateg))]/20")}>
                  <Plus className="h-3.5 w-3.5" /> Conversație nouă
                </button>
              </div>
              {list.length === 0 ? (
                <p className="border-t border-border/60 px-4 py-5 text-sm text-muted-foreground">{room.teach}</p>
              ) : list.map((c) => (
                <ConvoRow key={c.id} convo={c} clientName={c.clientId ? clients.find((x) => x.id === c.clientId)?.name : undefined}
                  onOpen={() => setView({ mode: "convo", convo: c })} onDelete={() => setDelTarget(c)} />
              ))}
            </Panel>
          );
        })}
      </div>

      {/* Jurnalul Strategului: one event per applied operation (autor, acțiune, obiect, dată) */}
      <Panel className="mt-4 p-0">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <History className={cn("h-4 w-4 shrink-0", A)} />
          <p className="font-display text-sm font-800">Jurnal</p>
        </div>
        {events.length === 0 ? (
          <p className="border-t border-border/60 px-4 py-5 text-sm text-muted-foreground">Aici rămâne scris tot ce aplică Strategul în aplicație, cu data fiecărei operații.</p>
        ) : events.slice(0, 12).map((e) => (
          <p key={e.id} className="border-t border-border/60 px-4 py-2 text-sm">
            <span className="text-muted-foreground">{fmtWhen(e.createdAt)}: </span>{e.object}
          </p>
        ))}
      </Panel>

      {/* Client chips before a Scripturi / De reîncercat conversation */}
      <Modal open={pickFor !== null} onClose={() => setPickFor(null)} title="Pentru ce client?" subtitle="Camera asta lucrează pe un client anume" size="sm">
        <div className="flex flex-wrap gap-2 pb-2">
          {clients.length === 0 && <p className="text-sm text-muted-foreground">Adaugă mai întâi un client.</p>}
          {clients.map((c) => (
            <button key={c.id}
              onClick={() => { const room = pickFor!; setPickFor(null); setView({ mode: "draft", draft: { room, clientId: c.id } }); }}
              className="min-h-[44px] rounded-full border border-border px-4 text-sm font-600 transition hover:border-[hsl(var(--strateg))] hover:bg-[hsl(var(--strateg))]/10">
              {c.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={delTarget !== null} onClose={() => setDelTarget(null)} title="Ștergi conversația?" subtitle={delTarget?.title || undefined} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDelTarget(null)}>Anulează</Button>
          <Button variant="danger" className="ml-auto" onClick={() => { if (delTarget) void store.deleteConvo(delTarget.id); setDelTarget(null); }}><Trash2 className="h-4 w-4" /> Șterge</Button>
        </>}>
        <p className="text-sm text-muted-foreground">Conversația și mesajele ei se șterg definitiv.</p>
      </Modal>
    </>
  );
}

function ConvoRow({ convo, clientName, onOpen, onDelete }: { convo: StrategConvo; clientName?: string; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 border-t border-border/60 px-4 py-1">
      <button onClick={onOpen} className="min-w-0 flex-1 py-2 text-left">
        <p className="truncate text-sm font-600">{convo.title || "Conversație"}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(convo.updatedAt)}{clientName ? ` · ${clientName}` : ""}</p>
      </button>
      <button onClick={onDelete} aria-label="Șterge conversația"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-60 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
