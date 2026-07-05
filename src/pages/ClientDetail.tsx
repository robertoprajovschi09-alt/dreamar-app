import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Panel, SectionCard, Badge, Button, Segmented, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { NicheDashboard } from "@/components/niches";
import NicheOverview from "@/components/niches/NicheOverview";
import { clients as sampleClients, nicheLabels, billingTypeLabels, videos, type Client, type Niche, type BillingType } from "@/data/sample";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { useClients, type ClientPatch } from "@/lib/clients";
import { useClips, clipStateLabel } from "@/lib/clips";
import { useLibrary } from "@/lib/library";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { nicheSpec, type MetricField } from "@/lib/niches";
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
  TrendingUp,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { downloadReportImage, buildReportText } from "@/lib/reportImage";
import { useClientCounters, BARTER_COUNTERS, BARTER_DEADLINE } from "@/lib/clientcounters";

const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
type BrandProfile = { brandVoice: string; audience: string; goals: string[]; brandProfile: Record<string, unknown>; onboardedAt: string | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImpactRow = { source: string } & Record<string, any>;

const tabs = ["Prezentare", "Conținut", "Rezultate", "Raport", "Fișiere"] as const;
const recTone = { repeat: "success", improve: "warning", stop: "danger" } as const;

export default function ClientDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const cl = useClients();
  const clipsCtx = useClips();
  const lib = useLibrary();
  const ws = useWorkspace();
  const { push } = useToast();
  // Reopen each client on the tab you were working in (e.g. Raport during report week).
  const [tab, setTab] = useState<(typeof tabs)[number]>(() => {
    const saved = sessionStorage.getItem(`dreamar-client-tab-${id}`);
    return (tabs as readonly string[]).includes(saved ?? "") ? (saved as (typeof tabs)[number]) : "Prezentare";
  });
  useEffect(() => { try { sessionStorage.setItem(`dreamar-client-tab-${id}`, tab); } catch { /* ignore */ } }, [id, tab]);
  // Deep link (?tab=Raport) from the weekly queues overrides the remembered tab.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && (tabs as readonly string[]).includes(t)) setTab(t as (typeof tabs)[number]);
  }, [searchParams]);
  const [newObj, setNewObj] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [impactRows, setImpactRows] = useState<ImpactRow[]>([]);
  const [homeFields, setHomeFields] = useState({ reach: "", dmLeads: "", week: "", next: "" });
  const [savingHome, setSavingHome] = useState(false);

  const liveClient = cl.live ? cl.getClient(id) : undefined;

  // Live: load the onboarding/brand profile + this month's impact entries (client + agency).
  useEffect(() => {
    if (!cl.live || !supabase || !id || id.startsWith("demo")) { setBrand(null); setImpactRows([]); return; }
    let active = true;
    (async () => {
      const month = firstOfMonthISO();
      const [p, im] = await Promise.all([
        supabase!.from("clients").select("brand_voice, target_audience, goals, brand_profile, onboarding_completed_at, report_reach, report_dm_leads, week_summary, next_steps").eq("id", id).maybeSingle(),
        supabase!.from("business_impact_entries").select("source, calls_received, relevant_dms, bookings, appointments, orders, sales, viewings, contracts, revenue_estimate, qualitative_feedback, objections_heard").eq("client_id", id).eq("period_month", month),
      ]);
      if (!active) return;
      if (p.data) {
        setBrand({ brandVoice: p.data.brand_voice ?? "", audience: p.data.target_audience ?? "", goals: p.data.goals ?? [], brandProfile: p.data.brand_profile ?? {}, onboardedAt: p.data.onboarding_completed_at ?? null });
        setHomeFields({ reach: p.data.report_reach != null ? String(p.data.report_reach) : "", dmLeads: p.data.report_dm_leads != null ? String(p.data.report_dm_leads) : "", week: p.data.week_summary ?? "", next: p.data.next_steps ?? "" });
      }
      setImpactRows((im.data ?? []) as ImpactRow[]);
    })();
    return () => { active = false; };
  }, [cl.live, id]);

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
              <p className="text-sm text-muted-foreground">Este posibil să fi fost eliminat sau să aparțină altui workspace.</p>
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
  const clientVideos = (cl.live ? lib.videos : videos).filter((v) => v.client === client.name);
  const clientClips = clipsCtx.clips.filter((c) => c.clientId === client.id);

  // Report figures (this month). Posted clips counted straight from the pipeline.
  const monthKey = new Date().toISOString().slice(0, 7);
  const publishedThisMonth = clientClips.filter((c) => c.state === "posted" && c.scheduledDate && c.scheduledDate.slice(0, 7) === monthKey).length;
  const monthLabel = new Date().toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
  const isBarter = (client.billingType ?? "retainer") === "barter";

  const reportData = {
    clientName: client.name, monthLabel, published: publishedThisMonth,
    reach: Number(homeFields.reach) || 0, dmLeads: Number(homeFields.dmLeads) || 0,
    week: homeFields.week, next: homeFields.next,
  };

  async function saveHome() {
    if (!supabase || !cl.live || savingHome) return;
    setSavingHome(true);
    const { error } = await supabase.from("clients").update({
      report_reach: homeFields.reach === "" ? null : Number(homeFields.reach),
      report_dm_leads: homeFields.dmLeads === "" ? null : Number(homeFields.dmLeads),
      week_summary: homeFields.week.trim() || null,
      next_steps: homeFields.next.trim() || null,
    }).eq("id", id);
    setSavingHome(false);
    if (error) { push({ tone: "danger", title: "Nu am putut salva", description: error.message }); return; }
    push({ tone: "success", title: "Raport salvat" });
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
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editează</Button>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <Segmented value={tab} onChange={setTab} options={tabs.map((t) => ({ label: t, value: t }))} />
        </div>
      </Panel>

      {/* Overview tab - full client summary; other tabs swap to just their own content */}
      {tab === "Prezentare" && (
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
      {tab === "Prezentare" && clientFeedback && (
        <SectionCard title="Cel mai recent feedback de la client" subtitle="Preluat din portalul clientului" icon={Mail} action={<Badge tone="info" dot>Nou</Badge>}>
          <p className="rounded-xl border border-info/30 bg-info/[0.06] p-4 text-sm leading-relaxed text-foreground">"{clientFeedback}"</p>
        </SectionCard>
      )}

      {/* Brand profile - auto-filled by the client's portal onboarding */}
      {tab === "Prezentare" && cl.live && (
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
      {tab === "Prezentare" && (cl.live ? <NicheOverview clientId={client.id} niche={client.niche} /> : <NicheDashboard client={client} />)}

      {tab === "Conținut" && (
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

      {tab === "Rezultate" && (
        <div className="space-y-4">
          <BusinessImpactTab live={cl.live} niche={client.niche} rows={impactRows} />
          <SectionCard title="Performanță conținut" subtitle={`${clientVideos.length} ${clientVideos.length === 1 ? "videoclip" : "videoclipuri"}`} icon={TrendingUp}>
            {clientVideos.length ? (
              <Table>
                <THead><TH>Hook</TH><TH>Platformă</TH><TH>Dată</TH><TH className="text-right">Vizualizări</TH></THead>
                <tbody>
                  {clientVideos.map((v) => (
                    <TR key={v.id}>
                      <TD className="max-w-[280px]"><p className="truncate font-600">{v.hook}</p><p className="text-xs text-muted-foreground">{v.format}</p></TD>
                      <TD><Badge tone="neutral">{v.platform}</Badge></TD>
                      <TD className="text-muted-foreground">{v.date}</TD>
                      <TD className="text-right font-600">{formatNumber(v.views)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Încă niciun videoclip înregistrat.</p>
            )}
          </SectionCard>
        </div>
      )}

      {tab === "Raport" && (isBarter ? (
        <BarterCounters clientId={client.id} />
      ) : (
        <div className="space-y-4">
          <SectionCard title={`Raport · ${monthLabel}`} subtitle="Rezumatul lunii - descarcă-l ca imagine sau copiază textul" icon={FileText}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ReportStat label="Postări publicate" value={String(publishedThisMonth)} icon={FileText} />
                <ReportField label="Reach total"><Input type="number" min={0} value={homeFields.reach} onChange={(e) => setHomeFields((f) => ({ ...f, reach: e.target.value }))} placeholder="ex. 42000" /></ReportField>
                <ReportField label="Lead-uri DM și WhatsApp"><Input type="number" min={0} value={homeFields.dmLeads} onChange={(e) => setHomeFields((f) => ({ ...f, dmLeads: e.target.value }))} placeholder="ex. 18" /></ReportField>
              </div>
              <ReportField label="Ce s-a întâmplat"><textarea value={homeFields.week} onChange={(e) => setHomeFields((f) => ({ ...f, week: e.target.value }))} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. Filmările despre albire au adus 9 programări noi." /></ReportField>
              <ReportField label="Ce urmează"><textarea value={homeFields.next} onChange={(e) => setHomeFields((f) => ({ ...f, next: e.target.value }))} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. Pregătim 4 postări noi și relansăm reclama." /></ReportField>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" disabled={savingHome || !cl.live} onClick={saveHome}>{savingHome && <Loader2 className="h-4 w-4 animate-spin" />} Salvează</Button>
                <Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(buildReportText(reportData)); push({ tone: "success", title: "Text copiat", description: "Gata de trimis pe WhatsApp." }); }}><Copy className="h-4 w-4" /> Copiază text</Button>
                <Button variant="outline" onClick={() => { void downloadReportImage(reportData); push({ tone: "success", title: "Imagine generată", description: "Raportul s-a descărcat." }); }}><Download className="h-4 w-4" /> Descarcă imagine</Button>
                {!cl.live && <p className="text-xs text-muted-foreground">Salvarea e disponibilă în contul live.</p>}
              </div>
            </div>
          </SectionCard>
        </div>
      ))}

      {tab === "Fișiere" && (
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

function BusinessImpactTab({ live, niche, rows }: { live: boolean; niche: Niche; rows: ImpactRow[] }) {
  const metrics = nicheSpec(niche).monthlyMetrics;
  const clientRow = rows.find((r) => r.source === "client");
  const agencyRow = rows.find((r) => r.source === "agency");
  const val = (f: MetricField) => Number((clientRow?.[f] ?? agencyRow?.[f]) ?? 0);
  const monthName = new Date().toLocaleDateString("ro-RO", { month: "long" });

  if (!live) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[{ l: "Apeluri primite", v: "42" }, { l: "Rezervări", v: "26" }, { l: "Impact pe venituri", v: "38.200 lei" }, { l: "DM-uri relevante", v: "138" }].map((m) => (
          <Panel key={m.l} className="p-5"><p className="text-xs text-muted-foreground">{m.l}</p><p className="mt-1 font-display text-2xl font-800">{m.v}</p></Panel>
        ))}
      </div>
    );
  }

  const any = clientRow || agencyRow;
  const status = clientRow
    ? `Clientul a raportat singur aceste cifre pentru ${monthName}.`
    : any
    ? `Cifre introduse de agenție pentru ${monthName}.`
    : `Încă niciun impact raportat pentru ${monthName} - îl poți adăuga tu în Impact în afacere.`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Panel key={m.field} className="p-5">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-1 font-display text-2xl font-800">{m.field === "revenue_estimate" ? formatCurrency(val(m.field)) : formatNumber(val(m.field))}</p>
          </Panel>
        ))}
      </div>
      {clientRow?.qualitative_feedback && (
        <SectionCard title="Ce a raportat clientul" icon={Mail} action={<Badge tone="info" dot>Client</Badge>}>
          <p className="rounded-xl border border-info/30 bg-info/[0.06] p-4 text-sm leading-relaxed">"{clientRow.qualitative_feedback}"</p>
          {clientRow.objections_heard && <p className="mt-2 text-sm text-muted-foreground"><span className="font-700">Obiecții întâlnite:</span> {clientRow.objections_heard}</p>}
        </SectionCard>
      )}
      <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{status}</p>
        <Link to="/impact"><Button variant="primary" size="sm">Deschide Impact în afacere</Button></Link>
      </Panel>
    </div>
  );
}
