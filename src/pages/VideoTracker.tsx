import { useEffect, useState } from "react";
import { PageHeader, Button, SearchInput, Select, Badge, Panel, Input } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Drawer, Modal } from "@/components/overlay";
import { StatCard } from "@/components/StatCard";
import { SkeletonRows } from "@/components/Skeleton";
import { type VideoRow } from "@/data/sample";
import { useLibrary, type NewVideoInput, type VideoPatch } from "@/lib/library";
import { useClients } from "@/lib/clients";
import { compact, formatNumber, downloadCsv } from "@/lib/utils";
import { useToast } from "@/lib/toast";
import { useDateRange } from "@/lib/daterange";
import { CalendarDays, Download, Eye, ExternalLink, Loader2, Plus, Repeat, Sparkles, Trash2, Wand2 } from "lucide-react";

const recTone = { repeat: "success", improve: "warning", stop: "danger" } as const;
const recLabel = { repeat: "Repetă", improve: "Îmbunătățește", stop: "Oprește" } as const;
const platformsList = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"];
const scoreColor = (s: number) => (s >= 80 ? "text-success" : s >= 60 ? "text-[hsl(var(--warning))]" : "text-danger");
const fmtDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00").toLocaleString("ro-RO", { month: "short", day: "numeric" }) : d);

export default function VideoTracker() {
  const { push } = useToast();
  const { videos, loading, live, createVideo, updateVideo, deleteVideo } = useLibrary();
  const { clients } = useClients();
  const { current, inRange, parseDay } = useDateRange();
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [rec, setRec] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const selected = videos.find((v) => v.id === selectedId) ?? null;

  // Live shows all logged videos; demo narrows to the top-bar date range.
  const inWindow = live ? videos : videos.filter((v) => inRange(parseDay(v.date)));
  const rows = inWindow.filter(
    (v) =>
      (v.hook.toLowerCase().includes(q.toLowerCase()) || v.client.toLowerCase().includes(q.toLowerCase())) &&
      (platform === "all" || v.platform === platform) &&
      (rec === "all" || v.rec === rec)
  );
  const totalViews = inWindow.reduce((s, v) => s + v.views, 0);
  const avgScore = inWindow.length ? Math.round(inWindow.reduce((s, v) => s + v.aiScore, 0) / inWindow.length) : 0;
  const avgRetention = inWindow.length ? Math.round(inWindow.reduce((s, v) => s + v.retention3s, 0) / inWindow.length) : 0;
  const repeatWorthy = inWindow.filter((v) => v.rec === "repeat").length;

  function exportVideos() {
    const data = rows.map((v) => [v.hook, v.client, v.platform, fmtDate(v.date), v.views, v.aiScore, v.retention3s, recLabel[v.rec] ?? v.rec]);
    if (!data.length) { push({ tone: "info", title: "Nimic de exportat", description: "Niciun video nu corespunde filtrelor curente." }); return; }
    downloadCsv(`videos-${new Date().toISOString().slice(0, 10)}.csv`, ["Hook", "Client", "Platformă", "Dată", "Vizualizări", "Scor AI", "Retenție 3s %", "Recomandare"], data);
    push({ tone: "success", title: "Exportat", description: `${data.length} video${data.length === 1 ? "" : "uri"} → CSV` });
  }

  if (loading) return <SkeletonRows rows={8} cols={6} />;

  return (
    <>
      <PageHeader title="Performanță video" subtitle={`${inWindow.length} video${inWindow.length === 1 ? "" : "uri"}${live ? "" : ` · ${current.range}`}`}>
        <Button variant="outline" onClick={exportVideos}><Download className="h-4 w-4" /> Exportă</Button>
        <Button variant="primary" onClick={() => setComposerOpen(true)} disabled={live && clients.length === 0}><Plus className="h-4 w-4" /> Adaugă video</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total vizualizări" value={compact(totalViews)} sub="luna aceasta" icon={Eye} />
        <StatCard label="Scor AI mediu" value={String(avgScore)} sub="din 100" icon={Sparkles} tone="success" />
        <StatCard label="Demne de repetat" value={`${repeatWorthy}`} sub="formate câștigătoare" icon={Repeat} tone="info" />
        <StatCard label="Retenție medie 3s" value={`${avgRetention}%`} sub="puterea hook-ului" icon={Wand2} tone="warning" />
      </div>

      <Panel>
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <SearchInput placeholder="Caută hook sau client…" className="sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">Toate platformele</option>
            {platformsList.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={rec} onChange={(e) => setRec(e.target.value)}>
            <option value="all">Toate recomandările</option>
            <option value="repeat">Repetă</option>
            <option value="improve">Îmbunătățește</option>
            <option value="stop">Oprește</option>
          </Select>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-600 text-primary sm:ml-auto">
            <CalendarDays className="h-3.5 w-3.5" /> {current.label}
          </span>
        </div>
        <Table>
          <THead>
            <TH>Hook</TH>
            <TH>Client</TH>
            <TH>Platformă</TH>
            <TH>Dată</TH>
            <TH className="text-right">Vizualizări</TH>
            <TH className="text-right">Ret. 3s</TH>
            <TH className="text-right">Compl.</TH>
            <TH className="text-right">Salvări</TH>
            <TH className="text-right">DM-uri</TH>
            <TH>Scor AI</TH>
            <TH>Acțiune</TH>
          </THead>
          <tbody>
            {rows.map((v) => (
              <TR key={v.id} className="cursor-pointer" onClick={() => setSelectedId(v.id)}>
                <TD className="max-w-[260px]">
                  <p className="truncate font-600">{v.hook}</p>
                  <p className="text-xs text-muted-foreground">{v.format}</p>
                </TD>
                <TD className="text-muted-foreground">{v.client}</TD>
                <TD><Badge tone="neutral">{v.platform}</Badge></TD>
                <TD className="text-muted-foreground">{fmtDate(v.date)}</TD>
                <TD className="text-right font-600">{formatNumber(v.views)}</TD>
                <TD className="text-right">{v.retention3s}%</TD>
                <TD className="text-right">{v.completion}%</TD>
                <TD className="text-right">{formatNumber(v.saves)}</TD>
                <TD className="text-right">{v.dms}</TD>
                <TD><span className={`font-display text-sm font-800 ${scoreColor(v.aiScore)}`}>{v.aiScore}</span></TD>
                <TD><Badge tone={recTone[v.rec]}>{recLabel[v.rec]}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
            {videos.length === 0 ? (
              <>
                <p className="text-sm font-600">Niciun video înregistrat încă</p>
                <p className="text-xs text-muted-foreground">{live && clients.length === 0 ? "Adaugă mai întâi un client, apoi înregistrează-i videoclipurile." : "Înregistrează un video pentru a începe să urmărești performanța."}</p>
                {!(live && clients.length === 0) && <Button variant="primary" size="sm" className="mt-2" onClick={() => setComposerOpen(true)}><Plus className="h-4 w-4" /> Adaugă video</Button>}
              </>
            ) : (
              <>
                <p className="text-sm font-600">Niciun video nu corespunde filtrelor</p>
                <p className="text-xs text-muted-foreground">Încearcă să ștergi căutarea sau filtrele{live ? "" : " ori să lărgești intervalul de date"}.</p>
              </>
            )}
          </div>
        )}
      </Panel>

      {/* Video detail drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        width={520}
        title={selected?.hook}
        subtitle={selected ? `${selected.client} · ${selected.platform} · ${fmtDate(selected.date)}` : undefined}
        badge={selected && <Badge tone={recTone[selected.rec]}>{recLabel[selected.rec]}</Badge>}
        footer={
          <>
            <Button variant="ghost" size="sm" className="text-danger" onClick={async () => {
              if (!selected) return;
              const id = selected.id; setSelectedId(null);
              const res = await deleteVideo(id);
              if (res.error) push({ tone: "danger", title: "Nu s-a putut șterge", description: res.error });
              else push({ tone: "warning", title: "Video șters", description: selected.hook });
            }}><Trash2 className="h-4 w-4" /> Șterge</Button>
            <Button variant="primary" size="sm" className="ml-auto" onClick={() => setEditOpen(true)}>Editează metricile</Button>
          </>
        }
      >
        {selected && <VideoDetail v={selected} />}
      </Drawer>

      <EditVideoModal open={editOpen} onClose={() => setEditOpen(false)} video={selected}
        onSave={async (patch) => {
          if (!selected) return {};
          const res = await updateVideo(selected.id, patch);
          if (res.error) push({ tone: "danger", title: "Nu s-a putut salva", description: res.error });
          else push({ tone: "success", title: "Metrici actualizate", description: selected.hook });
          return res;
        }} />

      <LogVideoComposer open={composerOpen} onClose={() => setComposerOpen(false)} clients={clients}
        onCreate={async (input) => {
          const res = await createVideo(input);
          if (res.error) push({ tone: "danger", title: "Nu s-a putut înregistra videoclipul", description: res.error });
          else push({ tone: "success", title: "Video înregistrat", description: input.hook });
          return res;
        }} />
    </>
  );
}

function LogVideoComposer({ open, onClose, clients, onCreate }: {
  open: boolean; onClose: () => void; clients: { id: string; name: string }[];
  onCreate: (input: NewVideoInput) => Promise<{ error?: string }>;
}) {
  const [clientId, setClientId] = useState("");
  const [hook, setHook] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [date, setDate] = useState("");
  const [format, setFormat] = useState("");
  const [views, setViews] = useState("");
  const [aiScore, setAiScore] = useState("");
  const [rec, setRec] = useState<"repeat" | "improve" | "stop">("improve");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setClientId(clients[0]?.id ?? ""); setHook(""); setPlatform("Instagram"); setDate(""); setFormat(""); setViews(""); setAiScore(""); setRec("improve"); } }, [open, clients]);

  async function submit() {
    if (!hook.trim() || !clientId || busy) return;
    setBusy(true);
    const res = await onCreate({ clientId, hook: hook.trim(), platform, date: date || null, format: format.trim(), views: views ? Number(views) : 0, aiScore: aiScore ? Number(aiScore) : null, rec });
    setBusy(false);
    if (!res.error) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Adaugă un video" subtitle="Înregistrează un video publicat și performanța lui" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !hook.trim() || !clientId} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Adaugă video</Button></>}>
      <div className="space-y-4">
        <VField label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></VField>
        <VField label="Linia de hook"><Input autoFocus value={hook} onChange={(e) => setHook(e.target.value)} placeholder={'ex. "Acest apartament de 450k € s-a vândut în 3 zile…"'} /></VField>
        <div className="grid grid-cols-2 gap-3">
          <VField label="Platformă"><Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full">{platformsList.map((p) => <option key={p}>{p}</option>)}</Select></VField>
          <VField label="Data publicării"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></VField>
        </div>
        <VField label="Format"><Input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="ex. Tur proprietate, Transformare" /></VField>
        <div className="grid grid-cols-3 gap-3">
          <VField label="Vizualizări"><Input type="number" value={views} onChange={(e) => setViews(e.target.value)} placeholder="0" /></VField>
          <VField label="Scor AI"><Input type="number" value={aiScore} onChange={(e) => setAiScore(e.target.value)} placeholder="0–100" /></VField>
          <VField label="Recomandare"><Select value={rec} onChange={(e) => setRec(e.target.value as "repeat" | "improve" | "stop")} className="w-full"><option value="repeat">Repetă</option><option value="improve">Îmbunătățește</option><option value="stop">Oprește</option></Select></VField>
        </div>
      </div>
    </Modal>
  );
}

function EditVideoModal({ open, onClose, video, onSave }: {
  open: boolean; onClose: () => void; video: VideoRow | null;
  onSave: (patch: VideoPatch) => Promise<{ error?: string }>;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && video) setF({
      hook: video.hook, format: video.format, platform: video.platform || "Instagram",
      views: String(video.views), reach: String(video.reach), aiScore: String(video.aiScore), rec: video.rec,
      retention3s: String(video.retention3s), completion: String(video.completion),
      likes: String(video.likes), comments: String(video.comments), shares: String(video.shares), saves: String(video.saves), dms: String(video.dms),
    });
  }, [open, video]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const numOr = (s: string) => (s === "" ? 0 : Number(s));
  async function save() {
    if (busy) return;
    setBusy(true);
    const res = await onSave({
      hook: f.hook, format: f.format, platform: f.platform,
      views: numOr(f.views), reach: numOr(f.reach), aiScore: f.aiScore === "" ? null : Number(f.aiScore), rec: f.rec as "repeat" | "improve" | "stop",
      retention3s: numOr(f.retention3s), completion: numOr(f.completion),
      likes: numOr(f.likes), comments: numOr(f.comments), shares: numOr(f.shares), saves: numOr(f.saves), dms: numOr(f.dms),
    });
    setBusy(false);
    if (!res.error) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Editează metricile video" subtitle={video?.hook} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvează metricile</Button></>}>
      <div className="space-y-4">
        <VField label="Linia de hook"><Input value={f.hook ?? ""} onChange={(e) => set("hook", e.target.value)} /></VField>
        <div className="grid grid-cols-2 gap-3">
          <VField label="Platformă"><Select value={f.platform ?? ""} onChange={(e) => set("platform", e.target.value)} className="w-full">{platformsList.map((p) => <option key={p}>{p}</option>)}</Select></VField>
          <VField label="Format"><Input value={f.format ?? ""} onChange={(e) => set("format", e.target.value)} /></VField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <VField label="Vizualizări"><Input type="number" value={f.views ?? ""} onChange={(e) => set("views", e.target.value)} /></VField>
          <VField label="Reach"><Input type="number" value={f.reach ?? ""} onChange={(e) => set("reach", e.target.value)} /></VField>
          <VField label="Scor AI"><Input type="number" value={f.aiScore ?? ""} onChange={(e) => set("aiScore", e.target.value)} /></VField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <VField label="Ret. 3s %"><Input type="number" value={f.retention3s ?? ""} onChange={(e) => set("retention3s", e.target.value)} /></VField>
          <VField label="Compl. %"><Input type="number" value={f.completion ?? ""} onChange={(e) => set("completion", e.target.value)} /></VField>
          <VField label="Recomandare"><Select value={f.rec ?? "improve"} onChange={(e) => set("rec", e.target.value)} className="w-full"><option value="repeat">Repetă</option><option value="improve">Îmbunătățește</option><option value="stop">Oprește</option></Select></VField>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <VField label="Aprecieri"><Input type="number" value={f.likes ?? ""} onChange={(e) => set("likes", e.target.value)} /></VField>
          <VField label="Comentarii"><Input type="number" value={f.comments ?? ""} onChange={(e) => set("comments", e.target.value)} /></VField>
          <VField label="Distribuiri"><Input type="number" value={f.shares ?? ""} onChange={(e) => set("shares", e.target.value)} /></VField>
          <VField label="Salvări"><Input type="number" value={f.saves ?? ""} onChange={(e) => set("saves", e.target.value)} /></VField>
          <VField label="DM-uri"><Input type="number" value={f.dms ?? ""} onChange={(e) => set("dms", e.target.value)} /></VField>
        </div>
      </div>
    </Modal>
  );
}

function VField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}

function VideoDetail({ v }: { v: VideoRow }) {
  const metrics: [string, string][] = [
    ["Vizualizări", formatNumber(v.views)],
    ["Reach", formatNumber(v.reach)],
    ["Timp mediu de vizionare", `${v.watchTime}s`],
    ["Durată", `${v.duration}s`],
    ["Retenție 3s", `${v.retention3s}%`],
    ["Retenție 50%", `${v.retention50}%`],
    ["Completare", `${v.completion}%`],
    ["Aprecieri", formatNumber(v.likes)],
    ["Comentarii", formatNumber(v.comments)],
    ["Distribuiri", formatNumber(v.shares)],
    ["Salvări", formatNumber(v.saves)],
    ["DM-uri", String(v.dms)],
    ["Apeluri", String(v.calls)],
  ];
  return (
    <div className="space-y-5">
      {/* AI score + insight */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
        <div className="text-center">
          <p className={`font-display text-4xl font-800 ${scoreColor(v.aiScore)}`}>{v.aiScore}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Scor AI</p>
        </div>
        <div className="border-l border-border pl-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-700 text-primary"><Sparkles className="h-3.5 w-3.5" /> Perspectivă AI</div>
          <p className="text-sm leading-snug text-muted-foreground">{v.aiInsight}</p>
        </div>
      </div>

      {/* Metrics grid */}
      <div>
        <p className="mb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Performanță</p>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map(([label, val]) => (
            <div key={label} className="rounded-lg border border-border p-2.5">
              <p className="font-display text-base font-800">{val}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Creative */}
      <div>
        <p className="mb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Creativ</p>
        <div className="space-y-2">
          <Row label="Hook">{v.hook}</Row>
          <Row label="Unghi de conținut">{v.bodyAngle}</Row>
          <Row label="CTA">{v.cta}</Row>
          <Row label="Format">{v.format}</Row>
          <Row label="Obiectiv">{v.objective}</Row>
        </div>
      </div>

      {/* Impact + feedback */}
      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-xl border border-success/30 bg-success/[0.06] p-3">
          <p className="text-xs font-700 text-success">Impact estimat în afacere</p>
          <p className="mt-0.5 text-sm">{v.salesImpact}</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-700 text-muted-foreground">Feedback de la client</p>
          <p className="mt-0.5 text-sm">“{v.feedback}”</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-24 shrink-0 text-xs font-700 text-muted-foreground">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
