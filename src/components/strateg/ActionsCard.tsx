import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { validateBlock, SAFE_OPS, useActionExecutor, type ActionRow, type Candidate, type ExecResult, type OpKind } from "@/lib/strategActions";
import { AlertTriangle, Check, ListChecks, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The "actiuni" block: a checklist card. Safe operations come pre-checked;
 * sensitive ones (deletes, status changes) start unchecked with a warning
 * accent. Nothing runs without the tap on "Aplică (n)". Failed rows don't stop
 * the rest; an ambiguous title match asks the user to pick, never guesses.
 */

type RowResult = ExecResult | null;
type Executor = ReturnType<typeof useActionExecutor>;

export function ActionsCard({ ops, executor, onApplied }: {
  ops: unknown[];
  executor: Executor;
  onApplied: (action: string, label: string) => void;   // journal hook-in
}) {
  const rows = useMemo(() => validateBlock(ops), [ops]);
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    (rows ?? []).forEach((r) => { init[r.idx] = r.valid && SAFE_OPS.includes(r.kind); });
    return init;
  });
  const [results, setResults] = useState<Record<number, RowResult>>({});
  const [choose, setChoose] = useState<Record<number, Candidate[]>>({});
  const [applying, setApplying] = useState(false);

  if (!rows) return null; // not an array: the parser already fell back to text

  const pendingChecked = rows.filter((r) => r.valid && checked[r.idx] && !results[r.idx] && !choose[r.idx]);
  const n = pendingChecked.length;
  const remaining = rows.filter((r) => r.valid && !results[r.idx] && !choose[r.idx]).length;
  const okCount = Object.values(results).filter((r) => r?.ok).length;
  const failCount = Object.values(results).filter((r) => r && !r.ok).length;

  async function runOne(row: ActionRow, resolvedId: string | null) {
    const res = await executor.execute(row, resolvedId);
    setResults((p) => ({ ...p, [row.idx]: res }));
    if (res.ok && row.valid) onApplied(row.kind, res.label);
  }

  async function apply() {
    if (applying || n === 0) return;
    setApplying(true);
    for (const row of pendingChecked) {
      const r = executor.resolve(row);
      if (r.kind === "missing") { setResults((p) => ({ ...p, [row.idx]: { ok: false, error: r.error } })); continue; }
      if (r.kind === "ambiguous") { setChoose((p) => ({ ...p, [row.idx]: r.candidates })); continue; }
      await runOne(row, r.kind === "ok" ? r.id : null);
    }
    setApplying(false);
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[hsl(var(--strateg))]/35 bg-[hsl(var(--strateg))]/[0.05] animate-scale-in motion-reduce:animate-none">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--strateg))]/20 px-3 py-2">
        <ListChecks className="h-4 w-4 text-[hsl(var(--strateg))]" />
        <span className="text-sm font-800">Strategul vrea să facă {rows.length} {rows.length === 1 ? "operație" : "operații"}</span>
      </div>

      <div className="divide-y divide-border/40">
        {rows.map((row) => {
          const sensitive = row.valid && !SAFE_OPS.includes(row.kind);
          const res = results[row.idx] ?? null;
          const cands = choose[row.idx];
          return (
            <div key={row.idx} className={cn("px-3 py-2", sensitive && !res && "bg-[hsl(var(--warning))]/[0.06]")}>
              <div className="flex items-start gap-2.5">
                {/* checkbox / result icon */}
                {res ? (
                  res.ok
                    ? <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-success/15 text-success"><Check className="h-4 w-4" /></span>
                    : <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-danger/15 text-danger"><AlertTriangle className="h-3.5 w-3.5" /></span>
                ) : (
                  <button
                    onClick={() => row.valid && !cands && setChecked((p) => ({ ...p, [row.idx]: !p[row.idx] }))}
                    disabled={!row.valid || !!cands || applying}
                    aria-label={checked[row.idx] ? "Debifează" : "Bifează"} aria-pressed={!!checked[row.idx]}
                    // 44px tap zone via padding; the visible square stays 24px
                    // (negative margin keeps the row layout unchanged).
                    className="-m-2.5 mt-[-8px] grid h-11 w-11 shrink-0 place-items-center">
                    <span className={cn("grid h-6 w-6 place-items-center rounded-md border transition",
                      checked[row.idx] ? "border-transparent bg-[hsl(var(--strateg))] text-[hsl(var(--strateg-foreground))]" : "border-border bg-card text-transparent",
                      (!row.valid || cands) && "opacity-40")}>
                      <Check className="h-4 w-4" />
                    </span>
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !row.valid && "text-muted-foreground line-through")}>
                    {row.valid ? row.summary : `Operație respinsă`}
                    {sensitive && !res && <span className="ml-1.5 rounded bg-[hsl(var(--warning))]/15 px-1.5 py-0.5 text-[10px] font-800 uppercase text-[hsl(var(--warning))]">sensibilă</span>}
                  </p>
                  {!row.valid && <p className="text-xs text-danger">{row.error}</p>}
                  {res && !res.ok && <p className="text-xs text-danger">{res.error}</p>}
                  {res && res.ok && res.to && <Link to={res.to} className="text-xs font-700 text-[hsl(var(--strateg))] underline">Deschide</Link>}

                  {/* ambiguous: pick the object, never guess */}
                  {cands && !res && (
                    <div className="mt-1.5 rounded-lg border border-border bg-card p-2">
                      <p className="mb-1.5 text-xs font-700 text-muted-foreground">Alege obiectul:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cands.map((c) => (
                          <button key={c.id} onClick={() => { setChoose((p) => { const q = { ...p }; delete q[row.idx]; return q; }); void runOne(row, c.id); }}
                            className="min-h-[44px] rounded-full border border-border px-3.5 py-1 text-xs font-600 transition hover:border-[hsl(var(--strateg))] hover:bg-[hsl(var(--strateg))]/10">
                            {c.label}
                          </button>
                        ))}
                        <button onClick={() => { setChoose((p) => { const q = { ...p }; delete q[row.idx]; return q; }); setResults((p) => ({ ...p, [row.idx]: { ok: false, error: "Sărit: nu ai ales obiectul." } })); }}
                          className="min-h-[44px] rounded-full px-3.5 py-1 text-xs font-600 text-muted-foreground hover:bg-muted">
                          Sari peste
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-[hsl(var(--strateg))]/20 px-3 py-2">
        {remaining > 0 ? (
          <>
            <button onClick={() => void apply()} disabled={applying || n === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[hsl(var(--strateg))] px-4 py-1.5 text-xs font-700 text-[hsl(var(--strateg-foreground))] transition hover:opacity-90 disabled:opacity-50">
              {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Aplică ({n})
            </button>
            {(okCount > 0 || failCount > 0) && <span className="text-xs text-muted-foreground">{okCount} aplicate · {failCount} picate</span>}
          </>
        ) : (
          <span className="text-xs font-700 text-muted-foreground">Gata. {okCount} aplicate, {failCount} picate.</span>
        )}
      </div>
    </div>
  );
}
export type { OpKind };
