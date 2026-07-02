import { useEffect, useMemo, useState } from "react";
import { PageHeader, Button, Panel, Badge, Select, Input } from "@/components/ui";
import { Modal, Drawer } from "@/components/overlay";
import { StatCard } from "@/components/StatCard";
import { SkeletonRows } from "@/components/Skeleton";
import { useToast } from "@/lib/toast";
import { useClients } from "@/lib/clients";
import {
  useCampaigns, CAMPAIGN_PLATFORMS, CAMPAIGN_OBJECTIVES,
  type Campaign, type CampaignStatus, type CampaignPatch,
} from "@/lib/campaigns";
import { Megaphone, Plus, Loader2, Trash2, Wallet, TrendingUp, Target, Users, BarChart3 } from "lucide-react";
import { cn, lastClientId, rememberClient } from "@/lib/utils";

const STATUS: Record<CampaignStatus, { label: string; badge: "neutral" | "success" | "warning" | "info"; bar: string }> = {
  planning: { label: "Planificată", badge: "neutral", bar: "bg-muted-foreground/45" },
  active: { label: "Activă", badge: "success", bar: "bg-primary" },
  paused: { label: "În pauză", badge: "warning", bar: "bg-[hsl(var(--warning))]" },
  completed: { label: "Încheiată", badge: "info", bar: "bg-success" },
};
const STATUS_ORDER: CampaignStatus[] = ["planning", "active", "paused", "completed"];

const toMs = (d: string) => new Date(d + "T00:00:00").getTime();
const eur = (n: number) => `€${Math.round(n).toLocaleString("ro-RO")}`;
const eurK = (n: number) => (n >= 1000 ? `€${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `€${Math.round(n)}`);
const roasOf = (c: Campaign) => (c.spend > 0 ? c.revenue / c.spend : 0);
const cplOf = (c: Campaign) => (c.leads > 0 ? c.spend / c.leads : 0);
const ctrOf = (c: Campaign) => (c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0);
const dfmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "—");
const rangeLabel = (c: Campaign) => `${dfmt(c.startDate)} – ${dfmt(c.endDate)}`;
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((toMs(b) - toMs(a)) / 86400000) + 1);

export default function Campaigns() {
  const { push } = useToast();
  const { campaigns, loading, live, createCampaign, updateCampaign, deleteCampaign } = useCampaigns();
  const { clients } = useClients();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = campaigns.find((c) => c.id === editId) ?? null;

  const totals = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active");
    const budget = active.reduce((s, c) => s + c.budget, 0);
    const spend = campaigns.reduce((s, c) => s + c.spend, 0);
    const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    return { activeCount: active.length, budget, spend, revenue, roas: spend > 0 ? revenue / spend : 0 };
  }, [campaigns]);

  if (loading) {
    return (
      <>
        <PageHeader title="Campanii plătite" subtitle="Urmărește campaniile de ads pe toată durata lor — buget, cheltuieli și rezultate." />
        <SkeletonRows rows={5} cols={4} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Campanii plătite" subtitle="Urmărește campaniile de ads pe toată durata lor — buget, cheltuieli și rezultate.">
        <Button variant="primary" onClick={() => setComposerOpen(true)} disabled={live && clients.length === 0}><Plus className="h-4 w-4" /> Campanie nouă</Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Campanii active" value={String(totals.activeCount)} sub={`din ${campaigns.length} în total`} icon={Megaphone} tone="primary" />
        <StatCard label="Buget activ" value={eurK(totals.budget)} sub="alocat campaniilor active" icon={Wallet} />
        <StatCard label="Cheltuit până acum" value={eurK(totals.spend)} sub="pe toate campaniile" icon={Target} tone="info" />
        <StatCard label="ROAS mediu" value={`${totals.roas.toFixed(1)}×`} sub={`${eurK(totals.revenue)} venit atribuit`} icon={TrendingUp} tone="success" />
      </div>

      {campaigns.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Megaphone className="h-7 w-7" /></span>
          <p className="font-display text-lg font-700">Încă nicio campanie</p>
          <p className="max-w-sm text-sm text-muted-foreground">{live && clients.length === 0 ? "Adaugă mai întâi un client, apoi planifică-i campaniile plătite aici." : "Adaugă o campanie plătită ca să-i urmărești bugetul, cheltuielile și rezultatele pe toată durata."}</p>
          {!(live && clients.length === 0) && <Button variant="primary" className="mt-1" onClick={() => setComposerOpen(true)}><Plus className="h-4 w-4" /> Campanie nouă</Button>}
        </Panel>
      ) : (
        <>
          <Timeline campaigns={campaigns} onOpen={(c) => setEditId(c.id)} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {campaigns.map((c) => <CampaignCard key={c.id} c={c} onClick={() => setEditId(c.id)} />)}
          </div>
        </>
      )}

      <CampaignComposer open={composerOpen} onClose={() => setComposerOpen(false)} clients={clients}
        onCreate={async (input) => {
          const res = await createCampaign(input);
          if (res.error) push({ tone: "danger", title: "Nu s-a putut crea campania", description: res.error });
          else push({ tone: "success", title: "Campanie creată", description: input.name });
          return res;
        }} />

      <CampaignDrawer campaign={editing} onClose={() => setEditId(null)}
        onSave={async (patch) => {
          if (!editing) return;
          const res = await updateCampaign(editing.id, patch);
          if (res.error) { push({ tone: "danger", title: "Nu s-a putut salva", description: res.error }); return; }
          push({ tone: "success", title: "Campanie actualizată" }); setEditId(null);
        }}
        onDelete={async () => {
          if (!editing) return;
          const res = await deleteCampaign(editing.id);
          if (res.error) { push({ tone: "danger", title: "Nu s-a putut șterge", description: res.error }); return; }
          push({ tone: "warning", title: "Campanie ștearsă", description: editing.name }); setEditId(null);
        }} />
    </>
  );
}

/* ── Timeline (Gantt) ─────────────────────────────────────────────────────── */
function Timeline({ campaigns, onOpen }: { campaigns: Campaign[]; onOpen: (c: Campaign) => void }) {
  const dated = campaigns.filter((c) => c.startDate && c.endDate).sort((a, b) => toMs(a.startDate!) - toMs(b.startDate!));
  const todayMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  if (dated.length === 0) {
    return (
      <Panel className="p-5">
        <h3 className="font-display font-700">Cronologie campanii</h3>
        <p className="mt-2 text-sm text-muted-foreground">Adaugă date de început și de sfârșit unei campanii ca să apară pe cronologie.</p>
      </Panel>
    );
  }

  const starts = dated.map((c) => toMs(c.startDate!));
  const ends = dated.map((c) => toMs(c.endDate!));
  let winStart = Math.min(...starts, todayMs);
  let winEnd = Math.max(...ends, todayMs);
  const pad = Math.max((winEnd - winStart) * 0.04, 86400000 * 3);
  winStart -= pad; winEnd += pad;
  const span = winEnd - winStart || 1;
  const leftPct = (ms: number) => ((ms - winStart) / span) * 100;

  const months: Date[] = [];
  const d = new Date(winStart); d.setDate(1); d.setHours(0, 0, 0, 0);
  while (d.getTime() <= winEnd) { months.push(new Date(d)); d.setMonth(d.getMonth() + 1); }

  return (
    <Panel className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display font-700">Cronologie campanii</h3>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2.5 w-2.5 rounded-sm", STATUS[s].bar)} />{STATUS[s].label}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* month axis */}
          <div className="relative mb-2 h-5 border-b border-border">
            {months.map((m, i) => (
              <span key={i} className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-700 uppercase tracking-wide text-muted-foreground" style={{ left: `${leftPct(m.getTime())}%` }}>
                {m.toLocaleDateString("ro-RO", { month: "short", year: m.getMonth() === 0 ? "2-digit" : undefined })}
              </span>
            ))}
          </div>
          {/* bars + gridlines */}
          <div className="relative">
            {months.map((m, i) => (
              <div key={i} className="absolute bottom-0 top-0 w-px bg-border/50" style={{ left: `${leftPct(m.getTime())}%` }} />
            ))}
            {todayMs >= winStart && todayMs <= winEnd && (
              <div className="absolute bottom-0 top-0 z-10 w-px bg-primary/70" style={{ left: `${leftPct(todayMs)}%` }}>
                <span className="absolute -top-0.5 left-1 rounded bg-primary px-1 py-0.5 text-[9px] font-700 text-primary-foreground">Azi</span>
              </div>
            )}
            <div className="relative space-y-1.5 py-1">
              {dated.map((c) => {
                const left = leftPct(toMs(c.startDate!));
                const width = Math.max(leftPct(toMs(c.endDate!)) - left, 2);
                return (
                  <div key={c.id} className="relative h-8">
                    <button
                      onClick={() => onOpen(c)}
                      title={`${c.name} · ${c.clientName} · ${rangeLabel(c)}`}
                      className={cn("absolute flex h-8 items-center overflow-hidden rounded-md px-2 text-left text-white shadow-soft transition hover:brightness-110", STATUS[c.status].bar)}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span className="truncate text-[11px] font-700">{c.name}</span>
                      <span className="ml-1.5 hidden truncate text-[10px] font-500 opacity-80 sm:inline">· {c.clientName}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ── Campaign card ────────────────────────────────────────────────────────── */
function CampaignCard({ c, onClick }: { c: Campaign; onClick: () => void }) {
  const pacing = c.budget > 0 ? Math.min((c.spend / c.budget) * 100, 100) : 0;
  const over = c.spend > c.budget && c.budget > 0;
  return (
    <Panel className="cursor-pointer p-4 transition hover:shadow-glow sm:p-5" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-800">{c.name}</p>
          <p className="truncate text-xs text-muted-foreground">{c.clientName}{c.platform ? ` · ${c.platform}` : ""}{c.objective ? ` · ${c.objective}` : ""}</p>
        </div>
        <Badge tone={STATUS[c.status].badge}>{STATUS[c.status].label}</Badge>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {rangeLabel(c)}{c.startDate && c.endDate ? ` · ${daysBetween(c.startDate, c.endDate)} zile` : ""}
      </p>

      {/* budget pacing */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-600">{eur(c.spend)} <span className="text-muted-foreground">/ {eur(c.budget)}</span></span>
          <span className={cn("font-700", over ? "text-danger" : "text-muted-foreground")}>{c.budget > 0 ? `${Math.round((c.spend / c.budget) * 100)}%` : "—"}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", over ? "bg-danger" : "bg-primary")} style={{ width: `${pacing}%` }} />
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
        <KpiCell icon={TrendingUp} label="ROAS" value={`${roasOf(c).toFixed(1)}×`} />
        <KpiCell icon={Users} label="Lead-uri" value={String(c.leads)} />
        <KpiCell icon={Wallet} label="CPL" value={c.leads > 0 ? eur(cplOf(c)) : "—"} />
        <KpiCell icon={BarChart3} label="CTR" value={c.impressions > 0 ? `${ctrOf(c).toFixed(1)}%` : "—"} />
      </div>
    </Panel>
  );
}
function KpiCell({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-sm font-800">{value}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
    </div>
  );
}

/* ── Composer ─────────────────────────────────────────────────────────────── */
function CampaignComposer({ open, onClose, clients, onCreate }: {
  open: boolean; onClose: () => void; clients: { id: string; name: string }[];
  onCreate: (input: { clientId: string; name: string; platform: string; objective: string; status: CampaignStatus; startDate: string | null; endDate: string | null; budget: number }) => Promise<{ error?: string }>;
}) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("Meta");
  const [objective, setObjective] = useState("Lead-uri");
  const [status, setStatus] = useState<CampaignStatus>("active");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const inMonth = new Date(); inMonth.setMonth(inMonth.getMonth() + 1);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setClientId(lastClientId(clients)); setName(""); setPlatform("Meta"); setObjective("Lead-uri");
    setStatus("active"); setStart(iso(today)); setEnd(iso(inMonth)); setBudget(""); setBusy(false);
  }, [open, clients]);

  async function submit() {
    if (!name.trim() || !clientId || busy) return;
    setBusy(true);
    const res = await onCreate({ clientId, name: name.trim(), platform, objective, status, startDate: start || null, endDate: end || null, budget: budget === "" ? 0 : Number(budget) });
    setBusy(false);
    if (!res.error) { rememberClient(clientId); onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Campanie nouă" subtitle="Planifică o campanie plătită pentru un client" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !name.trim() || !clientId} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Creează campania</Button></>}>
      <div className="space-y-4">
        <Field label="Nume campanie"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="ex. Lansare primăvară — Meta" /></Field>
        <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Platformă"><Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full">{CAMPAIGN_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Obiectiv"><Select value={objective} onChange={(e) => setObjective(e.target.value)} className="w-full">{CAMPAIGN_OBJECTIVES.map((o) => <option key={o}>{o}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Început"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Sfârșit"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Buget total (€)"><Input type="number" min={0} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" /></Field>
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)} className="w-full">{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</Select></Field>
        </div>
      </div>
    </Modal>
  );
}

/* ── Edit drawer (update results over time) ───────────────────────────────── */
function CampaignDrawer({ campaign, onClose, onSave, onDelete }: {
  campaign: Campaign | null; onClose: () => void;
  onSave: (patch: CampaignPatch) => void; onDelete: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!campaign) return;
    setF({
      name: campaign.name, platform: campaign.platform || "Meta", objective: campaign.objective || "Lead-uri", status: campaign.status,
      start: campaign.startDate ?? "", end: campaign.endDate ?? "",
      budget: String(campaign.budget), spend: String(campaign.spend), impressions: String(campaign.impressions),
      clicks: String(campaign.clicks), leads: String(campaign.leads), conversions: String(campaign.conversions),
      revenue: String(campaign.revenue), notes: campaign.notes ?? "",
    });
  }, [campaign]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const numOr = (s: string) => (s === "" ? 0 : Number(s));

  const liveSpend = numOr(f.spend), liveRevenue = numOr(f.revenue), liveLeads = numOr(f.leads), liveImp = numOr(f.impressions), liveClicks = numOr(f.clicks);
  const roas = liveSpend > 0 ? liveRevenue / liveSpend : 0;
  const cpl = liveLeads > 0 ? liveSpend / liveLeads : 0;
  const ctr = liveImp > 0 ? (liveClicks / liveImp) * 100 : 0;

  function save() {
    onSave({
      name: f.name, platform: f.platform, objective: f.objective, status: f.status as CampaignStatus,
      startDate: f.start || null, endDate: f.end || null,
      budget: numOr(f.budget), spend: numOr(f.spend), impressions: numOr(f.impressions),
      clicks: numOr(f.clicks), leads: numOr(f.leads), conversions: numOr(f.conversions),
      revenue: numOr(f.revenue), notes: f.notes,
    });
  }

  return (
    <Drawer open={!!campaign} onClose={onClose} title={campaign?.name}
      subtitle={campaign ? `${campaign.clientName}${campaign.platform ? ` · ${campaign.platform}` : ""}` : undefined}
      badge={campaign && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-700 text-white", STATUS[campaign.status].bar)}>{STATUS[campaign.status].label}</span>}
      footer={<>
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}><Trash2 className="h-4 w-4" /> Șterge</Button>
        <Button variant="primary" size="sm" className="ml-auto" onClick={save}>Salvează</Button>
      </>}>
      {campaign && (
        <div className="space-y-5" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}>
          {/* derived KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {[["ROAS", `${roas.toFixed(1)}×`], ["CPL", liveLeads > 0 ? eur(cpl) : "—"], ["CTR", liveImp > 0 ? `${ctr.toFixed(1)}%` : "—"]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-border p-2.5 text-center">
                <p className="font-display text-base font-800">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>

          <DField label="Nume"><Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></DField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DField label="Platformă"><Select value={f.platform ?? "Meta"} onChange={(e) => set("platform", e.target.value)} className="w-full">{CAMPAIGN_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select></DField>
            <DField label="Obiectiv"><Select value={f.objective ?? ""} onChange={(e) => set("objective", e.target.value)} className="w-full">{CAMPAIGN_OBJECTIVES.map((o) => <option key={o}>{o}</option>)}</Select></DField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DField label="Început"><Input type="date" value={f.start ?? ""} onChange={(e) => set("start", e.target.value)} /></DField>
            <DField label="Sfârșit"><Input type="date" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} /></DField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DField label="Buget (€)"><Input type="number" value={f.budget ?? ""} onChange={(e) => set("budget", e.target.value)} /></DField>
            <DField label="Status"><Select value={f.status ?? "active"} onChange={(e) => set("status", e.target.value)} className="w-full">{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</Select></DField>
          </div>

          <div>
            <p className="mb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Rezultate</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DField label="Cheltuit (€)"><Input type="number" value={f.spend ?? ""} onChange={(e) => set("spend", e.target.value)} /></DField>
              <DField label="Afișări"><Input type="number" value={f.impressions ?? ""} onChange={(e) => set("impressions", e.target.value)} /></DField>
              <DField label="Click-uri"><Input type="number" value={f.clicks ?? ""} onChange={(e) => set("clicks", e.target.value)} /></DField>
              <DField label="Lead-uri"><Input type="number" value={f.leads ?? ""} onChange={(e) => set("leads", e.target.value)} /></DField>
              <DField label="Conversii"><Input type="number" value={f.conversions ?? ""} onChange={(e) => set("conversions", e.target.value)} /></DField>
              <DField label="Venit (€)"><Input type="number" value={f.revenue ?? ""} onChange={(e) => set("revenue", e.target.value)} /></DField>
            </div>
          </div>

          <DField label="Notițe"><textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Observații, învățăminte, ce ai testat…" /></DField>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
