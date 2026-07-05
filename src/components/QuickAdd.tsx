import { useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/overlay";
import { Button, Input, Select } from "@/components/ui";
import { CLIP_STATES, type ClipState, type NewClipInput } from "@/lib/clips";
import type { YanisDealInit } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Car, Check, Clapperboard, Film, Plus, UserPlus, X } from "lucide-react";

const PLATFORMS = ["Instagram", "TikTok", "Facebook"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const needsDate = (s: ClipState) => s === "scheduled" || s === "posted";
const BIG = "h-12 text-base"; // touch-sized fields for the field-quick-add forms

type ClientLite = { id: string; name: string };
type Mode = null | "clip" | "film" | "yanis";

export function QuickAdd({ clients, mobile, onCreateClip, onAddShot, onAddDeal, onNewClient }: {
  clients: ClientLite[];
  mobile: boolean;
  onCreateClip: (input: NewClipInput) => void;
  onAddShot: (desc: string, clientId: string | null) => void;
  onAddDeal?: (init: YanisDealInit) => void;
  onNewClient: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);

  // On the phone the FAB is for the two field actions (a decont row + a clip to
  // film); on desktop it stays the general capture menu.
  const options = mobile
    ? [
        { key: "yanis", icon: Car, label: "Rând Decont Yanis", run: () => setMode("yanis") },
        { key: "film", icon: Film, label: "Clip de filmat", run: () => setMode("film") },
        { key: "client", icon: UserPlus, label: "Client nou", run: () => onNewClient() },
      ]
    : [
        { key: "clip", icon: Clapperboard, label: "Clip nou", run: () => setMode("clip") },
        { key: "film", icon: Film, label: "Sarcină de filmat", run: () => setMode("film") },
        { key: "client", icon: UserPlus, label: "Client nou", run: () => onNewClient() },
      ];

  return (
    <>
      {createPortal(
        <>
          {open && <button aria-label="Închide" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]" />}
          {open && (
            <div className={cn("fixed z-50", mobile ? "inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))]" : "bottom-24 right-6 w-64")}>
              <div className="glass-quick overflow-hidden rounded-2xl p-1.5">
                {options.map((o) => (
                  <button key={o.key} onClick={() => { setOpen(false); o.run(); }}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-600 transition hover:bg-foreground/5 active:bg-foreground/10">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><o.icon className="h-4.5 w-4.5" /></span>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button aria-label="Adaugă rapid" onClick={() => setOpen((v) => !v)}
            className={cn("glass-fab fixed z-50 grid h-14 w-14 place-items-center rounded-full text-primary-foreground transition active:scale-95",
              mobile ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4" : "bottom-6 right-6")}>
            {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
          </button>
        </>,
        document.body
      )}

      <ClipModal open={mode === "clip"} onClose={() => setMode(null)} clients={clients} onAdd={(i) => { onCreateClip(i); setMode(null); }} />
      <FilmModal open={mode === "film"} onClose={() => setMode(null)} clients={clients} onAdd={(d, c) => { onAddShot(d, c); setMode(null); }} />
      <YanisModal open={mode === "yanis"} onClose={() => setMode(null)} onAdd={(i) => { onAddDeal?.(i); setMode(null); }} />
    </>
  );
}

function ClipModal({ open, onClose, clients, onAdd }: { open: boolean; onClose: () => void; clients: ClientLite[]; onAdd: (i: NewClipInput) => void }) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [state, setState] = useState<ClipState>("idea");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState(todayISO());
  const submit = () => {
    if (!clientId || !title.trim()) return;
    onAdd({ clientId, title: title.trim(), state, platform: platform || undefined, scheduledDate: needsDate(state) ? date : null });
    setTitle("");
  };
  return (
    <Modal open={open} onClose={onClose} title="Clip nou" subtitle="Apare în Pipeline" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!clientId || !title.trim()} onClick={submit}><Plus className="h-4 w-4" /> Adaugă</Button></>}>
      <div className="space-y-3">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Titlul clipului" />
        <div className="grid grid-cols-2 gap-3">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={state} onChange={(e) => setState(e.target.value as ClipState)}>{CLIP_STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">Fără platformă</option>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          {needsDate(state) && <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </div>
      </div>
    </Modal>
  );
}

// "Clip de filmat" - 2 big fields, drops a clip straight into the to_film state.
function FilmModal({ open, onClose, clients, onAdd }: { open: boolean; onClose: () => void; clients: ClientLite[]; onAdd: (desc: string, clientId: string | null) => void }) {
  const [desc, setDesc] = useState("");
  const [clientId, setClientId] = useState("");
  const submit = () => { if (desc.trim()) { onAdd(desc.trim(), clientId || null); setDesc(""); setClientId(""); } };
  return (
    <Modal open={open} onClose={onClose} title="Clip de filmat" subtitle="Ajunge direct în lista De filmat" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!desc.trim()} onClick={submit}><Plus className="h-4 w-4" /> Adaugă</Button></>}>
      <div className="space-y-3">
        <Input autoFocus className={BIG} value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Ce filmezi? ex. Reel testimonial" />
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className={BIG}><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </div>
    </Modal>
  );
}

// "Rând Decont Yanis" - 4 big fields (mașină, comision numeric, vândută, dată).
function YanisModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (init: YanisDealInit) => void }) {
  const [car, setCar] = useState("");
  const [commission, setCommission] = useState("");
  const [sold, setSold] = useState(false);
  const [date, setDate] = useState(todayISO());
  const submit = () => {
    onAdd({ date, car: car.trim(), commission: Number(commission) || 0, sold });
    setCar(""); setCommission(""); setSold(false);
  };
  return (
    <Modal open={open} onClose={onClose} title="Rând nou · Decont Yanis" subtitle="Adaugă o mașină în Decont Yanis" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" onClick={submit}><Plus className="h-4 w-4" /> Adaugă</Button></>}>
      <div className="space-y-3">
        <Input autoFocus className={BIG} value={car} onChange={(e) => setCar(e.target.value)} placeholder="Mașină - ex. VW Golf 2018" />
        <Input className={BIG} type="number" inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Comision (lei)" />
        <button onClick={() => setSold((s) => !s)}
          className={cn("flex h-12 w-full items-center justify-between rounded-lg border px-3 text-sm font-600 transition", sold ? "border-success bg-success/10 text-success" : "border-input text-foreground")}>
          <span>Vândută</span>
          <span className={cn("grid h-6 w-6 place-items-center rounded-full", sold ? "bg-success text-white" : "bg-muted text-transparent")}><Check className="h-4 w-4" /></span>
        </button>
        <Input className={BIG} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  );
}
