import { useEffect, useState } from "react";
import { Modal } from "@/components/overlay";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const QUALITY = [{ v: "bune", label: "Bune" }, { v: "ok", label: "Ok" }, { v: "slabe", label: "Slabe" }];

export function WeeklyPulse({ open, onClose, clientId, agencyId, onSaved }: {
  open: boolean; onClose: () => void; clientId: string; agencyId: string; onSaved: () => void;
}) {
  const { push } = useToast();
  const [closed, setClosed] = useState(0);
  const [revenue, setRevenue] = useState("");
  const [quality, setQuality] = useState("");
  const [sat, setSat] = useState(0);
  const [improve, setImprove] = useState("");
  const [saving, setSaving] = useState(false);

  // Start from last month's answers — most clients report similar numbers,
  // so editing beats typing from zero.
  useEffect(() => {
    if (!open) return;
    let last: { closed?: number; revenue?: string; quality?: string; sat?: number } = {};
    try { last = JSON.parse(localStorage.getItem(`dreamar-pulse-${clientId}`) || "{}"); } catch { /* ignore */ }
    setClosed(last.closed ?? 0); setRevenue(last.revenue ?? ""); setQuality(last.quality ?? ""); setSat(last.sat ?? 0); setImprove(""); setSaving(false);
  }, [open, clientId]);

  async function save() {
    if (saving || !supabase) return;
    setSaving(true);
    const row = {
      agency_id: agencyId, client_id: clientId, period_month: firstOfMonthISO(), source: "client",
      customers_closed: closed,
      revenue_estimate: revenue === "" ? 0 : Number(revenue),
      lead_quality: quality || null,
      client_satisfaction: sat || null,
      qualitative_feedback: improve.trim() || null,
    };
    const { error } = await supabase.from("business_impact_entries").upsert(row, { onConflict: "client_id,period_month,source" }).select();
    setSaving(false);
    if (error) { push({ tone: "danger", title: "Nu am putut trimite", description: error.message }); return; }
    try { localStorage.setItem(`dreamar-pulse-${clientId}`, JSON.stringify({ closed, revenue, quality, sat })); } catch { /* ignore */ }
    push({ tone: "success", title: "Mulțumim", description: "Echipa ta a primit rezultatele." });
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Cum a mers?" subtitle="Durează 20 de secunde — cifrele tale reale ne ajută cel mai mult" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Mai târziu</Button><Button variant="primary" className="ml-auto" disabled={saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Trimite</Button></>}>
      <div className="space-y-6">
        <div>
          <p className="mb-2.5 text-sm font-700">Câți clienți noi ai închis?</p>
          <div className="flex items-center gap-4">
            <button onClick={() => setClosed((c) => Math.max(0, c - 1))} aria-label="Scade" className="grid h-12 w-12 place-items-center rounded-xl border border-border text-muted-foreground transition active:scale-95"><Minus className="h-5 w-5" /></button>
            <span className="min-w-[2ch] text-center font-display text-3xl font-800">{closed}</span>
            <button onClick={() => setClosed((c) => c + 1)} aria-label="Crește" className="grid h-12 w-12 place-items-center rounded-xl border border-border text-muted-foreground transition active:scale-95"><Plus className="h-5 w-5" /></button>
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-sm font-700">Cât estimezi că au adus în vânzări? (€)</p>
          <Input type="number" inputMode="numeric" min={0} value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="ex. 4000" className="h-12 text-lg" />
        </div>

        <div>
          <p className="mb-2.5 text-sm font-700">Cum au fost contactele primite?</p>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY.map((q) => (
              <button key={q.v} onClick={() => setQuality(q.v)} className={cn("h-12 rounded-xl border text-sm font-700 transition", quality === q.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{q.label}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-sm font-700">Cât de mulțumit ești?</p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setSat(n)} className={cn("grid h-12 flex-1 place-items-center rounded-xl border text-base font-800 transition", sat === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{n}</button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>Deloc mulțumit</span><span>Foarte mulțumit</span></div>
        </div>

        <div>
          <p className="mb-2.5 text-sm font-700">Vrei să schimbăm ceva? <span className="font-500 text-muted-foreground">(opțional)</span></p>
          <textarea value={improve} onChange={(e) => setImprove(e.target.value)} className="min-h-[64px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. aș vrea mai multe filmări cu echipa" />
        </div>
      </div>
    </Modal>
  );
}
