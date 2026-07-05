import { useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/overlay";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CalendarPlus, Film, Plus, UserPlus, Video, X } from "lucide-react";

const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

type ClientLite = { id: string; name: string };
type Mode = null | "film" | "clip" | "post";

export function QuickAdd({ clients, mobile, onAddShot, onAddClip, onAddPost, onNewClient }: {
  clients: ClientLite[];
  mobile: boolean;
  onAddShot: (desc: string, clientId: string | null) => void;
  onAddClip: (clientId: string) => void;
  onAddPost: (input: { clientId: string; title: string; platform: string; date: string }) => void;
  onNewClient: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);

  const options = [
    { key: "film", icon: Film, label: "Sarcină de filmat", run: () => setMode("film") },
    { key: "clip", icon: Video, label: "Clip în tampon", run: () => setMode("clip") },
    { key: "post", icon: CalendarPlus, label: "Postare în calendar", run: () => setMode("post") },
    { key: "client", icon: UserPlus, label: "Client nou", run: () => onNewClient() },
  ];

  return (
    <>
      {/* Portal the floating UI to <body> so a transformed AppShell ancestor
          can't trap position:fixed (it would anchor to content, not viewport). */}
      {createPortal(
        <>
          {/* backdrop */}
          {open && <button aria-label="Închide" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]" />}

          {/* menu */}
          {open && (
        <div className={cn(
          "fixed z-50",
          mobile
            ? "inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))]"
            : "bottom-24 right-6 w-64"
        )}>
          <div className="glass-quick overflow-hidden rounded-2xl p-1.5">
            {options.map((o) => (
              <button key={o.key} onClick={() => { setOpen(false); o.run(); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-600 transition hover:bg-foreground/5 active:bg-foreground/10">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><o.icon className="h-4.5 w-4.5" /></span>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAB — the only Liquid Glass element */}
      <button
        aria-label="Adaugă rapid"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "glass-fab fixed z-50 grid h-14 w-14 place-items-center rounded-full text-primary-foreground transition active:scale-95",
          mobile ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2" : "bottom-6 right-6"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
        </>,
        document.body
      )}

      <FilmModal open={mode === "film"} onClose={() => setMode(null)} clients={clients} onAdd={(d, c) => { onAddShot(d, c); setMode(null); }} />
      <ClipModal open={mode === "clip"} onClose={() => setMode(null)} clients={clients} onAdd={(c) => { onAddClip(c); setMode(null); }} />
      <PostModal open={mode === "post"} onClose={() => setMode(null)} clients={clients} onAdd={(i) => { onAddPost(i); setMode(null); }} />
    </>
  );
}

function FilmModal({ open, onClose, clients, onAdd }: { open: boolean; onClose: () => void; clients: ClientLite[]; onAdd: (desc: string, clientId: string | null) => void }) {
  const [desc, setDesc] = useState("");
  const [clientId, setClientId] = useState("");
  const submit = () => { if (desc.trim()) { onAdd(desc.trim(), clientId || null); setDesc(""); setClientId(""); } };
  return (
    <Modal open={open} onClose={onClose} title="Sarcină de filmat" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!desc.trim()} onClick={submit}><Plus className="h-4 w-4" /> Adaugă</Button></>}>
      <div className="space-y-3">
        <Input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Ce filmezi? ex. Reel testimonial la salon" />
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </div>
    </Modal>
  );
}

function ClipModal({ open, onClose, clients, onAdd }: { open: boolean; onClose: () => void; clients: ClientLite[]; onAdd: (clientId: string) => void }) {
  const [clientId, setClientId] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Clip în tampon" subtitle="+1 la tamponul de clipuri al clientului" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!clientId} onClick={() => clientId && onAdd(clientId)}><Plus className="h-4 w-4" /> Adaugă clip</Button></>}>
      <Select autoFocus value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Alege clientul</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
    </Modal>
  );
}

function PostModal({ open, onClose, clients, onAdd }: { open: boolean; onClose: () => void; clients: ClientLite[]; onAdd: (i: { clientId: string; title: string; platform: string; date: string }) => void }) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [date, setDate] = useState(todayISO());
  const submit = () => { if (clientId && title.trim()) { onAdd({ clientId, title: title.trim(), platform, date }); setTitle(""); } };
  return (
    <Modal open={open} onClose={onClose} title="Postare în calendar" subtitle="Se adaugă direct în calendarul de conținut" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!clientId || !title.trim()} onClick={submit}><Plus className="h-4 w-4" /> Adaugă</Button></>}>
      <div className="space-y-3">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Titlul postării" />
        <div className="grid grid-cols-2 gap-3">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  );
}
