import { useMemo, useState } from "react";
import { PageHeader, Panel, Button, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { PageSkeleton } from "@/components/Skeleton";
import { useScripts, type Script } from "@/lib/scripts";
import { useClients } from "@/lib/clients";
import { useClips } from "@/lib/clips";
import { useToast } from "@/lib/toast";
import { ArrowRight, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";

export default function Scripts() {
  const { scripts, loading, createScript, updateScript, deleteScript } = useScripts();
  const { clients, loading: lc } = useClients();
  const { createClip } = useClips();
  const { push } = useToast();
  const [client, setClient] = useState("all");
  const [editing, setEditing] = useState<Script | "new" | null>(null);

  const rows = useMemo(() => (client === "all" ? scripts : scripts.filter((s) => s.clientId === client)), [scripts, client]);

  function sendToPipeline(s: Script) {
    void createClip({ clientId: s.clientId, title: s.title, state: "idea", notes: s.body });
    void deleteScript(s.id);
    push({ tone: "success", title: "Clip creat din script", description: s.title || "Idee nouă în Pipeline" });
  }

  if (loading || lc) return <PageSkeleton variant="dashboard" />;

  return (
    <>
      <PageHeader title="Scripturi" subtitle="Ideea scrisă, înainte să devină clip">
        <Select value={client} onChange={(e) => setClient(e.target.value)} className="w-40"><option value="all">Toți clienții</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Script nou</Button>
      </PageHeader>

      {rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><ScrollText className="h-6 w-6" /></span>
          <div>
            <p className="font-display text-base font-800">Scripturile devin clipuri</p>
            <p className="mt-1 text-sm text-muted-foreground">Scrie o idee sau un hook pentru un client, apoi trimite-l în pipeline ca să devină clip.</p>
          </div>
          <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Scrie primul script</Button>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => (
            <Panel key={s.id} className="group flex flex-col p-4">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-display text-sm font-800">{s.title || "Fără titlu"}</p>
                <button onClick={() => setEditing(s)} aria-label="Editează" className="shrink-0 text-muted-foreground opacity-60 transition hover:text-foreground group-hover:opacity-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => void deleteScript(s.id)} aria-label="Șterge" className="shrink-0 text-muted-foreground opacity-60 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="mt-1 text-xs font-600 text-primary">{s.clientName}</p>
              {s.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">{s.body}</p>}
              <Button size="sm" variant="outline" className="mt-3 self-start" onClick={() => sendToPipeline(s)}>Trimite în pipeline <ArrowRight className="h-4 w-4" /></Button>
            </Panel>
          ))}
        </div>
      )}

      <ScriptModal
        open={editing !== null}
        script={editing === "new" ? null : editing}
        clients={clients}
        onClose={() => setEditing(null)}
        onSave={async (clientId, title, body) => {
          if (editing && editing !== "new") await updateScript(editing.id, { clientId, title, body });
          else await createScript({ clientId, title, body });
          setEditing(null);
        }}
      />
    </>
  );
}

function ScriptModal({ open, script, clients, onClose, onSave }: {
  open: boolean; script: Script | null; clients: { id: string; name: string }[];
  onClose: () => void; onSave: (clientId: string | null, title: string, body: string) => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  // Seed the form when the modal opens for a given script (or a fresh one).
  const seedKey = open ? (script?.id ?? "new") : "closed";
  const [seeded, setSeeded] = useState("");
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setClientId(script?.clientId ?? "");
    setTitle(script?.title ?? "");
    setBody(script?.body ?? "");
  }

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    await onSave(clientId || null, title.trim(), body.trim());
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={script ? "Editează scriptul" : "Script nou"} subtitle="Ideea sau textul care va deveni clip" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!title.trim() || busy} onClick={save}><Plus className="h-4 w-4" /> {script ? "Salvează" : "Adaugă"}</Button></>}>
      <div className="space-y-3">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titlu sau hook, ex. 3 greșeli când cumperi un apartament" />
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[140px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Scrie scriptul: hook, cadre, text, apel la acțiune." />
      </div>
    </Modal>
  );
}
