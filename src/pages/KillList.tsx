import { useState } from "react";
import { PageHeader, Panel, Button, Input } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { PageSkeleton } from "@/components/Skeleton";
import { useKillList, type EvalCondition } from "@/lib/killlist";
import { useToast } from "@/lib/toast";
import { formatCurrency, cn } from "@/lib/utils";
import { Check, Lock, Plus, Target, Trash2, Trophy } from "lucide-react";

const lei = (n: number) => formatCurrency(n);
const condRight = (c: EvalCondition) => (c.kind === "consecutive_income" ? `${c.current} / ${c.target} luni` : `${lei(c.current)} / ${lei(c.target)}`);

export default function KillList() {
  const { loading, items, custom, toggleManual, addCustomItem, removeCustomItem, restoreCustomItem } = useKillList();
  const { push } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  if (loading) return <PageSkeleton variant="dashboard" />;

  const done = items.filter((i) => i.unlocked).length;
  const customIds = new Set(custom.map((c) => c.id));

  function submitNew() {
    if (!title.trim()) return;
    addCustomItem(title, note);
    push({ tone: "success", title: "Obiectiv adăugat", description: title.trim() });
    setTitle(""); setNote(""); setAddOpen(false);
  }

  // Instant removal + Undo toast: "Anulează" restores the objective identically
  // (id, title, note, ticked state). No confirm dialog.
  function onDelete(id: string, itemTitle: string) {
    const snap = removeCustomItem(id);
    if (!snap) return;
    push({ tone: "warning", title: "Obiectiv șters", description: itemTitle, action: { label: "Anulează", run: () => restoreCustomItem(snap) } });
  }

  return (
    <>
      <PageHeader title="Kill List" subtitle={`${done} din ${items.length} deblocate`} help="killlist">
        <Button variant="primary" className="min-h-[44px]" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Obiectiv nou
        </Button>
      </PageHeader>
      <div className="space-y-3">
        {items.map((item) => (
          <Panel key={item.id} className={cn("p-0 overflow-hidden", item.unlocked && "ring-1 ring-success/40")}>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.unlocked ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                {item.unlocked ? <Trophy className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <p className={cn("flex-1 font-display font-800", item.unlocked && "text-success")}>{item.title}</p>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-700", item.unlocked ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                {item.unlocked ? "Deblocat" : "Blocat"}
              </span>
              {customIds.has(item.id) && (
                <button
                  onClick={() => onDelete(item.id, item.title)}
                  aria-label="Șterge obiectivul"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-2 border-t border-border/60 px-4 py-3">
              {item.conditions.map((c, i) => (
                <div key={i}>
                  {c.numeric ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={cn("font-600", c.met ? "text-success" : "text-muted-foreground")}>{c.met && <Check className="mr-1 inline h-3.5 w-3.5" />}{c.label}</span>
                        <span className={cn("font-700", c.met ? "text-success" : "text-muted-foreground")}>{condRight(c)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all", c.met ? "bg-success" : "bg-primary")} style={{ width: `${Math.round(c.progress * 100)}%` }} />
                      </div>
                    </>
                  ) : c.manualKey ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-600">{c.label}</span>
                      <button
                        onClick={() => toggleManual(item.id, c.manualKey!)}
                        className={cn("inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 text-xs font-700 transition", c.met ? "bg-success/15 text-success" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                      >
                        {c.met ? <><Check className="h-3.5 w-3.5" /> Da</> : "Nu"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn("grid h-4 w-4 place-items-center rounded-full", c.met ? "bg-success/20 text-success" : "bg-muted text-muted-foreground")}>{c.met ? <Check className="h-3 w-3" /> : <Target className="h-3 w-3" />}</span>
                      <span className={cn("font-600", c.met ? "text-success" : "text-muted-foreground")}>{c.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Obiectiv nou" subtitle="Se bifează de mână când e gata" size="sm"
        footer={
          <>
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setAddOpen(false)}>Renunță</Button>
            <Button variant="primary" className="ml-auto min-h-[44px]" disabled={!title.trim()} onClick={submitNew}>Adaugă</Button>
          </>
        }>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submitNew(); }}>
          <div>
            <label className="mb-1.5 block text-xs font-700 text-muted-foreground">Titlu</label>
            <Input autoFocus className="h-12" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Al doilea client Constanța" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-700 text-muted-foreground">Notă (opțional)</label>
            <Input className="h-12" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce înseamnă gata" />
          </div>
          {/* Hidden submit so Enter in either field adds the objective. */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>
    </>
  );
}
