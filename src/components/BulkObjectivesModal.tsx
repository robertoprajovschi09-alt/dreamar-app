import { useState } from "react";
import { Modal } from "@/components/overlay";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/lib/workspace";
import { useClients } from "@/lib/clients";
import { useToast } from "@/lib/toast";
import { Plus, Sparkles, Target, X } from "lucide-react";

const presets = [
  "Generează 40+ lead-uri calificate",
  "Crește platforma principală cu 15% lună de lună",
  "Reduce costul per lead cu 20%",
  "Crește rata de revenire a clienților",
  "Încheie 2 contracte de valoare mare",
];

export function BulkObjectivesModal({
  open,
  onClose,
  clientIds,
  clientNames,
}: {
  open: boolean;
  onClose: () => void;
  clientIds: string[];
  clientNames: string[];
}) {
  const ws = useWorkspace();
  const { live, applyObjectivesToAll: applyLive } = useClients();
  const { push } = useToast();
  const [objectives, setObjectives] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    onClose();
    setTimeout(() => { setObjectives([]); setDraft(""); setBusy(false); }, 200);
  }
  function add() {
    if (!draft.trim()) return;
    setObjectives((prev) => [...prev, draft.trim()]);
    setDraft("");
  }
  async function apply() {
    if (busy) return;
    setBusy(true);
    // Live mode persists to the clients table; demo mode uses the localStorage store.
    if (live) await applyLive(clientIds, objectives);
    else ws.applyObjectivesToAll(clientIds, objectives);
    push({ tone: "success", title: "Obiective aplicate", description: `${objectives.length} ${objectives.length === 1 ? "obiectiv" : "obiective"} → ${clientIds.length} ${clientIds.length === 1 ? "client" : "clienți"}` });
    close();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="Aplică obiective clienților"
      subtitle={`Înlocuiește obiectivele lunii acesteia pentru ${clientIds.length} ${clientIds.length === 1 ? "client" : "clienți"}`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Anulează</Button>
          <Button variant="primary" disabled={objectives.length === 0 || busy} onClick={apply}>
            <Target className="h-4 w-4" /> Aplică la {clientIds.length}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-700 text-muted-foreground">Clienți selectați</p>
          <div className="flex flex-wrap gap-1.5">
            {clientNames.map((n) => (
              <span key={n} className="rounded-full bg-muted px-2.5 py-1 text-xs font-600">{n}</span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-700 text-muted-foreground">Obiective</p>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Scrie un obiectiv și apasă Adaugă…" />
            <Button type="submit" variant="primary" disabled={!draft.trim()}><Plus className="h-4 w-4" /> Adaugă</Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setObjectives((prev) => (prev.includes(p) ? prev : [...prev, p]))}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-xs font-600 text-primary transition hover:bg-primary/10"
              >
                <Sparkles className="h-3 w-3" /> {p}
              </button>
            ))}
          </div>

          <ul className="mt-4 space-y-1.5">
            {objectives.length === 0 && (
              <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Adaugă un obiectiv mai sus sau apasă pe o sugestie.
              </li>
            )}
            {objectives.map((o, i) => (
              <li key={`${o}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{o}</span>
                <button onClick={() => setObjectives((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
