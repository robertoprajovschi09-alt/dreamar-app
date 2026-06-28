import { useEffect, useMemo, useState } from "react";
import { PageHeader, Button, Badge, Panel, SectionCard, SearchInput, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { SkeletonCard } from "@/components/Skeleton";
import { nicheLabels } from "@/data/sample";
import { useLibrary, type NewHookInput, type HookRow } from "@/lib/library";
import { useToast } from "@/lib/toast";
import { Anchor, Loader2, Pencil, Plus, Sparkles, Trash2, TrendingUp } from "lucide-react";

const platformsList = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];

export default function HookLibrary() {
  const { push } = useToast();
  const { hooks, loading, createHook, updateHook, deleteHook } = useLibrary();
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState("Toate");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<HookRow | null>(null);

  async function removeHook(h: HookRow) {
    const res = await deleteHook(h.id);
    if (res.error) push({ tone: "danger", title: "Nu s-a putut șterge", description: res.error });
    else push({ tone: "warning", title: "Hook șters" });
  }

  const niches = useMemo(() => ["Toate", ...[...new Set(hooks.map((h) => h.niche).filter(Boolean))].sort()], [hooks]);
  const filtered = hooks.filter(
    (h) => (niche === "Toate" || h.niche === niche) && (q === "" || h.text.toLowerCase().includes(q.toLowerCase()) || h.pattern.toLowerCase().includes(q.toLowerCase()))
  );

  // Winning patterns derived from the library: group by pattern, rank by count.
  const patterns = useMemo(() => {
    const map: Record<string, { count: number; score: number }> = {};
    hooks.forEach((h) => { if (!h.pattern) return; (map[h.pattern] ??= { count: 0, score: 0 }); map[h.pattern].count++; map[h.pattern].score += h.avgScore; });
    return Object.entries(map).map(([name, v]) => ({ name, count: v.count, avg: Math.round(v.score / v.count) })).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [hooks]);

  return (
    <>
      <PageHeader title="Bibliotecă de hook-uri și conținut" subtitle="Banca ta de hook-uri verificate, evaluate de AI">
        <Button variant="primary" onClick={() => setComposerOpen(true)}><Plus className="h-4 w-4" /> Salvează hook</Button>
      </PageHeader>

      {patterns.length > 0 && (
        <SectionCard title="Tipare câștigătoare" icon={Sparkles} subtitle="Tiparele care apar cel mai des în biblioteca ta">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {patterns.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="font-display text-lg font-800 text-success">{p.avg || "—"}</span>
                </div>
                <p className="mt-2 text-sm font-700">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.count} hook{p.count === 1 ? "" : "-uri"} · scor mediu</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <Panel className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Caută hook-uri…" className="sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:ml-auto">
          {niches.map((t) => (
            <button key={t} onClick={() => setNiche(t)} className={`rounded-full px-3 py-1.5 font-600 transition ${niche === t ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>{t}</button>
          ))}
        </div>
      </Panel>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : hooks.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Anchor className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Încă niciun hook</p>
          <p className="max-w-sm text-sm text-muted-foreground">Salvează aici hook-urile tale cu cele mai bune rezultate ca să construiești o bibliotecă reutilizabilă, evaluată de AI.</p>
          <Button variant="primary" className="mt-1" onClick={() => setComposerOpen(true)}><Plus className="h-4 w-4" /> Salvează primul tău hook</Button>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel className="py-12 text-center text-sm text-muted-foreground">Niciun hook nu corespunde căutării tale.</Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((h) => (
            <Panel key={h.id} className="group relative flex flex-col p-4">
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => setEditing(h)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Editează hook"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => removeHook(h)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-danger/10 hover:text-danger" title="Șterge hook"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex items-start gap-2 pr-14">
                <Anchor className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm font-600 leading-snug">"{h.text}"</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {h.niche && <Badge tone="primary">{h.niche}</Badge>}
                {h.platform && <Badge tone="neutral">{h.platform}</Badge>}
                {h.avgScore > 0 && <Badge tone="success">Scor {h.avgScore}</Badge>}
              </div>
              {h.result && <p className="mt-2 text-xs text-muted-foreground">{h.result}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{h.pattern || "—"}</span>
                <span className="font-700">Folosit de {h.uses}×</span>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <HookComposer open={composerOpen || !!editing} editing={editing} onClose={() => { setComposerOpen(false); setEditing(null); }}
        onSubmit={async (input) => {
          const res = editing ? await updateHook(editing.id, input) : await createHook(input);
          if (res.error) push({ tone: "danger", title: editing ? "Nu s-a putut actualiza hook-ul" : "Nu s-a putut salva hook-ul", description: res.error });
          else push({ tone: "success", title: editing ? "Hook actualizat" : "Hook salvat" });
          return res;
        }} />
    </>
  );
}

const nicheKeyForLabel = (label: string) => (Object.entries(nicheLabels).find(([, v]) => v === label)?.[0] ?? "");

function HookComposer({ open, editing, onClose, onSubmit }: {
  open: boolean; editing: HookRow | null; onClose: () => void;
  onSubmit: (input: NewHookInput) => Promise<{ error?: string }>;
}) {
  const [text, setText] = useState("");
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [pattern, setPattern] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setText(editing.text); setNiche(nicheKeyForLabel(editing.niche)); setPlatform(editing.platform || "Instagram"); setPattern(editing.pattern); setResult(editing.result);
    } else { setText(""); setNiche(""); setPlatform("Instagram"); setPattern(""); setResult(""); }
  }, [open, editing]);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const res = await onSubmit({ text: text.trim(), niche: niche || null, platform, pattern: pattern.trim(), result: result.trim() });
    setBusy(false);
    if (!res.error) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editează hook" : "Salvează un hook"} subtitle={editing ? "Actualizează acest hook" : "Adaugă un hook verificat în biblioteca ta"} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !text.trim()} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Salvează modificările" : "Salvează hook"}</Button></>}>
      <div className="space-y-4">
        <HField label="Textul hook-ului"><textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder='ex. "Acest apartament de 450k € s-a vândut în 3 zile pentru că…"' /></HField>
        <div className="grid grid-cols-2 gap-3">
          <HField label="Nișă"><Select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full"><option value="">Orice nișă</option>{(Object.keys(nicheLabels) as (keyof typeof nicheLabels)[]).map((k) => <option key={k} value={k}>{nicheLabels[k]}</option>)}</Select></HField>
          <HField label="Platformă"><Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full">{platformsList.map((p) => <option key={p}>{p}</option>)}</Select></HField>
        </div>
        <HField label="Tipar"><Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="ex. Curiozitate + ancoră de preț" /></HField>
        <HField label="Rezultat (opțional)"><Input value={result} onChange={(e) => setResult(e.target.value)} placeholder="ex. scor mediu 88 la 9 utilizări" /></HField>
      </div>
    </Modal>
  );
}

function HField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
