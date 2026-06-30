import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Panel, SectionCard, Badge, Button, Segmented, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { RadialScore } from "@/components/charts";
import { NicheDashboard } from "@/components/niches";
import NicheOverview from "@/components/niches/NicheOverview";
import { clients as sampleClients, nicheLabels, videos, type Client, type Niche } from "@/data/sample";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { useClients, type ClientPatch } from "@/lib/clients";
import { useContent } from "@/lib/content";
import { useCampaigns } from "@/lib/campaigns";
import { useLibrary } from "@/lib/library";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { nicheSpec, type MetricField } from "@/lib/niches";
import {
  ArrowLeft,
  Coins,
  Copy,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Wallet,
  Wand2,
  X,
} from "lucide-react";

const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
const POST_STATUS_LABEL: Record<string, string> = {
  idea: "Idee", script: "Scenariu", filming: "Filmare", editing: "Editare", approval: "Pentru aprobare",
  approved: "Aprobat", scheduled: "Programat", published: "Publicat", analyzed: "Analizat",
};
const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
type BrandProfile = { brandVoice: string; audience: string; goals: string[]; brandProfile: Record<string, unknown>; onboardedAt: string | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImpactRow = { source: string } & Record<string, any>;

const tabs = ["Prezentare", "Conținut", "Campanii", "Rezultate", "Raport", "Fișiere"] as const;
const recTone = { repeat: "success", improve: "warning", stop: "danger" } as const;

export default function ClientDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const cl = useClients();
  const content = useContent();
  const camp = useCampaigns();
  const lib = useLibrary();
  const ws = useWorkspace();
  const { push } = useToast();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Prezentare");
  const [newObj, setNewObj] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [impactRows, setImpactRows] = useState<ImpactRow[]>([]);
  const [homeFields, setHomeFields] = useState({ goal: "", week: "", next: "" });
  const [savingHome, setSavingHome] = useState(false);

  const liveClient = cl.live ? cl.getClient(id) : undefined;

  // Live: load the onboarding/brand profile + this month's impact entries (client + agency).
  useEffect(() => {
    if (!cl.live || !supabase || !id || id.startsWith("demo")) { setBrand(null); setImpactRows([]); return; }
    let active = true;
    (async () => {
      const month = firstOfMonthISO();
      const [p, im] = await Promise.all([
        supabase!.from("clients").select("brand_voice, target_audience, goals, brand_profile, onboarding_completed_at, monthly_lead_goal, week_summary, next_steps").eq("id", id).maybeSingle(),
        supabase!.from("business_impact_entries").select("source, calls_received, relevant_dms, bookings, appointments, orders, sales, viewings, contracts, revenue_estimate, qualitative_feedback, objections_heard").eq("client_id", id).eq("period_month", month),
      ]);
      if (!active) return;
      if (p.data) {
        setBrand({ brandVoice: p.data.brand_voice ?? "", audience: p.data.target_audience ?? "", goals: p.data.goals ?? [], brandProfile: p.data.brand_profile ?? {}, onboardedAt: p.data.onboarding_completed_at ?? null });
        setHomeFields({ goal: p.data.monthly_lead_goal != null ? String(p.data.monthly_lead_goal) : "", week: p.data.week_summary ?? "", next: p.data.next_steps ?? "" });
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
  const clientPosts = content.posts.filter((p) => p.clientId === client.id);
  const clientCampaigns = camp.campaigns.filter((c) => c.clientId === client.id);

  // Report figures (this month) — same numbers the client sees in their portal.
  const repPick = (f: string) => { const cr = impactRows.find((r) => r.source === "client"); const ar = impactRows.find((r) => r.source === "agency"); return Number((cr?.[f] ?? ar?.[f]) ?? 0); };
  const repLeads = repPick("calls_received") + repPick("relevant_dms") + repPick("bookings") + repPick("appointments") + repPick("viewings");
  const repRevenue = repPick("revenue_estimate");
  const repInvested = clientCampaigns.reduce((s, c) => s + c.spend, 0);
  const monthLabel = new Date().toLocaleDateString("ro-RO", { month: "long", year: "numeric" });

  async function saveHome() {
    if (!supabase || !cl.live || savingHome) return;
    setSavingHome(true);
    const { error } = await supabase.from("clients").update({
      monthly_lead_goal: homeFields.goal === "" ? null : Number(homeFields.goal),
      week_summary: homeFields.week.trim() || null,
      next_steps: homeFields.next.trim() || null,
    }).eq("id", id);
    setSavingHome(false);
    if (error) { push({ tone: "danger", title: "Nu am putut salva", description: error.message }); return; }
    push({ tone: "success", title: "Raport actualizat", description: "Clientul vede acum noile detalii în portal." });
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
                <Badge tone={client.status === "active" ? "success" : "warning"}>{client.status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {client.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{client.city}</span>}
                {client.contact && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.contact}</span>}
                {email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
                {client.retainer > 0 && <span>· {formatCurrency(client.retainer)}/lună retainer</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editează</Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invită în portal</Button>
            <Link to="/strategy" className="w-full sm:w-auto"><Button variant="primary" className="w-full"><Sparkles className="h-4 w-4" /> Cameră de strategie</Button></Link>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <Segmented value={tab} onChange={setTab} options={tabs.map((t) => ({ label: t, value: t }))} />
        </div>
      </Panel>

      {/* Overview tab — full client summary; other tabs swap to just their own content */}
      {tab === "Prezentare" && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Obiectivele lunii acesteia" icon={Target} subtitle="Salvate per client — persistă între reîncărcări">
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
            {objectives.length === 0 && <li className="col-span-2 rounded-lg border border-dashed border-border px-3 py-3 text-center text-sm text-muted-foreground">Încă niciun obiectiv — adaugă unul mai jos.</li>}
          </ul>
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
        <SectionCard title="Scor de sănătate" icon={Sparkles}>
          {cl.live && client.health === 0 ? (
            <div className="grid h-[150px] place-items-center px-4 text-center text-xs text-muted-foreground">Scorul de sănătate apare după ce evaluarea AI rulează pe o lună întreagă de activitate.</div>
          ) : (
            <RadialScore value={client.health} label={`risc ${client.risk}`} height={150} />
          )}
        </SectionCard>
      </div>
      )}

      {/* Latest client feedback (from the client portal) */}
      {tab === "Prezentare" && clientFeedback && (
        <SectionCard title="Cel mai recent feedback de la client" subtitle="Preluat din portalul clientului" icon={Mail} action={<Badge tone="info" dot>Nou</Badge>}>
          <p className="rounded-xl border border-info/30 bg-info/[0.06] p-4 text-sm leading-relaxed text-foreground">"{clientFeedback}"</p>
        </SectionCard>
      )}

      {/* Brand profile — auto-filled by the client's portal onboarding */}
      {tab === "Prezentare" && cl.live && (
        <SectionCard
          title="Profil de brand"
          icon={Megaphone}
          subtitle={brand?.onboardedAt ? `Completat de client · ${new Date(brand.onboardedAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}` : "Se completează automat când clientul finalizează onboarding-ul din portal"}
          action={<Badge tone={brand?.onboardedAt ? "success" : "neutral"} dot>{brand?.onboardedAt ? "Onboarding finalizat" : "În așteptarea clientului"}</Badge>}
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
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Invită clientul în portalul lui — onboarding-ul completează vocea brandului, publicul, obiectivele, ce vinde și multe altele, ca echipa ta să nu fie nevoită s-o facă.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invită în portal</Button>
            </div>
          )}
        </SectionCard>
      )}

      {/* Tab content */}
      {tab === "Prezentare" && (cl.live ? <NicheOverview clientId={client.id} niche={client.niche} /> : <NicheDashboard client={client} />)}

      {tab === "Conținut" && (
        <SectionCard title="Conținut programat" subtitle={`${clientPosts.length} ${clientPosts.length === 1 ? "postare" : "postări"} pentru ${client.name}`} action={<Link to="/content" className="text-xs font-700 text-primary">Deschide calendarul</Link>}>
          {clientPosts.length ? (
            <Table>
              <THead><TH>Titlu</TH><TH>Platformă</TH><TH>Dată</TH><TH>Status</TH></THead>
              <tbody>
                {clientPosts.slice().sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")).map((p) => (
                  <TR key={p.id}>
                    <TD className="max-w-[300px]"><p className="truncate font-600">{p.title}</p></TD>
                    <TD>{p.platform ? <Badge tone="neutral">{p.platform}</Badge> : <span className="text-muted-foreground">—</span>}</TD>
                    <TD className="text-muted-foreground">{p.date ?? "—"}</TD>
                    <TD className="text-muted-foreground">{POST_STATUS_LABEL[p.status] ?? p.status}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Încă niciun conținut. <Link to="/content" className="font-700 text-primary">Planifică în calendar</Link>.</p>
          )}
        </SectionCard>
      )}

      {tab === "Campanii" && (
        <SectionCard title="Campanii plătite" subtitle={`${clientCampaigns.length} pentru ${client.name}`} icon={Megaphone} action={<Link to="/campaigns" className="text-xs font-700 text-primary">Toate campaniile</Link>}>
          {clientCampaigns.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clientCampaigns.map((c) => {
                const pacing = c.budget > 0 ? Math.min((c.spend / c.budget) * 100, 100) : 0;
                const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                return (
                  <div key={c.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-600">{c.name}</p>
                      <Badge tone="neutral">{c.platform}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-600">{formatCurrency(c.spend)} <span className="text-muted-foreground">/ {formatCurrency(c.budget)}</span></span>
                      <span className="font-700 text-muted-foreground">ROAS {roas.toFixed(1)}×</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pacing}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nicio campanie pentru acest client. <Link to="/campaigns" className="font-700 text-primary">Creează una</Link>.</p>
          )}
        </SectionCard>
      )}

      {tab === "Rezultate" && (
        <div className="space-y-4">
          <BusinessImpactTab live={cl.live} niche={client.niche} rows={impactRows} />
          <SectionCard title="Performanță conținut" subtitle={`${clientVideos.length} ${clientVideos.length === 1 ? "videoclip" : "videoclipuri"}`} icon={TrendingUp} action={<Link to="/videos" className="text-xs font-700 text-primary">Toate</Link>}>
            {clientVideos.length ? (
              <Table>
                <THead><TH>Hook</TH><TH>Platformă</TH><TH>Dată</TH><TH className="text-right">Vizualizări</TH><TH>Scor AI</TH><TH>Acțiune</TH></THead>
                <tbody>
                  {clientVideos.map((v) => (
                    <TR key={v.id}>
                      <TD className="max-w-[280px]"><p className="truncate font-600">{v.hook}</p><p className="text-xs text-muted-foreground">{v.format}</p></TD>
                      <TD><Badge tone="neutral">{v.platform}</Badge></TD>
                      <TD className="text-muted-foreground">{v.date}</TD>
                      <TD className="text-right font-600">{formatNumber(v.views)}</TD>
                      <TD><span className={`font-display font-800 ${v.aiScore >= 80 ? "text-success" : v.aiScore >= 60 ? "text-[hsl(var(--warning))]" : "text-danger"}`}>{v.aiScore}</span></TD>
                      <TD><Badge tone={recTone[v.rec]}>{v.rec}</Badge></TD>
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

      {tab === "Raport" && (
        <div className="space-y-4">
          <SectionCard title={`Raport · ${monthLabel}`} subtitle="Exact ce vede clientul în portalul lui" icon={FileText}
            action={<Button variant="primary" size="sm" onClick={() => push({ tone: "success", title: "Trimis clientului", description: `${client.name} vede raportul în portalul lui.` })}><Send className="h-4 w-4" /> Trimite clientului</Button>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ReportStat label="Lead-uri" value={String(repLeads)} icon={Users} />
              <ReportStat label="Venit estimat" value={formatCurrency(repRevenue)} icon={TrendingUp} />
              <ReportStat label="Investit în ads" value={formatCurrency(repInvested)} icon={Wallet} />
              <ReportStat label="ROI" value={repInvested > 0 && repRevenue > 0 ? `${Math.round(repRevenue / repInvested)}×` : "—"} icon={Coins} />
            </div>
          </SectionCard>

          <SectionCard title="Mesajul pentru client" subtitle="În cuvinte simple — apare pe pagina lui de Acasă" icon={Wand2}>
            <div className="space-y-4">
              <ReportField label="Obiectivul lunii (nr. lead-uri)"><Input type="number" min={0} value={homeFields.goal} onChange={(e) => setHomeFields((f) => ({ ...f, goal: e.target.value }))} placeholder="ex. 40" /></ReportField>
              <ReportField label="Ce s-a întâmplat"><textarea value={homeFields.week} onChange={(e) => setHomeFields((f) => ({ ...f, week: e.target.value }))} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. Filmările despre albire au adus 9 programări noi." /></ReportField>
              <ReportField label="Ce urmează"><textarea value={homeFields.next} onChange={(e) => setHomeFields((f) => ({ ...f, next: e.target.value }))} className="min-h-[72px] w-full rounded-lg border border-input bg-card p-3 text-sm ring-focus" placeholder="ex. Pregătim 4 postări noi și relansăm reclama." /></ReportField>
              <div className="flex items-center justify-between gap-3">
                {!cl.live && <p className="text-xs text-muted-foreground">Disponibil în contul real (live).</p>}
                <Button variant="primary" className="ml-auto" disabled={savingHome || !cl.live} onClick={saveHome}>{savingHome && <Loader2 className="h-4 w-4 animate-spin" />} Salvează</Button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

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

      <InvitePortalModal open={inviteOpen} onClose={() => setInviteOpen(false)} clientId={client.id} clientName={client.name} live={cl.live} />

      <EditClientModal open={editOpen} onClose={() => setEditOpen(false)} client={client} website={det?.website ?? ""}
        onSave={async (patch) => {
          const res = await cl.updateClient(client.id, patch);
          if (res.error) push({ tone: "danger", title: "Salvarea nu a reușit", description: res.error });
          else push({ tone: "success", title: "Client actualizat", description: patch.name ?? client.name });
          return res;
        }}
        onArchive={async () => {
          const res = await cl.archiveClient(client.id);
          if (res.error) { push({ tone: "danger", title: "Arhivarea nu a reușit", description: res.error }); return; }
          push({ tone: "warning", title: "Client arhivat", description: client.name });
          navigate("/clients");
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

function EditClientModal({ open, onClose, client, website, onSave, onArchive }: {
  open: boolean; onClose: () => void; client: Client; website: string;
  onSave: (patch: ClientPatch) => Promise<{ error?: string }>; onArchive: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [niche, setNiche] = useState<Niche>("custom");
  const [city, setCity] = useState("");
  const [web, setWeb] = useState("");
  const [contact, setContact] = useState("");
  const [retainer, setRetainer] = useState("");
  const [status, setStatus] = useState<Client["status"]>("onboarding");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(client.name); setNiche(client.niche); setCity(client.city); setWeb(website); setContact(client.contact);
    setRetainer(client.retainer ? String(client.retainer) : ""); setStatus(client.status); setPlatforms(client.platforms);
  }, [open, client, website]);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await onSave({ name: name.trim(), niche, city: city.trim(), website: web.trim(), contact: contact.trim(), retainer: retainer ? Number(retainer) : null, status, platforms });
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
          <Field label="Website"><Input value={web} onChange={(e) => setWeb(e.target.value)} /></Field>
          <Field label="Persoană de contact"><Input value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label="Retainer lunar (€)"><Input type="number" value={retainer} onChange={(e) => setRetainer(e.target.value)} /></Field>
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as Client["status"])} className="w-full"><option value="active">Activ</option><option value="paused">În pauză</option><option value="onboarding">Onboarding</option></Select></Field>
        </div>
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

function InvitePortalModal({ open, onClose, clientId, clientName, live }: { open: boolean; onClose: () => void; clientId: string; clientName: string; live: boolean }) {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string | null; existing: boolean } | null>(null);

  function close() { onClose(); setTimeout(() => { setEmail(""); setResult(null); setBusy(false); }, 200); }

  async function invite() {
    if (!email.trim() || busy) return;
    if (!live || !supabase) { push({ tone: "info", title: "Doar workspace live", description: "Invitațiile în portal necesită un workspace Supabase live." }); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-client-viewer", { body: { clientId, email: email.trim() } });
    setBusy(false);
    if (error || data?.error) { push({ tone: "danger", title: "Invitarea nu a reușit", description: data?.error ?? error?.message }); return; }
    setResult({ email: data.email, password: data.password, existing: data.existing });
    push({ tone: "success", title: data.existing ? "Acces la portal acordat" : "Client invitat", description: clientName });
  }

  return (
    <Modal open={open} onClose={close} title="Invită clientul în portal" subtitle={`Oferă unei persoane de contact de la ${clientName} acces la aprobări + rezultate`} size="sm"
      footer={result ? <Button variant="primary" className="ml-auto" onClick={close}>Gata</Button> : <><Button variant="ghost" onClick={close}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !email.trim()} onClick={invite}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Trimite invitația</Button></>}>
      {result ? (
        <div className="space-y-3 text-sm">
          {result.existing ? (
            <p className="rounded-lg bg-success/10 p-3 text-success">{result.email} avea deja un cont — acum are acces la portalul pentru {clientName}. Se poate autentifica ca de obicei.</p>
          ) : (
            <>
              <p className="text-muted-foreground">Trimite-i clientului aceste date de autentificare. Va ajunge direct în portalul lui.</p>
              <div className="rounded-lg border border-border p-3">
                <Row label="Email" value={result.email} />
                <Row label="Parolă temporară" value={result.password ?? "—"} />
              </div>
              <p className="text-xs text-muted-foreground">Poate schimba parola după autentificare.</p>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-xs font-700 text-muted-foreground">Email de contact al clientului</p>
          <Input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@client.com" onKeyDown={(e) => { if (e.key === "Enter") invite(); }} />
        </div>
      )}
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
        {[{ l: "Apeluri primite", v: "42" }, { l: "Rezervări", v: "26" }, { l: "Impact pe venituri", v: "€38.2K" }, { l: "DM-uri relevante", v: "138" }].map((m) => (
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
    : `Încă niciun impact raportat pentru ${monthName} — clientul îl poate trimite din portalul lui sau îl poți adăuga tu în Impact în afacere.`;

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

function Row({ label, value }: { label: string; value: string }) {
  const { push } = useToast();
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs font-700 text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-xs">{value}
        <button onClick={() => { navigator.clipboard?.writeText(value); push({ tone: "success", title: "Copiat" }); }} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
      </span>
    </div>
  );
}
