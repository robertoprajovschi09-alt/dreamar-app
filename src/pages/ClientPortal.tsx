import { useEffect, useState } from "react";
import { Panel, Button, Badge, SectionCard, Select, Input } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { nicheSpec, NICHE_ICONS, type NicheKey, type MetricField } from "@/lib/niches";
import { Check, CheckCircle2, FileText, Loader2, Sparkles, Target, ThumbsUp, X } from "lucide-react";

type Pending = { approvalId: string; title: string; platform: string };
type Impact = Partial<Record<MetricField, number>> & { qualitative_feedback?: string; objections_heard?: string };

const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const monthLabel = (d = new Date()) => d.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn" };
const fmt = (field: MetricField, v: number) =>
  field === "revenue_estimate" ? (v >= 1000 ? `€${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `€${v}`) : String(v ?? 0);

export default function ClientPortal() {
  const { live, isViewer, viewerClientId, viewerClientName, viewerAgencyName, viewerNiche } = useWorkspace();
  const { push } = useToast();
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string; niche: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const clientId = isViewer ? viewerClientId : selectedId;

  const [name, setName] = useState(viewerClientName || "Brandul tău");
  const [niche, setNiche] = useState<string>(viewerNiche || "custom");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [impact, setImpact] = useState<Impact>({});
  const [clientReported, setClientReported] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(live);
  const [reportOpen, setReportOpen] = useState(false);

  const spec = nicheSpec(niche);
  const Icon = NICHE_ICONS[(niche as NicheKey)] ?? NICHE_ICONS.custom;

  // Agency preview: pick which client's portal to preview.
  useEffect(() => {
    if (!live || isViewer || !supabase) return;
    (async () => {
      const { data } = await supabase!.from("clients").select("id, name, niche").is("archived_at", null).order("created_at", { ascending: false });
      const opts = (data ?? []) as { id: string; name: string; niche: string }[];
      setClientOptions(opts);
      setSelectedId((cur) => cur || opts[0]?.id || "");
    })();
  }, [live, isViewer]);

  async function loadPortal() {
    if (!live || !supabase || !clientId) return;
    setLoading(true);
    const month = firstOfMonthISO();
    const [cl, entries, approvals] = await Promise.all([
      supabase.from("clients").select("name, niche, objectives, agency_id").eq("id", clientId).maybeSingle(),
      supabase.from("business_impact_entries").select("source, calls_received, relevant_dms, bookings, appointments, orders, sales, viewings, contracts, revenue_estimate, qualitative_feedback, objections_heard").eq("client_id", clientId).eq("period_month", month),
      supabase.from("approvals").select("id, entity_id").eq("client_id", clientId).eq("entity_type", "post").eq("status", "pending"),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = entries.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientRow = rows.find((r) => r.source === "client");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agencyRow = rows.find((r) => r.source === "agency");
    const FIELDS: MetricField[] = ["calls_received", "relevant_dms", "bookings", "appointments", "orders", "sales", "viewings", "contracts", "revenue_estimate"];
    const merged: Impact = {};
    for (const f of FIELDS) merged[f] = Number((clientRow?.[f] ?? agencyRow?.[f]) ?? 0);
    merged.qualitative_feedback = clientRow?.qualitative_feedback ?? "";
    merged.objections_heard = clientRow?.objections_heard ?? "";
    setImpact(merged);
    setClientReported(!!clientRow);

    let pend: Pending[] = [];
    const appr = approvals.data ?? [];
    if (appr.length) {
      const ids = appr.map((a) => a.entity_id);
      const posts = (await supabase.from("content_posts").select("id, title, platform").in("id", ids)).data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byId: Record<string, any> = Object.fromEntries(posts.map((p) => [p.id, p]));
      pend = appr.filter((a) => byId[a.entity_id]).map((a) => ({ approvalId: a.id, title: byId[a.entity_id].title, platform: byId[a.entity_id].platform ? (PLATFORM_LABEL[byId[a.entity_id].platform] ?? byId[a.entity_id].platform) : "" }));
    }

    setName(cl.data?.name ?? viewerClientName ?? "Brandul tău");
    setNiche(cl.data?.niche ?? viewerNiche ?? "custom");
    setObjectives(cl.data?.objectives ?? []);
    setAgencyId(cl.data?.agency_id ?? "");
    setPending(pend);
    setLoading(false);
  }

  useEffect(() => {
    if (!live) { setLoading(false); return; }
    if (!clientId) { setLoading(!isViewer && clientOptions.length === 0 ? false : true); return; }
    void loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, clientId]);

  async function decide(approvalId: string, title: string, approved: boolean) {
    setPending((p) => p.filter((x) => x.approvalId !== approvalId));
    if (live && supabase) {
      const { error } = await supabase.from("approvals").update({ status: approved ? "approved" : "rejected" }).eq("id", approvalId);
      if (error) { push({ tone: "danger", title: "Nu am putut înregistra decizia", description: error.message }); void loadPortal(); return; }
    }
    push({ tone: approved ? "success" : "warning", title: approved ? "Conținut aprobat" : "Modificări cerute", description: title });
  }

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (live && !isViewer && clientOptions.length === 0) {
    return <Panel className="py-16 text-center text-sm text-muted-foreground">Adaugă mai întâi un client — previzualizarea portalului său va apărea aici.</Panel>;
  }

  const agencyLabel = isViewer ? (viewerAgencyName || "agenția ta") : "agenția ta";

  return (
    <>
      {/* Hero */}
      <Panel className="gradient-hero relative overflow-hidden p-6 text-white">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur"><Icon className="h-6 w-6" /></span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">{spec.displayLabel} · susținut de {agencyLabel}</p>
              <h1 className="font-display text-xl font-800">{name}</h1>
            </div>
          </div>
          {!isViewer && live ? (
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-9 max-w-[200px] border-white/30 bg-white/10 text-white">
              {clientOptions.map((c) => <option key={c.id} value={c.id} className="text-foreground">{c.name}</option>)}
            </Select>
          ) : (
            <Badge tone="primary" className="bg-white/20 text-white">{monthLabel()}</Badge>
          )}
        </div>
      </Panel>

      {/* Niche KPIs (this month) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {spec.portalKpis.map((k) => (
          <Panel key={k.field} className="p-5">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-800">{fmt(k.field, impact[k.field] ?? 0)}</p>
          </Panel>
        ))}
      </div>

      {/* The monthly report CTA — the heart of the simple client dashboard */}
      <Panel className={cnReport(clientReported)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${clientReported ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
              {clientReported ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </span>
            <div>
              <p className="font-display text-base font-800">{clientReported ? `Mulțumim — datele pentru ${monthLabel()} au ajuns!` : `Cum a mers ${monthLabel()}?`}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {clientReported
                  ? "Agenția ta are cifrele tale pe luna aceasta. Le poți actualiza oricând."
                  : "Apasă mai jos și spune-ne ce s-a întâmplat de fapt — apeluri, rezervări, vânzări, ce au zis clienții. Durează un minut și face conținutul tău mai precis."}
              </p>
            </div>
          </div>
          <Button variant={clientReported ? "outline" : "primary"} className="shrink-0" onClick={() => setReportOpen(true)}>
            {clientReported ? "Actualizează luna aceasta" : `Actualizează ${monthLabel().split(" ")[0]}`}
          </Button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Objectives */}
        <SectionCard title="Obiectivele lunii acesteia" icon={Target}>
          {objectives.length ? (
            <div className="flex flex-wrap gap-1.5">
              {objectives.map((o, i) => <span key={`${o}-${i}`} className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-600 text-primary">{o}</span>)}
            </div>
          ) : <p className="text-xs text-muted-foreground">Agenția ta nu a stabilit încă obiective pentru luna aceasta.</p>}
        </SectionCard>

        {/* Approvals */}
        <SectionCard title="Aprobă conținut" subtitle={pending.length ? `${pending.length} element${pending.length === 1 ? "" : "e"} așteaptă verificarea ta` : "Ești la zi"}>
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.approvalId} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="flex-1 text-sm font-600">{a.title}</p>
                  {a.platform && <Badge tone="neutral">{a.platform}</Badge>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => decide(a.approvalId, a.title, false)}><X className="h-3.5 w-3.5" /> Cere modificări</Button>
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => decide(a.approvalId, a.title, true)}><Check className="h-3.5 w-3.5" /> Aprobă</Button>
                </div>
              </div>
            ))}
            {pending.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
                <Check className="h-6 w-6 text-success" />
                <p className="text-sm font-600">Nimic de verificat</p>
                <p className="text-xs text-muted-foreground">Conținutul nou va apărea aici pentru aprobarea ta.</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <MonthlyReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        niche={niche}
        prefill={impact}
        onSaved={(merged) => { setImpact(merged); setClientReported(true); setReportOpen(false); }}
        clientId={clientId}
        agencyId={agencyId}
        live={live}
      />
    </>
  );
}

function cnReport(done: boolean) {
  return `p-5 ${done ? "border-success/30 bg-success/5" : "border-primary/30 bg-primary/5"}`;
}

function MonthlyReportModal({ open, onClose, niche, prefill, onSaved, clientId, agencyId, live }: {
  open: boolean; onClose: () => void; niche: string; prefill: Impact;
  onSaved: (merged: Impact) => void; clientId: string; agencyId: string; live: boolean;
}) {
  const { push } = useToast();
  const spec = nicheSpec(niche);
  const [form, setForm] = useState<Record<string, string>>({});
  const [qual, setQual] = useState("");
  const [obj, setObj] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const f: Record<string, string> = {};
    for (const m of spec.monthlyMetrics) { const v = prefill[m.field] ?? 0; f[m.field] = v ? String(v) : ""; }
    setForm(f);
    setQual(prefill.qualitative_feedback ?? "");
    setObj(prefill.objections_heard ?? "");
  }, [open, niche]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    const row: Record<string, unknown> = { agency_id: agencyId, client_id: clientId, period_month: firstOfMonthISO(), source: "client" };
    for (const m of spec.monthlyMetrics) row[m.field] = form[m.field] === "" || form[m.field] == null ? 0 : Number(form[m.field]);
    row.qualitative_feedback = qual.trim() || null;
    row.objections_heard = obj.trim() || null;

    if (!live || !supabase) { push({ tone: "info", title: "Mod demo", description: "Raportul se salvează doar în portalul live." }); setSaving(false); return; }
    const { error } = await supabase.from("business_impact_entries").upsert(row, { onConflict: "client_id,period_month,source" }).select();
    setSaving(false);
    if (error) { push({ tone: "danger", title: "Nu am putut salva", description: error.message }); return; }
    push({ tone: "success", title: "Trimis către agenția ta 🎉", description: "Mulțumim pentru actualizare!" });
    const merged: Impact = { ...prefill };
    for (const m of spec.monthlyMetrics) merged[m.field] = Number(form[m.field] || 0);
    merged.qualitative_feedback = qual.trim();
    merged.objections_heard = obj.trim();
    onSaved(merged);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Cum a mers ${monthLabel()}?`} subtitle="Cifrele tale reale — chiar și o estimare aproximativă ne ajută" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Trimite către agenție</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {spec.monthlyMetrics.map((m) => (
            <div key={m.field}>
              <p className="mb-1 text-xs font-700 text-muted-foreground">{m.label}{m.field === "revenue_estimate" ? " (€)" : ""}</p>
              <Input type="number" min={0} inputMode="numeric" value={form[m.field] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [m.field]: e.target.value }))} placeholder="0" />
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-700 text-muted-foreground">Ce au spus clienții? Ai avut reușite luna aceasta?</p>
          <textarea value={qual} onChange={(e) => setQual(e.target.value)} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. Mulți au menționat reel-ul despre… doi au rezervat pe loc." />
        </div>
        <div>
          <p className="mb-1 text-xs font-700 text-muted-foreground">Au existat obiecții sau motive pentru care oamenii nu au cumpărat?</p>
          <Input value={obj} onChange={(e) => setObj(e.target.value)} placeholder="ex. preț, locație, timpi de așteptare…" />
        </div>
      </div>
    </Modal>
  );
}
