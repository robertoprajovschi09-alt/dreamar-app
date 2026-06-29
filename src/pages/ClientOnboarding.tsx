import { useMemo, useState } from "react";
import { Button, Input, Select, Panel } from "@/components/ui";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { nicheSpec, onboardingSteps, NICHE_ICONS, type OnboardingQuestion, type NicheKey } from "@/lib/niches";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Sparkles, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Answers = Record<string, string | string[]>;
type Step = { kind: "questions" | "objectives"; title: string; subtitle: string; questions: OnboardingQuestion[] };

export default function ClientOnboarding() {
  const { live, viewerClientId, viewerClientName, viewerAgencyName, viewerNiche, refreshViewer } = useWorkspace();
  const { push } = useToast();
  const spec = nicheSpec(viewerNiche);
  const Icon = NICHE_ICONS[(viewerNiche as NicheKey)] ?? NICHE_ICONS.custom;

  const steps: Step[] = useMemo(() => {
    const q = onboardingSteps(viewerNiche);
    return [
      { kind: "questions", ...q[0] },
      { kind: "questions", ...q[1] },
      { kind: "objectives", title: "Alege obiectivele lunii acesteia", subtitle: "Bifează obiectivele pe care vrei să le urmărim — sau adaugă-le pe ale tale", questions: [] },
      { kind: "questions", ...q[2] },
      { kind: "questions", ...q[3] },
    ];
  }, [viewerNiche]);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [objectives, setObjectives] = useState<string[]>([]);
  const [customObj, setCustomObj] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setText = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggleChip = (id: string, opt: string) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return { ...a, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  const toggleObjective = (o: string) => setObjectives((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  const addCustomObjective = () => {
    const v = customObj.trim();
    if (v && !objectives.includes(v)) setObjectives((p) => [...p, v]);
    setCustomObj("");
  };

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  const has = (id: string) => {
    const v = answers[id];
    return Array.isArray(v) ? v.length > 0 : !!(v && (v as string).trim());
  };
  const canNext = (() => {
    if (cur.kind === "objectives") return objectives.length > 0;
    if (step === 0) return has("brand_voice") && has("target_audience");
    if (step === 1) return has("primary_goal");
    return true; // niche specifics + final touches are optional
  })();

  async function submit() {
    setSubmitting(true);
    const str = (id: string) =>
      typeof answers[id] === "string" ? (answers[id] as string).trim() : Array.isArray(answers[id]) ? (answers[id] as string[]).join(", ") : "";
    const brandVoice = Array.isArray(answers.brand_voice) ? (answers.brand_voice as string[]).join(", ") : "";
    const goals = str("top_goals").split("\n").map((g) => g.trim()).filter(Boolean);
    // brand_profile = everything except the first-class columns (brand_voice/target_audience/objectives/goals)
    const profile: Record<string, unknown> = {
      primary_goal: str("primary_goal"),
      usps: str("usps"),
      current_offers: str("current_offers"),
      avoid: str("avoid"),
    };
    for (const q of spec.extraQuestions) profile[q.id] = answers[q.id] ?? (q.type === "chips" ? [] : "");

    if (!live || !supabase) {
      push({ tone: "info", title: "Mod demo", description: "Onboarding-ul se salvează în portalul live." });
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.rpc("submit_client_onboarding", {
      p_client_id: viewerClientId,
      p_brand_voice: brandVoice || null,
      p_target_audience: str("target_audience") || null,
      p_objectives: objectives,
      p_goals: goals,
      p_brand_profile: profile,
    });
    setSubmitting(false);
    if (error) {
      push({ tone: "danger", title: "Nu am putut salva", description: error.message });
      return;
    }
    push({ tone: "success", title: "Gata! 🎉", description: "Agenția ta are acum tot ce îi trebuie ca să înceapă." });
    refreshViewer();
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Welcome header */}
      <div className="gradient-hero relative mb-5 overflow-hidden rounded-2xl p-6 text-white">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur"><Icon className="h-6 w-6" /></span>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Bun venit{viewerAgencyName ? ` la ${viewerAgencyName}` : ""}</p>
            <h1 className="font-display text-xl font-800">Hai să configurăm {viewerClientName || "brandul tău"}</h1>
            <p className="mt-0.5 text-sm text-white/80">Câteva întrebări, ca agenția ta să creeze conținut care sună exact ca tine — durează ~3 minute.</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-5 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.title} className="flex flex-1 items-center gap-2">
            <div className={cn("h-1.5 flex-1 rounded-full transition", i <= step ? "bg-primary" : "bg-border")} />
          </div>
        ))}
      </div>

      <Panel className="p-6">
        <p className="text-[11px] font-700 uppercase tracking-wide text-primary">Pasul {step + 1} din {steps.length}</p>
        <h2 className="mt-1 font-display text-lg font-800">{cur.title}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{cur.subtitle}</p>

        {cur.kind === "objectives" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {spec.objectivePresets.map((o) => {
                const on = objectives.includes(o);
                return (
                  <button key={o} onClick={() => toggleObjective(o)} className={cn("rounded-full border px-3 py-2 text-left text-xs font-600 transition", on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                    {on ? <Check className="mr-1 inline h-3.5 w-3.5" /> : <Target className="mr-1 inline h-3.5 w-3.5" />}
                    {o}
                  </button>
                );
              })}
            </div>
            {/* custom objectives the user added that aren't presets */}
            {objectives.filter((o) => !spec.objectivePresets.includes(o)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {objectives.filter((o) => !spec.objectivePresets.includes(o)).map((o) => (
                  <span key={o} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-2 text-xs font-600 text-primary">
                    {o}<button onClick={() => toggleObjective(o)}><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input value={customObj} onChange={(e) => setCustomObj(e.target.value)} placeholder="Adaugă un obiectiv al tău…" onKeyDown={(e) => { if (e.key === "Enter") addCustomObjective(); }} />
              <Button variant="outline" onClick={addCustomObjective} disabled={!customObj.trim()}><Plus className="h-4 w-4" /> Adaugă</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {cur.questions.map((q) => (
              <QuestionField key={q.id} q={q} value={answers[q.id]} onText={(v) => setText(q.id, v)} onToggle={(opt) => toggleChip(q.id, opt)} />
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" className="w-full sm:w-auto" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}><ChevronLeft className="h-4 w-4" /> Înapoi</Button>
          {isLast ? (
            <Button variant="primary" className="w-full sm:w-auto" disabled={submitting} onClick={submit}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Finalizează și trimite agenției</Button>
          ) : (
            <Button variant="primary" className="w-full sm:w-auto" disabled={!canNext} onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>Continuă <ChevronRight className="h-4 w-4" /></Button>
          )}
        </div>
      </Panel>
      <p className="mt-3 text-center text-xs text-muted-foreground">Poți actualiza oricare dintre acestea mai târziu împreună cu agenția ta.</p>
    </div>
  );
}

function QuestionField({ q, value, onText, onToggle }: { q: OnboardingQuestion; value: string | string[] | undefined; onText: (v: string) => void; onToggle: (opt: string) => void }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div>
      <label className="text-sm font-700">{q.label}</label>
      {q.help && <p className="mb-2 mt-0.5 text-xs text-muted-foreground">{q.help}</p>}
      {!q.help && <div className="mb-2" />}
      {q.type === "text" && <Input value={(value as string) ?? ""} onChange={(e) => onText(e.target.value)} placeholder={q.placeholder} />}
      {q.type === "textarea" && (
        <textarea value={(value as string) ?? ""} onChange={(e) => onText(e.target.value)} placeholder={q.placeholder} className="min-h-[88px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" />
      )}
      {q.type === "select" && (
        <Select value={(value as string) ?? ""} onChange={(e) => onText(e.target.value)}>
          <option value="">Selectează…</option>
          {q.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      )}
      {q.type === "chips" && (
        <div className="flex flex-wrap gap-1.5">
          {q.options?.map((o) => {
            const on = selected.includes(o);
            return (
              <button key={o} onClick={() => onToggle(o)} className={cn("rounded-full border px-3 py-1.5 text-xs font-600 transition", on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                {on && <Check className="mr-1 inline h-3 w-3" />}{o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
