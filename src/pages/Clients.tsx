import { Link } from "react-router-dom";
import { useState } from "react";
import { PageHeader, Button, Badge, SearchInput, Select, Panel, Segmented } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { SkeletonCard, SkeletonRows } from "@/components/Skeleton";
import { BulkObjectivesModal } from "@/components/BulkObjectivesModal";
import { nicheLabels, type Client } from "@/data/sample";
import { formatCurrency, cn } from "@/lib/utils";
import { useUI } from "@/lib/ui-context";
import { useToast } from "@/lib/toast";
import { useClients } from "@/lib/clients";
import { useWorkspace } from "@/lib/workspace";
import { Archive, ArrowDownRight, ArrowUpRight, Check, Download, MapPin, Plus, Target, Users, X } from "lucide-react";

const statusTone = { active: "success", paused: "warning", onboarding: "info" } as const;
const PLAN_MAX: Record<string, number | null> = {
  "Starter Agency": 5, "Growth Agency": 15, "Unlimited Agency": null, "White Label Pro": null,
};

function Box({ checked, onClick, className }: { checked: boolean; onClick: (e: React.MouseEvent) => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "grid h-5 w-5 place-items-center rounded-[6px] border transition",
        checked ? "gradient-primary border-transparent text-white" : "border-border bg-card hover:border-primary/50",
        className
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function Clients() {
  const { openNewClient } = useUI();
  const { push } = useToast();
  const { clients, loading, archiveClient } = useClients();
  const { currentAgency } = useWorkspace();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [niche, setNiche] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkObjectivesOpen, setBulkObjectivesOpen] = useState(false);

  const planMax = PLAN_MAX[currentAgency.plan] ?? null;
  const filtered = clients.filter(
    (c) =>
      (niche === "all" || c.niche === niche) &&
      (status === "all" || c.status === status) &&
      (q === "" || c.name.toLowerCase().includes(q.toLowerCase()))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }
  async function bulkArchive() {
    const ids = [...selected];
    setSelected(new Set());
    const results = await Promise.all(ids.map((id) => archiveClient(id)));
    const failed = results.filter((r) => r.error).length;
    if (failed) push({ tone: "danger", title: "Unii clienți nu au putut fi arhivați", description: `${failed} din ${ids.length} au eșuat` });
    else push({ tone: "warning", title: "Clienți arhivați", description: `${ids.length} ${ids.length === 1 ? "client" : "clienți"}` });
  }
  function exportCsv() {
    const rows = filtered.filter((c) => selected.has(c.id));
    const header = ["Nume", "Nișă", "Oraș", "Contact", "Retainer", "Status", "Platforme"];
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const body = rows.map((c) => [c.name, nicheLabels[c.niche], c.city, c.contact, c.retainer, c.status, c.platforms.join(" / ")].map((v) => esc(String(v))).join(","));
    const csv = [header.join(","), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    push({ tone: "success", title: "Exportat", description: `${rows.length} ${rows.length === 1 ? "client" : "clienți"} → CSV` });
    setSelected(new Set());
  }
  function bulk(title: string, tone: "success" | "info" | "warning" = "success") {
    push({ tone, title, description: `${selected.size} ${selected.size === 1 ? "client" : "clienți"}` });
    setSelected(new Set());
  }

  return (
    <>
      <PageHeader title="Clienți" subtitle={`${clients.length}${planMax ? ` din ${planMax}` : ""} ${(planMax ?? clients.length) === 1 ? "client" : "clienți"} · ${currentAgency.plan}`}>
        <Button variant="primary" onClick={openNewClient}>
          <Plus className="h-4 w-4" /> Adaugă client
        </Button>
      </PageHeader>

      <Panel className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Caută clienți…" className="sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={niche} onChange={(e) => setNiche(e.target.value)}>
          <option value="all">Toate nișele</option>
          {Object.entries(nicheLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Toate stările</option>
          <option value="active">Activ</option><option value="paused">În pauză</option><option value="onboarding">Onboarding</option>
        </Select>
        <div className="sm:ml-auto">
          <Segmented value={view} onChange={setView} options={[{ label: "Grilă", value: "grid" }, { label: "Listă", value: "list" }]} />
        </div>
      </Panel>

      {loading ? (
        view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (
          <SkeletonRows rows={8} cols={6} />
        )
      ) : filtered.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Users className="h-7 w-7" /></span>
          {clients.length === 0 ? (
            <>
              <p className="font-display text-lg font-700">Încă niciun client</p>
              <p className="max-w-sm text-sm text-muted-foreground">Adaugă-ți primul client ca să creezi un spațiu de lucru dedicat, cu tablou de bord pe nișă, calendar și rapoarte.</p>
              <Button variant="primary" className="mt-1" onClick={openNewClient}><Plus className="h-4 w-4" /> Adaugă primul client</Button>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-700">Niciun rezultat</p>
              <p className="max-w-sm text-sm text-muted-foreground">Niciun client nu corespunde filtrelor selectate. Încearcă să ștergi căutarea sau să resetezi filtrele.</p>
            </>
          )}
        </Panel>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => <ClientCard key={c.id} c={c} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />)}
        </div>
      ) : (
        <Panel>
          <Table>
            <THead>
              <TH className="w-10"><Box checked={selected.size === filtered.length && filtered.length > 0} onClick={(e) => { e.preventDefault(); toggleAll(); }} /></TH>
              <TH>Client</TH>
              <TH>Nișă</TH>
              <TH>Oraș</TH>
              <TH>Retainer</TH>
              <TH>Sănătate</TH>
              <TH>Status</TH>
              <TH>Tendință</TH>
            </THead>
            <tbody>
              {filtered.map((c) => (
                <TR key={c.id} className={cn(selected.has(c.id) && "bg-primary/[0.04]")}>
                  <TD><Box checked={selected.has(c.id)} onClick={(e) => { e.preventDefault(); toggle(c.id); }} /></TD>
                  <TD><Link to={`/clients/${c.id}`} className="flex items-center gap-3"><Avatar2 name={c.name} /><span className="font-600">{c.name}</span></Link></TD>
                  <TD><Badge tone="primary">{nicheLabels[c.niche]}</Badge></TD>
                  <TD className="text-muted-foreground">{c.city}</TD>
                  <TD className="font-600">{formatCurrency(c.retainer)}</TD>
                  <TD><Badge tone={c.risk === "high" ? "danger" : c.risk === "medium" ? "warning" : "success"} dot>{c.health}</Badge></TD>
                  <TD><Badge tone={statusTone[c.status]}>{c.status}</Badge></TD>
                  <TD>
                    <span className={`inline-flex items-center gap-0.5 font-700 ${c.trend >= 0 ? "text-success" : "text-danger"}`}>
                      {c.trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(c.trend)}%
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 animate-scale-in flex-wrap items-center justify-center gap-2 panel px-3 py-2.5 shadow-glow">
          <span className="flex items-center gap-2 pr-1 text-sm font-700">
            <span className="grid h-6 min-w-6 place-items-center rounded-full gradient-primary px-1.5 text-xs text-white">{selected.size}</span>
            selectați
          </span>
          <span className="h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={() => setBulkObjectivesOpen(true)}><Target className="h-4 w-4" /> Obiective</Button>
          <Button variant="ghost" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Exportă CSV</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={bulkArchive}><Archive className="h-4 w-4" /> Arhivează</Button>
          <span className="h-5 w-px bg-border" />
          <button onClick={() => setSelected(new Set())} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      <BulkObjectivesModal
        open={bulkObjectivesOpen}
        onClose={() => { setBulkObjectivesOpen(false); setSelected(new Set()); }}
        clientIds={[...selected]}
        clientNames={filtered.filter((c) => selected.has(c.id)).map((c) => c.name)}
      />
    </>
  );
}

function ClientCard({ c, selected, onToggle }: { c: Client; selected: boolean; onToggle: () => void }) {
  return (
    <Link to={`/clients/${c.id}`}>
      <Panel className={cn("group relative p-5 transition hover:-translate-y-0.5 hover:shadow-glow", selected && "ring-2 ring-primary")}>
        <div className={cn("absolute left-3 top-3 transition", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          <Box checked={selected} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }} />
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 pl-7">
            <Avatar2 name={c.name} size={44} />
            <div>
              <p className="font-display font-700">{c.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {c.city}</p>
            </div>
          </div>
          <Badge tone={statusTone[c.status]}>{c.status}</Badge>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Badge tone="primary">{nicheLabels[c.niche]}</Badge>
          {c.platforms.slice(0, 3).map((p) => <span key={p} className="rounded-md bg-muted px-2 py-1 text-[10px] font-600 text-muted-foreground">{p}</span>)}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <Mini label="Retainer" value={`€${(c.retainer / 1000).toFixed(1)}k`} />
          <Mini label="Sănătate" value={String(c.health)} tone={c.risk} />
          <Mini label="Tendință" value={`${c.trend >= 0 ? "+" : ""}${c.trend}%`} tone={c.trend >= 0 ? "low" : "high"} />
        </div>
      </Panel>
    </Link>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const color = tone === "high" ? "text-danger" : tone === "medium" ? "text-[hsl(var(--warning))]" : tone === "low" ? "text-success" : "";
  return (
    <div>
      <p className={`font-display text-base font-800 ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Avatar2({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 font-800 text-white" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {name.slice(0, 2)}
    </span>
  );
}
