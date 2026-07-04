import { useState } from "react";
import { Modal } from "@/components/overlay";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { useClients } from "@/lib/clients";
import { nicheLabels, billingTypeLabels, type Niche, type BillingType } from "@/data/sample";
import { cn } from "@/lib/utils";
import {
  Building2,
  Car,
  Check,
  Dumbbell,
  Hotel,
  LayoutGrid,
  Loader2,
  Scissors,
  Sparkles,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

const nicheIcons: Record<Niche, typeof Building2> = {
  real_estate: Building2,
  restaurant: UtensilsCrossed,
  dental_clinic: Stethoscope,
  fitness_gym: Dumbbell,
  lounge: Wine,
  beauty: Scissors,
  auto: Car,
  hotel: Hotel,
  local_store: Store,
  custom: LayoutGrid,
};

const platforms = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
const steps = ["Date de bază", "Nișă", "Configurare"];

export function NewClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useToast();
  const { createClient } = useClients();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [retainer, setRetainer] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("retainer");
  const [deliverables, setDeliverables] = useState("");
  const [niche, setNiche] = useState<Niche | null>(null);
  const [picked, setPicked] = useState<string[]>(["Instagram"]);
  const [objectives, setObjectives] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep(0);
    setName(""); setCity(""); setPhone(""); setRetainer(""); setBillingType("retainer"); setDeliverables("");
    setNiche(null);
    setPicked(["Instagram"]);
    setObjectives(""); setNotes("");
    setBusy(false);
  }
  function close() {
    onClose();
    setTimeout(reset, 200);
  }
  async function create() {
    if (!niche || busy) return;
    const retainerNum = billingType === "retainer" && retainer ? Number(retainer) : null;
    if (retainerNum !== null && (!Number.isFinite(retainerNum) || retainerNum < 0)) {
      push({ tone: "danger", title: "Retainer invalid", description: "Introdu un număr pozitiv (lei)." });
      return;
    }
    const delNum = deliverables ? Number(deliverables) : null;
    setBusy(true);
    const res = await createClient({
      name: name.trim(),
      niche,
      city: city.trim(),
      phone: phone.trim(),
      contact: phone.trim(),
      retainer: retainerNum,
      billingType,
      deliverables: delNum && Number.isFinite(delNum) ? delNum : null,
      notes: notes.trim(),
      platforms: picked,
      objectives: objectives.split(/[\n,]/).map((o) => o.trim()).filter(Boolean),
    });
    setBusy(false);
    if (res.error) {
      push({ tone: "danger", title: "Clientul nu a putut fi creat", description: res.error });
      return;
    }
    push({ tone: "success", title: "Client creat", description: `${name || "Client nou"} · tabloul de bord ${nicheLabels[niche]} este gata` });
    close();
  }
  const canNext = step === 0 ? name.trim().length > 1 : step === 1 ? !!niche : true;

  return (
    <Modal open={open} onClose={close} title="Adaugă un client nou" subtitle="Configurează un spațiu de lucru dedicat și alege un tablou de bord pe nișă" size="lg">
      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-700", i < step ? "bg-success text-white" : i === step ? "gradient-primary text-white" : "bg-muted text-muted-foreground")}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("text-sm font-600", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nume client" full><Input autoFocus placeholder="ex. Altmark Residences" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim().length > 1) setStep(1); }} /></Field>
          <Field label="Oraș"><Input placeholder="Cluj-Napoca" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          <Field label="Telefon"><Input placeholder="07xx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Tip colaborare">
            <select value={billingType} onChange={(e) => setBillingType(e.target.value as BillingType)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm ring-focus">
              {(Object.keys(billingTypeLabels) as BillingType[]).map((k) => <option key={k} value={k}>{billingTypeLabels[k]}</option>)}
            </select>
          </Field>
          {billingType === "retainer"
            ? <Field label="Retainer lunar (lei)"><Input type="number" placeholder="2000" value={retainer} onChange={(e) => setRetainer(e.target.value)} /></Field>
            : <Field label="Retainer lunar (lei)"><Input disabled placeholder="—" value="" /></Field>}
          <Field label="Livrabile pe lună"><Input type="number" placeholder="8" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} /></Field>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">Fiecare nișă vine cu metrici, formulare și secțiuni de raport adaptate.</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(Object.keys(nicheLabels) as Niche[]).map((n) => {
              const Icon = nicheIcons[n];
              const active = niche === n;
              return (
                <button
                  key={n}
                  onClick={() => setNiche(n)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition",
                    active ? "border-primary bg-primary/[0.06] shadow-soft" : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <span className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "gradient-primary text-white" : "bg-primary/10 text-primary")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-700">{nicheLabels[n]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-700 text-muted-foreground">Platforme</p>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => {
                const on = picked.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))}
                    className={cn("rounded-full border px-3 py-1.5 text-sm font-600 transition", on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
                  >
                    {on && <Check className="mr-1 inline h-3.5 w-3.5" />}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Obiectivele lunii acesteia" full><textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Câte unul pe linie — ex. Generează 40 de lead-uri calificate, crește TikTok cu 15%…" /></Field>
          <Field label="Notițe" full><Input placeholder="Detalii interne despre client…" value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void create(); }} /></Field>
          <div className="flex items-center gap-2 rounded-lg bg-primary/[0.06] p-3 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Un tablou de bord {niche ? nicheLabels[niche] : "personalizat"}, un calendar și un șablon de raport vor fi create automat.</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={step === 0 ? close : () => setStep((s) => s - 1)}>
          {step === 0 ? "Anulează" : "Înapoi"}
        </Button>
        {step < 2 ? (
          <Button variant="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continuă</Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={create}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Creează client
          </Button>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
