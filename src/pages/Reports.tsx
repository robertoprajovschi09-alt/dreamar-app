import { useState } from "react";
import { PageHeader, Button, Badge, Panel, Select } from "@/components/ui";
import { reportSections } from "@/data/sample";
import { useWorkspace } from "@/lib/workspace";
import { AiComingSoon } from "@/components/AiSoon";
import { Check, Download, FileText, Loader2, Pencil, Plus, RotateCw, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const seed: Record<string, string> = {
  "Rezumat executiv":
    "Iunie a fost cea mai bună lună de până acum pentru Altmark. Reach-ul a crescut cu 32%, iar formatul TikTok de tur de proprietate a adus un plus de 3,2× față de benchmark, generând 37 de cereri de vizionare calificate la un cost de €6,40 per lead.",
  "Conținut cu cea mai bună performanță":
    "„Acest apartament de €450k s-a vândut în 3 zile pentru că…” — 184k vizualizări, retenție de 71% la 3 secunde, 64 DM-uri. Hook-ul cu curiozitate + ancoră de preț este acum un câștigător care se repetă.",
  "Impact în afacere":
    "9 oferte primite (3 peste prețul cerut), 37 de vizionări programate, 2 unități rezervate. Pipeline atribuibil estimat: €430k.",
  "Strategia pentru luna viitoare":
    "Mizează puternic pe tururile complete, testează o serie de obiecții ale cumpărătorului și lansează un format de dovadă socială „vândut în X zile” pe TikTok și Reels.",
};

type Section = { id: string; title: string; body: string; done: boolean };

const altText =
  "Regenerat de AI din cele mai recente videoclipuri, metrici și feedback ale acestui client. Editează liber această ciornă înainte de export.";

export default function Reports() {
  const { live } = useWorkspace();
  const [sections, setSections] = useState<Section[]>(
    reportSections.map((title, i) => ({
      id: `s${i}`,
      title,
      body: seed[title] ?? "Analiză schițată de AI pentru această secțiune, pe baza videoclipurilor, metricilor, feedback-ului și obiectivelor acestui client. Complet editabilă înainte de export.",
      done: !!seed[title],
    }))
  );
  const [activeId, setActiveId] = useState("s0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [genAll, setGenAll] = useState(false);
  const [client, setClient] = useState("Altmark Residences");

  const completed = sections.filter((s) => s.done).length;

  function startEdit(s: Section) {
    setEditingId(s.id);
    setDraft(s.body);
  }
  function saveEdit() {
    setSections((prev) => prev.map((s) => (s.id === editingId ? { ...s, body: draft } : s)));
    setEditingId(null);
  }
  function regenerate(id: string) {
    setGeneratingId(id);
    window.setTimeout(() => {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, body: altText, done: true } : s)));
      setGeneratingId(null);
    }, 1100);
  }
  function regenerateAll() {
    setGenAll(true);
    window.setTimeout(() => setGenAll(false), 1600);
  }
  function toggleDone(id: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }
  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }
  function addSection() {
    const id = `s${Date.now()}`;
    setSections((prev) => [...prev, { id, title: "Secțiune nouă", body: "Apasă pe Editează pentru a scrie această secțiune sau pe Regenerează pentru a o schița cu AI.", done: false }]);
    setActiveId(id);
    setTimeout(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
  function goTo(id: string) {
    setActiveId(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (live) return (
    <AiComingSoon
      title="Rapoarte lunare AI"
      subtitle="Rapoarte de performanță generate automat din datele clientului"
      blurb="Rapoartele AI vor genera automat rezumate lunare din videoclipuri, metrici și feedback-ul clienților. Până le activăm, urmărești rezultatele în Tablou și în profilul fiecărui client, iar impactul în Profilul clientului → Impact în afacere."
    />
  );

  return (
    <>
      <PageHeader title="Rapoarte lunare AI" subtitle={`${completed} din ${sections.length} secțiuni gata · editabile înainte de export`}>
        <Select value={client} onChange={(e) => setClient(e.target.value)} className="h-10">
          {["Altmark Residences", "IronPeak Gym", "AuraLux Beauty"].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Button variant="outline" onClick={regenerateAll} disabled={genAll}>
          {genAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Regenerează
        </Button>
        <Button variant="primary" onClick={() => window.print()}><Download className="h-4 w-4" /> Exportă PDF</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        {/* Section nav */}
        <Panel className="h-fit p-3 lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Secțiuni</p>
            <button onClick={addSection} className="text-primary" title="Adaugă secțiune"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-600 transition",
                  activeId === s.id ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full", s.done ? "bg-success text-white" : "border border-border")}>
                  {s.done && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="flex-1 truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </Panel>

        {/* Report paper */}
        <Panel className="overflow-hidden p-0">
          <div className="gradient-hero flex items-center justify-between px-8 py-7 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 font-display text-lg font-800 backdrop-blur">NV</span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Raport lunar de performanță</p>
                <p className="font-display text-xl font-800">{client}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-800">Iunie 2026</p>
              <p className="text-xs text-white/70">Pregătit de Nova Creative</p>
            </div>
          </div>

          <div className="space-y-5 p-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge tone="warning">Ciornă · editabilă</Badge>
              <span>{completed}/{sections.length} secțiuni marcate ca gata</span>
            </div>

            {sections.map((s) => {
              const isEditing = editingId === s.id;
              const isGen = generatingId === s.id || genAll;
              return (
                <section
                  key={s.id}
                  id={`sec-${s.id}`}
                  className={cn("group rounded-xl border p-5 transition", activeId === s.id ? "border-primary/40 bg-primary/[0.03]" : "border-border")}
                  onMouseEnter={() => setActiveId(s.id)}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-800">{s.title}</h3>
                      {s.done && <Badge tone="success">Gata</Badge>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      {!isEditing && (
                        <>
                          <IconBtn title="Editează" onClick={() => startEdit(s)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn title="Regenerează cu AI" onClick={() => regenerate(s.id)}>
                            {generatingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                          </IconBtn>
                          <IconBtn title={s.done ? "Marchează ca ciornă" : "Marchează ca gata"} onClick={() => toggleDone(s.id)}>
                            <Check className={cn("h-3.5 w-3.5", s.done && "text-success")} />
                          </IconBtn>
                          <IconBtn title="Elimină" onClick={() => removeSection(s.id)}><Trash2 className="h-3.5 w-3.5 text-danger" /></IconBtn>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div>
                      <textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="min-h-[120px] w-full rounded-lg border border-input bg-card p-3 text-sm leading-relaxed ring-focus"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Button variant="primary" size="sm" onClick={saveEdit}><Check className="h-3.5 w-3.5" /> Salvează</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /> Anulează</Button>
                      </div>
                    </div>
                  ) : isGen ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Se generează cu Claude…
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  )}
                </section>
              );
            })}

            <button onClick={addSection} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-600 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
              <Plus className="h-4 w-4" /> Adaugă secțiune
            </button>

            <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> PDF white-label cu logo-urile agenției + clientului</span>
              <Button variant="primary" size="sm" onClick={() => window.print()}><Download className="h-4 w-4" /> Exportă</Button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
