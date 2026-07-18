import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Panel, SectionCard, Badge, Button, Segmented, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { NicheDashboard } from "@/components/niches";
import NicheOverview from "@/components/niches/NicheOverview";
import { clients as sampleClients, nicheLabels, billingTypeLabels, type Client, type Niche, type BillingType } from "@/data/sample";
import { formatCurrency } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { useClients, type ClientPatch } from "@/lib/clients";
import { useClips, clipStateLabel } from "@/lib/clips";
import { CalendarView } from "@/pages/ContentCalendar";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { nicheSpec } from "@/lib/niches";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Minus,
  Pencil,
  Phone,
  Plus,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { downloadReportImage, buildReportText } from "@/lib/reportImage";
import { useClientCounters, BARTER_COUNTERS, BARTER_DEADLINE } from "@/lib/clientcounters";
import { ClientAccessModal } from "@/components/ClientAccessModal";
import { BaselineCard, WeeklyCard, MonthlyInsights } from "@/components/results/ClientMetrics";

const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
type BrandProfile = { brandVoice: string; audience: string; goals: string[]; brandProfile: Record<string, unknown>; onboardedAt: string | null };

const tabs = ["Prezentare", "Conținut", "Calendar", "Rezultate", "Fișiere"] as const;

export default function ClientDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const cl = useClients();
  const clipsCtx = useClips();
  const ws = useWorkspace();
  const { push } = useToast();
  // Reopen each client on the tab you were working in (e.g. Rezultate during report week).
  const [tab, setTab] = useState<(typeof tabs)[number]>(() => {
    const saved = sessionStorage.getItem(`dreamar-client-tab-${id}`);
    return (tabs as readonly string[]).includes(saved ?? "") ? (saved as (typeof tabs)[number]) : "Prezentare";
  });
  useEffect(() => { try { sessionStorage.setItem(`dreamar-client-tab-${id}`, tab); } catch { /* ignore */ } }, [id, tab]);
  // Deep link (?tab=Rezultate) from the weekly queues overrides the remembered tab.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && (tabs as readonly string[]).includes(t)) setTab(t as (typeof tabs)[number]);
  }, [searchParams]);
  const [newObj, setNewObj] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  // Rezultate tab: selected month (YYYY-MM) + its manual figures.
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [results, setResults] = useState({ reach: "", dmLeads: "" });
  const [savingResults, setSavingResults] = useState(false);
  const agencyId = ws.currentAgency.id;

  const liveClient = cl.live ? cl.getClient(id) : undefined;

  // Live: load the onboarding/brand profile (Prezentare tab).
  useEffect(() => {
    if (!cl.live || !supabase || !id || id.startsWith("demo")) { setBrand(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase!.from("clients").select("brand_voice, target_audience, goals, brand_profile, onboarding_completed_at").eq("id", id).maybeSingle();
      if (!active || !data) return;
      setBrand({ brandVoice: data.brand_voice ?? "", audience: data.target_audience ?? "", goals: data.goals ?? [], brandProfile: data.brand_profile ?? {}, onboardedAt: data.onboarding_completed_at ?? null });
    })();
    return () => { active = false; };
  }, [cl.live, id]);

  // Load the selected month's manual results (live table / demo localStorage).
  useEffect(() => {
    const period = `${monthKey}-01`;
    if (cl.live && supabase && id && !id.startsWith("demo")) {
      let active = true;
      (async () => {
        const { data } = await supabase!.from("monthly_results").select("reach, dm_leads").eq("client_id", id).eq("period_month", period).maybeSingle();
        if (!active) return;
        setResults({ reach: data?.reach ? String(data.reach) : "", dmLeads: data?.dm_leads ? String(data.dm_leads) : "" });
      })();
      return () => { active = false; };
    }
    try { const raw = JSON.parse(localStorage.getItem(`dreamar-results-${id}-${monthKey}`) || "null"); setResults({ reach: raw?.reach ?? "", dmLeads: raw?.dmLeads ?? "" }); } catch { setResults({ reach: "", dmLeads: "" }); }
  }, [cl.live, id, monthKey]);

  // Live mode: the route id is a real UUID; wait for the load, and show a
  // proper not-found state instead of silently falling back to a sample client.
  if (cl.live && !liveClient) {
    return (
      <>
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm font-600 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Toți clienții
        </Link>
        <Panel className="grid place-items-center gap-3 py-20 text-center">
          {cl.loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <>
              <p className="font-display text-lg font-700">Clientul nu a fost găsit</p>
              <p className="text-sm text-muted-foreground">Este posibil să fi fost eliminat sau să aparțină altui spațiu de lucru.</p>
              <Link to="/clients"><Button variant="primary" className="mt-1">Înapoi la clienți</Button></Link>
            </>
          )}
        </Panel>
      </>
    );
  }

  const client = cl.live ? liveClient! : (sampleClients.find((c) => c.id === id) ?? sampleClients[0]);
  const objectives = cl.live ? cl.objectivesFor(client.id) : ws.objectivesFor(client.id);
  const addObjective = cl.live ? cl.addObjective : ws.addObjective;
  const removeObjective = cl.live ? cl.removeObjective : ws.removeObjective;
  const clientFeedback = cl.live ? cl.feedbackFor(client.id) : ws.feedbackFor(client.id);
  const det = cl.live ? cl.detailsFor(client.id) : undefined;
  const email = cl.live ? det?.email : `contact@${client.id}.ro`;
  const clientClips = clipsCtx.clips.filter((c) => c.clientId === client.id);

  // Rezultate figures for the selected month. Posted clips counted from the pipeline.
  const billing = client.billingType ?? "retainer";
  const isBarter = billing === "barter";     // Super Pasta: extra deliverable counters
  const isYanis = billing === "comision";    // Yanis / Târg Auto: no Rezultate tab (decontul e rezultatul)
  const visibleTabs = isYanis ? tabs.filter((t): boolean => t !== "Rezultate") : tabs;
  // A remembered tab (sessionStorage / ?tab=) may name a tab this client doesn't
  // have (e.g. a Yanis client remembering "Rezultate"), fall back so the body
  // never renders blank.
  const activeTab = visibleTabs.includes(tab) ? tab : "Prezentare";
  const publishedSelected = clientClips.filter((c) => c.state === "posted" && c.scheduledDate && c.scheduledDate.slice(0, 7) === monthKey).length;
  const monthLabel = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });

  const reportData = {
    clientName: client.name, monthLabel, published: publishedSelected,
    reach: Number(results.reach) || 0, dmLeads: Number(results.dmLeads) || 0, week: "", next: "",
  };

  async function saveResults() {
    if (savingResults) return;
    setSavingResults(true);
    const reach = results.reach === "" ? 0 : Number(results.reach);
    const dmLeads = results.dmLeads === "" ? 0 : Number(results.dmLeads);
    if (cl.live && supabase && !id.startsWith("demo")) {
      const { error } = await supabase.from("monthly_results").upsert({ agency_id: agencyId, client_id: id, period_month: `${monthKey}-01`, reach, dm_leads: dmLeads }, { onConflict: "client_id,period_month" });
      setSavingResults(false);
      if (error) { push({ tone: "danger", title: "Nu am putut salva", description: error.message }); return; }
    } else {
      try { localStorage.setItem(`dreamar-results-${id}-${monthKey}`, JSON.stringify({ reach: results.reach, dmLeads: results.dmLeads })); } catch { /* private */ }
      setSavingResults(false);
    }
    push({ tone: "success", title: "Rezultate salvate", description: monthLabel });
  }

  return (
    <>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm font-600 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Toți clienții
      </Link>

      {/* Client header */}
      <Panel className="overflow-hidden">
        <div className="gradient-hero h-20 w-full" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <span className="-mt-12 grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-card bg-gradient-to-br from-indigo-500 to-indigo-600 font-display text-2xl font-800 text-white shadow-card">
              {client.name.slice(0, 2)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-800">{client.name}</h1>
                <Badge tone="primary">{nicheLabels[client.niche]}</Badge>
                <Badge tone={client.status === "active" ? "success" : "warning"}>{client.status === "active" ? "Activ" : "În pauză"}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {client.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{client.city}</span>}
                {(client.phone || client.contact) && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone || client.contact}</span>}
                {email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
                {(client.billingType ?? "retainer") === "retainer"
                  ? client.retainer > 0 && <span>· {formatCurrency(client.retainer)}/lună</span>
                  : <span>· {billingTypeLabels[client.billingType ?? "retainer"]}</span>}
                {client.deliverables ? <span>· {client.deliverables} livrabile/lună</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {cl.live && !id.startsWith("demo") && (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invită clientul</Button>
            )}
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editează</Button>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <Segmented value={activeTab} onChange={setTab} options={visibleTabs.map((t) => ({ label: t, value: t }))} />
        </div>
      </Panel>

      {/* Overview tab - full client summary; other tabs swap to just their own content */}
      {activeTab === "Prezentare" && (
      <div className="grid grid-cols-1 gap-4">
        <SectionCard title="Obiectivele lunii acesteia" icon={Target} subtitle="Salvate per client - persistă între reîncărcări">
          <ul className="grid gap-2 sm:grid-cols-2">
            {objectives.map((o, i) => (
              <li key={`${o}-${i}`} className="group flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{o}</span>
                <button onClick={() => removeObjective(client.id, i)} className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {objectives.length === 0 && <li className="col-span-2 rounded-lg border border-dashed border-border px-3 py-3 text-center text-sm text-muted-foreground">Încă niciun obiectiv - adaugă unul mai jos.</li>}
          </ul>
          {objectives.length === 0 && nicheSpec(client.niche).objectivePresets.length > 0 && (
            <button
              onClick={() => nicheSpec(client.niche).objectivePresets.slice(0, 3).forEach((o) => addObjective(client.id, o))}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-700 text-primary transition hover:bg-primary/20"
            >
              <Wand2 className="h-3.5 w-3.5" /> Sugerează obiective pentru {nicheLabels[client.niche]}
            </button>
          )}
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); if (newObj.trim()) { addObjective(client.id, newObj.trim()); setNewObj(""); } }}
          >
            <Input value={newObj} onChange={(e) => setNewObj(e.target.value)} placeholder="Adaugă un obiectiv pentru luna aceasta…" />
            <Button type="submit" variant="primary" disabled={!newObj.trim()}><Plus className="h-4 w-4" /> Adaugă</Button>
          </form>
          {(() => {
            const presets = nicheSpec(client.niche).objectivePresets.filter((o) => !objectives.includes(o));
            if (!presets.length) return null;
            return (
              <div className="mt-3">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-700 text-muted-foreground"><Wand2 className="h-3.5 w-3.5" /> Sugerate pentru {nicheLabels[client.niche]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.slice(0, 6).map((o) => (
                    <button key={o} onClick={() => addObjective(client.id, o)} className="rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-xs font-600 text-primary transition hover:bg-primary/10">+ {o}</button>
                  ))}
                </div>
              </div>
            );
          })()}
        </SectionCard>
      </div>
      )}

      {/* Latest client feedback (from the client portal) */}
      {activeTab === "Prezentare" && clientFeedback && (
        <SectionCard title="Cel mai recent feedback de la client" subtitle="Preluat din portalul clientului" icon={Mail} action={<Badge tone="info" dot>Nou</Badge>}>
          <p className="rounded-xl border border-info/30 bg-info/[0.06] p-4 text-sm leading-relaxed text-foreground">"{clientFeedback}"</p>
        </SectionCard>
      )}

      {/* Brand profile - auto-filled by the client's portal onboarding */}
      {activeTab === "Prezentare" && cl.live && (
        <SectionCard
          title="Profil de brand"
          icon={Megaphone}
          subtitle="Vocea brandului, publicul și ce vinde clientul - pentru echipă"
        >
          {brand && (brand.brandVoice || brand.audience || brand.goals.length || Object.keys(brand.brandProfile).length) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {brand.brandVoice && <ProfileField label="Vocea brandului" icon={Megaphone} value={brand.brandVoice} />}
              {brand.audience && <ProfileField label="Public țintă" icon={Users} value={brand.audience} full />}
              {brand.goals.length > 0 && <ProfileField label="Obiective de afacere" icon={Target} value={brand.goals.join(" · ")} full />}
              {profileEntries(client.niche, brand.brandProfile).map(([label, val]) => <ProfileField key={label} label={label} value={val} full={label.length + val.length > 60} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-600">Încă niciun profil de brand</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Notează vocea brandului, publicul și ce vinde clientul din Editează, ca să le ai la îndemână.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* Tab content */}
      {activeTab === "Prezentare" && (cl.live ? <NicheOverview clientId={client.id} niche={client.niche} /> : <NicheDashboard client={client} />)}

      {activeTab === "Conținut" && (
        <SectionCard title="Clipuri" subtitle={`${clientClips.length} ${clientClips.length === 1 ? "clip" : "clipuri"} pentru ${client.name}`} action={<Link to="/pipeline" className="text-xs font-700 text-primary">Deschide Pipeline</Link>}>
          {clientClips.length ? (
            <Table>
              <THead><TH>Titlu</TH><TH>Platformă</TH><TH>Dată</TH><TH>Stare</TH></THead>
              <tbody>
                {clientClips.slice().sort((a, b) => (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999")).map((c) => (
                  <TR key={c.id}>
                    <TD className="max-w-[300px]"><p className="truncate font-600">{c.title}</p></TD>
                    <TD>{c.platform ? <Badge tone="neutral">{c.platform}</Badge> : <span className="text-muted-foreground">fără date</span>}</TD>
                    <TD className="text-muted-foreground">{c.scheduledDate ?? "fără date"}</TD>
                    <TD className="text-muted-foreground">{clipStateLabel(c.state)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Încă niciun clip. <Link to="/pipeline" className="font-700 text-primary">Adaugă în Pipeline</Link>.</p>
          )}
        </SectionCard>
      )}

      {activeTab === "Calendar" && (
        <SectionCard title="Calendar" subtitle={`Filmările și postările lui ${client.name}`}>
          <CalendarView lockedClientId={client.id} />
        </SectionCard>
      )}

      {activeTab === "Rezultate" && !isYanis && (
        <div className="space-y-4">
          <BaselineCard clientId={client.id} niche={client.niche} />
          <WeeklyCard clientId={client.id} />
          <MonthlyInsights clientId={client.id} clientName={client.name} niche={client.niche} monthKey={monthKey} />
          <SectionCard title="Rezultate" subtitle="Rezultatele lunii, plus raportul pentru client" icon={FileText}
            action={<input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} aria-label="Alege luna" className="h-9 rounded-lg border border-input bg-card px-2 text-sm ring-focus" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ReportStat label="Postări publicate" value={String(publishedSelected)} icon={FileText} />
                <ReportField label="Reach total"><Input type="number" inputMode="numeric" min={0} value={results.reach} onChange={(e) => setResults((r) => ({ ...r, reach: e.target.value }))} placeholder="ex. 42000" /></ReportField>
                <ReportField label="Lead-uri DM și WhatsApp"><Input type="number" inputMode="numeric" min={0} value={results.dmLeads} onChange={(e) => setResults((r) => ({ ...r, dmLeads: e.target.value }))} placeholder="ex. 18" /></ReportField>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" disabled={savingResults} onClick={saveResults}>{savingResults && <Loader2 className="h-4 w-4 animate-spin" />} Salvează</Button>
                <Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(buildReportText(reportData)); push({ tone: "success", title: "Text copiat", description: "Gata de trimis pe WhatsApp." }); }}><Copy className="h-4 w-4" /> Copiază text</Button>
                <Button variant="outline" onClick={() => { void downloadReportImage(reportData); push({ tone: "success", title: "Imagine generată", description: "Raportul s-a descărcat." }); }}><Download className="h-4 w-4" /> Descarcă imagine</Button>
              </div>
            </div>
          </SectionCard>
          {isBarter && <BarterCounters clientId={client.id} />}
        </div>
      )}

      {activeTab === "Fișiere" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { name: `${client.name} Ghid de brand.pdf`, size: "4.2 MB" },
            { name: "Brief campanie iunie.pdf", size: "1.1 MB" },
            { name: "Contract de retainer.pdf", size: "320 KB" },
          ].map((f) => (
            <Panel key={f.name} className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-danger/10 text-danger"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-600">{f.name}</p><p className="text-xs text-muted-foreground">{f.size}</p></div>
            </Panel>
          ))}
          <Panel onClick={() => push({ tone: "info", title: "Încarcă un document", description: "Folosește pagina Documente pentru a încărca fișiere" })} className="flex cursor-pointer items-center justify-center gap-2 border-dashed p-4 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
            <Upload className="h-4 w-4" /> Încarcă document
          </Panel>
        </div>
      )}

      <EditClientModal open={editOpen} onClose={() => setEditOpen(false)} client={client} website={det?.website ?? ""}
        onSave={async (patch) => {
          const res = await cl.updateClient(client.id, patch);
          if (res.error) push({ tone: "danger", title: "Salvarea nu a reușit", description: res.error });
          else push({ tone: "success", title: "Client actualizat", description: patch.name ?? client.name });
          return res;
        }}
        onArchive={async () => {
          // Leave the page first - archiving removes the client from state and
          // this detail page would flash "client negăsit" before navigating.
          navigate("/clients");
          const res = await cl.archiveClient(client.id);
          if (res.error) { push({ tone: "danger", title: "Arhivarea nu a reușit", description: res.error }); return; }
          push({ tone: "warning", title: "Client arhivat", description: client.name });
        }} />

      {cl.live && !id.startsWith("demo") && (
        <ClientAccessModal open={inviteOpen} onClose={() => setInviteOpen(false)}
          clientId={client.id} clientName={client.name} defaultEmail={email ?? ""} />
      )}
    </>
  );
}

function ReportStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 font-display text-2xl font-800">{value}</p>
    </div>
  );
}
function ReportField({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}

// Barter clients (Super Pasta) track deliverables instead of a money report.
function BarterCounters({ clientId }: { clientId: string }) {
  const { values, bump } = useClientCounters(clientId);
  return (
    <SectionCard title="Barter - livrabile" subtitle="Progresul înțelegerii, nu retainer" icon={FileText}
      action={<Badge tone="warning" dot>Termen: {BARTER_DEADLINE}</Badge>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {BARTER_COUNTERS.map((c) => {
          const n = values[c.key] ?? 0;
          return (
            <div key={c.key} className="rounded-xl border border-border p-4 text-center">
              <p className="text-xs font-600 text-muted-foreground">{c.label}</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <button onClick={() => bump(c.key, c.label, -1)} disabled={n === 0} aria-label="Scade" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                <span className="min-w-[2ch] font-display text-3xl font-800">{n}</span>
                <button onClick={() => bump(c.key, c.label, 1)} aria-label="Crește" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function EditClientModal({ open, onClose, client, website, onSave, onArchive }: {
  open: boolean; onClose: () => void; client: Client; website: string;
  onSave: (patch: ClientPatch) => Promise<{ error?: string }>; onArchive: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [niche, setNiche] = useState<Niche>("custom");
  const [city, setCity] = useState("");
  const [web, setWeb] = useState("");
  const [phone, setPhone] = useState("");
  const [retainer, setRetainer] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("retainer");
  const [deliverables, setDeliverables] = useState("");
  const [invoiced, setInvoiced] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Client["status"]>("active");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(client.name); setNiche(client.niche); setCity(client.city); setWeb(website);
    setPhone(client.phone || client.contact || "");
    setRetainer(client.retainer ? String(client.retainer) : "");
    setBillingType(client.billingType ?? "retainer");
    setDeliverables(client.deliverables ? String(client.deliverables) : "");
    setInvoiced(client.invoiced ?? false);
    setNotes(client.notes ?? "");
    setStatus(client.status); setPlatforms(client.platforms);
  }, [open, client, website]);

  async function save() {
    if (!name.trim() || busy) return;
    const retNum = retainer ? Number(retainer) : null;
    if (billingType === "retainer" && retNum !== null && (!Number.isFinite(retNum) || retNum < 0)) {
      return; // ignore an invalid retainer rather than saving garbage
    }
    const delNum = deliverables ? Number(deliverables) : null;
    setBusy(true);
    const res = await onSave({
      name: name.trim(), niche, city: city.trim(), website: web.trim(),
      phone: phone.trim(), contact: phone.trim(),
      retainer: billingType === "retainer" ? retNum : null,
      billingType, deliverables: delNum && Number.isFinite(delNum) ? delNum : null,
      invoiced, notes: notes.trim(), status, platforms,
    });
    setBusy(false);
    if (!res.error) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Editează clientul" subtitle={client.name} size="md"
      footer={
        <>
          <Button variant="ghost" className="text-danger" disabled={archiving} onClick={async () => { setArchiving(true); await onArchive(); }}>{archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Arhivează</Button>
          <Button variant="primary" className="ml-auto" disabled={busy || !name.trim()} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvează modificările</Button>
        </>
      }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nume client"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Nișă"><Select value={niche} onChange={(e) => setNiche(e.target.value as Niche)} className="w-full">{(Object.keys(nicheLabels) as Niche[]).map((k) => <option key={k} value={k}>{nicheLabels[k]}</option>)}</Select></Field>
          <Field label="Oraș"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          <Field label="Telefon"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Tip colaborare"><Select value={billingType} onChange={(e) => setBillingType(e.target.value as BillingType)} className="w-full">{(Object.keys(billingTypeLabels) as BillingType[]).map((k) => <option key={k} value={k}>{billingTypeLabels[k]}</option>)}</Select></Field>
          {billingType === "retainer" && <Field label="Retainer lunar (lei)"><Input type="number" value={retainer} onChange={(e) => setRetainer(e.target.value)} /></Field>}
          <Field label="Livrabile pe lună"><Input type="number" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} /></Field>
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as Client["status"])} className="w-full"><option value="active">Activ</option><option value="paused">În pauză</option></Select></Field>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-card p-3">
          <input type="checkbox" checked={invoiced} onChange={(e) => setInvoiced(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span className="text-sm">
            <span className="font-600">Cu factură</span>
            <span className="block text-xs text-muted-foreground">Apare lunar în blocul „Facturare" din pagina Bani.</span>
          </span>
        </label>
        <Field label="Notițe"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="Detalii interne despre client…" /></Field>
        <div>
          <p className="mb-1.5 text-xs font-700 text-muted-foreground">Platforme</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return <button key={p} type="button" onClick={() => setPlatforms((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))} className={`rounded-full border px-3 py-1.5 text-sm font-600 transition ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{p}</button>;
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}

function ProfileField({ label, value, icon: Icon, full }: { label: string; value: string; icon?: typeof Megaphone; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="mb-1 flex items-center gap-1 text-xs font-700 text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</p>
      <p className="text-sm leading-snug">{value}</p>
    </div>
  );
}

function profileEntries(niche: Niche, bp: Record<string, unknown>): [string, string][] {
  const labels: Record<string, string> = { primary_goal: "Obiectiv principal", usps: "Ce îi face diferiți", current_offers: "Oferte curente", avoid: "De evitat" };
  nicheSpec(niche).extraQuestions.forEach((q) => { labels[q.id] = q.label; });
  return Object.entries(labels)
    .map(([k, label]) => [label, bp[k]] as [string, unknown])
    .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim())))
    .map(([label, v]) => [label, Array.isArray(v) ? (v as string[]).join(", ") : String(v)] as [string, string]);
}
