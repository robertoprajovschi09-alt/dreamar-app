import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader, Panel, Button, Select } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { useClients } from "@/lib/clients";
import { useMoney, type YanisDeal, type InvoiceStatus } from "@/lib/money";
import { useToast } from "@/lib/toast";
import { useIsMobile } from "@/lib/useIsMobile";
import { formatCurrency, cn } from "@/lib/utils";
import type { Client } from "@/data/sample";
import { Check, Copy, Plus, Trash2, Wallet, Coins, ShieldCheck, Car, FileText } from "lucide-react";

type MoneyApi = ReturnType<typeof useMoney>;

/* helpers */
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function mondayOf(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const fmtDay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : iso);
const lei = (n: number) => formatCurrency(n);

// A client's name is always a link to their page (unless there is no client).
function ClientLink({ id, name, className }: { id: string | null; name: string; className?: string }) {
  return id ? <Link to={`/clients/${id}`} className={cn(className, "hover:text-primary hover:underline")}>{name}</Link> : <span className={className}>{name}</span>;
}

export default function Money() {
  const money = useMoney();
  const { clients, loading: lc } = useClients();
  const [sp] = useSearchParams();
  const focus = sp.get("focus");
  // Deep link from an Azi alert (?focus=col-<id> / fact-<id>): scroll to + flash the row.
  useEffect(() => {
    if (!focus || money.loading || lc) return;
    const t = setTimeout(() => {
      const el = document.getElementById(focus);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-inset", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-inset", "ring-primary"), 2600);
    }, 80);
    return () => clearTimeout(t);
  }, [focus, money.loading, lc]);
  if (money.loading || lc) return <PageSkeleton variant="dashboard" />;
  return (
    <>
      <PageHeader title="Bani" subtitle="Încasări, deconturi și runway" help="bani" />
      <div className="space-y-4">
        <Collections money={money} clients={clients} />
        <Facturare money={money} clients={clients} />
        <Yanis money={money} />
        <Buckets money={money} />
        <Runway money={money} />
      </div>
    </>
  );
}

/* ── small controls ──────────────────────────────────────────────────────── */
function NumInput({ value, onCommit, className, placeholder }: { value: number; onCommit: (n: number) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(String(value ?? 0));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setV(String(value ?? 0)); }, [value, focused]);
  return (
    <input
      type="number" inputMode="numeric" value={v} placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setFocused(false); const n = Number(v); onCommit(Number.isFinite(n) && n >= 0 ? n : 0); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={cn("h-9 rounded-lg border border-input bg-card px-2 text-sm ring-focus", className)}
    />
  );
}
function TextInput({ value, onCommit, className, placeholder }: { value: string; onCommit: (s: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setV(value); }, [value, focused]);
  return (
    <input
      value={v} placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setFocused(false); onCommit(v.trim()); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={cn("h-9 w-full rounded-lg border border-input bg-card px-2 text-sm ring-focus", className)}
    />
  );
}
function Toggle({ on, onToggle, onLabel, offLabel }: { on: boolean; onToggle: () => void; onLabel: string; offLabel: string }) {
  return (
    <button onClick={onToggle} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-700 transition", on ? "bg-success/15 text-success" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
      {on && <Check className="h-3.5 w-3.5" />}{on ? onLabel : offLabel}
    </button>
  );
}
function Block({ icon: Icon, tone, title, right, children }: { icon: typeof Wallet; tone: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
        <p className="font-display text-sm font-800">{title}</p>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </Panel>
  );
}

/* ── 1 · Încasări luna curentă ───────────────────────────────────────────── */
function Collections({ money, clients }: { money: MoneyApi; clients: Client[] }) {
  const { collections, overdueCollections, updateCollection, removeCollection, addCollection, generateFromRetainers } = money;
  const isMobile = useIsMobile();
  const nameOf = useMemo(() => { const m = new Map(clients.map((c) => [c.id, c.name] as const)); return (id: string | null) => (id ? m.get(id) ?? "Client" : "Fără client"); }, [clients]);
  const rows = [...collections].sort((a, b) => nameOf(a.clientId).localeCompare(nameOf(b.clientId)) || a.dueDay - b.dueDay);
  const overdueDays = useMemo(() => new Map(overdueCollections.map((o) => [o.id, o.daysOverdue] as const)), [overdueCollections]);

  const collected = rows.filter((r) => r.collected).reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter((r) => !r.collected).reduce((s, r) => s + r.amount, 0);

  const [newClient, setNewClient] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDay, setNewDay] = useState("1");
  function add() {
    const amt = Number(newAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const day = Math.min(31, Math.max(1, Number(newDay) || 1));
    void addCollection(newClient || null, amt, day);
    setNewAmount("");
  }

  return (
    <Block icon={Wallet} tone="text-primary" title="Încasări luna curentă">
      <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60">
        <div className="bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Încasat</p><p className="font-display text-2xl font-800 text-success">{lei(collected)}</p></div>
        <div className="bg-card px-4 py-3"><p className="text-xs text-muted-foreground">De încasat</p><p className="font-display text-2xl font-800">{lei(pending)}</p></div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Nicio scadență luna asta.</p>
          <Button size="sm" variant="outline" onClick={() => void generateFromRetainers(clients)}><Plus className="h-4 w-4" /> Generează din retainere</Button>
        </div>
      ) : (
        rows.map((r) => {
          const od = overdueDays.get(r.id);
          const overdueLabel = od !== undefined ? <span className="text-[11px] font-700 text-danger">{od === 1 ? "scadent de 1 zi" : `scadent de ${od} zile`}</span> : null;
          const accent = cn("border-t border-border/60 border-l-2", od !== undefined ? "border-l-danger bg-danger/[0.04]" : "border-l-transparent");
          return isMobile ? (
            /* Mobile: stacked card - name + status on top, amount + due day below. */
            <div key={r.id} id={`col-${r.id}`} className={cn("px-4 py-2.5", accent)}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ClientLink id={r.clientId} name={nameOf(r.clientId)} className="block truncate text-sm font-600" />
                  {overdueLabel}
                </div>
                <Toggle on={r.collected} onToggle={() => void updateCollection(r.id, { collected: !r.collected })} onLabel="Încasat" offLabel="Neîncasat" />
                <button onClick={() => void removeCollection(r.id)} aria-label="Șterge" className="shrink-0 text-muted-foreground transition hover:text-danger"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <NumInput value={r.amount} onCommit={(n) => void updateCollection(r.id, { amount: n })} className="w-28 text-right" />
                <span className="text-xs text-muted-foreground">lei</span>
                <span className="ml-auto text-xs text-muted-foreground">scadent pe</span>
                <NumInput value={r.dueDay} onCommit={(n) => void updateCollection(r.id, { dueDay: Math.min(31, Math.max(1, n)) })} className="w-14 text-center" />
              </div>
            </div>
          ) : (
            <div key={r.id} id={`col-${r.id}`} className={cn("group flex items-center gap-2 px-4 py-2 sm:gap-3", accent)}>
              <div className="min-w-0 flex-1">
                <ClientLink id={r.clientId} name={nameOf(r.clientId)} className="block truncate text-sm font-600" />
                {overdueLabel}
              </div>
              <NumInput value={r.amount} onCommit={(n) => void updateCollection(r.id, { amount: n })} className="w-24 text-right" />
              <span className="text-xs text-muted-foreground">pe</span>
              <NumInput value={r.dueDay} onCommit={(n) => void updateCollection(r.id, { dueDay: Math.min(31, Math.max(1, n)) })} className="w-14 text-center" />
              <Toggle on={r.collected} onToggle={() => void updateCollection(r.id, { collected: !r.collected })} onLabel="Încasat" offLabel="Neîncasat" />
              <button onClick={() => void removeCollection(r.id)} aria-label="Șterge" className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })
      )}

      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center">
        <Select value={newClient} onChange={(e) => setNewClient(e.target.value)} className="sm:w-44"><option value="">Fără client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <div className="flex items-center gap-2">
          <NumInput value={Number(newAmount) || 0} onCommit={(n) => setNewAmount(n ? String(n) : "")} className="w-24 text-right" placeholder="sumă" />
          <span className="text-xs text-muted-foreground">pe</span>
          <NumInput value={Number(newDay) || 1} onCommit={(n) => setNewDay(String(Math.min(31, Math.max(1, n))))} className="w-14 text-center" />
          <Button size="sm" variant="primary" onClick={add}><Plus className="h-4 w-4" /> Adaugă</Button>
        </div>
      </div>
    </Block>
  );
}

/* ── 2 · Facturare (pregătire date - nu emite facturi fiscale) ───────────── */
const RO_MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { not_issued: "Neemisă", issued: "Emisă", collected: "Încasată" };

function Facturare({ money, clients }: { money: MoneyApi; clients: Client[] }) {
  const { invoices, setInvoice } = money;
  const { push } = useToast();
  const invoiced = clients.filter((c) => c.invoiced);
  const now = new Date();
  const monthName = RO_MONTHS[now.getMonth()];
  const monthLabel = `${monthName} ${now.getFullYear()}`;
  const byClient = useMemo(() => new Map(invoices.map((i) => [i.clientId, i] as const)), [invoices]);

  function copy(client: Client, amount: number) {
    const text = `${client.name}\n${amount} lei\n${monthLabel}\nServicii producție și editare video, luna ${monthName}`;
    void navigator.clipboard?.writeText(text);
    push({ tone: "success", title: "Date copiate", description: `${client.name} - gata de lipit în programul de facturare.` });
  }

  return (
    <Block icon={FileText} tone="text-primary" title="Facturare">
      {invoiced.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">Aici pregătești datele de facturare lunare. Bifează „Cu factură" la un client ca să apară aici.</p>
          <Link to="/clients"><Button size="sm" variant="outline">Deschide Clienți</Button></Link>
        </div>
      ) : invoiced.map((c) => {
        const inv = byClient.get(c.id);
        const amount = inv?.amount ?? c.retainer ?? 0;
        const status: InvoiceStatus = inv?.status ?? "not_issued";
        return (
          <div key={c.id} id={`fact-${c.id}`} className="flex flex-col gap-2 border-t border-border/60 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
            <ClientLink id={c.id} name={c.name} className="min-w-0 flex-1 truncate text-sm font-600" />
            <span className="text-xs text-muted-foreground sm:w-32">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <NumInput value={amount} onCommit={(n) => void setInvoice(c.id, n, status)} className="w-24 text-right" />
              <span className="text-xs text-muted-foreground">lei</span>
            </div>
            <Select value={status} onChange={(e) => void setInvoice(c.id, amount, e.target.value as InvoiceStatus)} className="sm:w-32">
              {(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((k) => <option key={k} value={k}>{INVOICE_STATUS_LABEL[k]}</option>)}
            </Select>
            <Button size="sm" variant="outline" onClick={() => copy(c, amount)}><Copy className="h-4 w-4" /> Copiază datele</Button>
          </div>
        );
      })}
      <p className="border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">Aplicația nu emite facturi fiscale - doar pregătește datele pentru programul tău de facturare.</p>
    </Block>
  );
}

/* ── 3 · Decont Yanis ────────────────────────────────────────────────────── */
function Yanis({ money }: { money: MoneyApi }) {
  const { deals, addDeal, updateDeal, removeDeal } = money;
  const { push } = useToast();
  const isMobile = useIsMobile();
  const total = (d: YanisDeal) => d.commission + d.markup;

  // Quick-add: 4 câmpuri (dată = azi, mașină, comision, vândută) - sub 10 secunde.
  const [qDate, setQDate] = useState(isoOf(new Date()));
  const [qCar, setQCar] = useState("");
  const [qComm, setQComm] = useState("");
  const [qSold, setQSold] = useState(false);
  function quickAdd() {
    void addDeal({ date: qDate, car: qCar.trim(), commission: Number(qComm) || 0, sold: qSold });
    setQCar(""); setQComm(""); setQSold(false); // păstrează data (azi) pentru adăugări rapide succesive
  }
  const now = new Date();
  const monday = isoOf(mondayOf(now));
  const sunday = isoOf(new Date(mondayOf(now).getTime() + 6 * 86400000));
  const monthPfx = isoOf(now).slice(0, 7);
  const weekSum = deals.filter((d) => d.date >= monday && d.date <= sunday).reduce((s, d) => s + total(d), 0);
  const monthSum = deals.filter((d) => d.date.slice(0, 7) === monthPfx).reduce((s, d) => s + total(d), 0);

  function copyDecont() {
    const unpaid = deals.filter((d) => !d.paid);
    if (!unpaid.length) { push({ tone: "info", title: "Nimic de trimis", description: "Toate rândurile sunt plătite." }); return; }
    const lines = unpaid.map((d) => `• ${fmtDay(d.date)} · ${d.car || "mașină"} · comision ${d.commission} + adaos ${d.markup} = ${total(d)} lei`);
    const sum = unpaid.reduce((s, d) => s + total(d), 0);
    const text = `Decont Yanis\n${lines.join("\n")}\n\nTotal neplătit: ${sum} lei`;
    void navigator.clipboard?.writeText(text);
    push({ tone: "success", title: "Decont copiat", description: `${unpaid.length} rânduri · ${sum} lei - gata de WhatsApp.` });
  }

  return (
    <Block icon={Car} tone="text-info" title="Decont Yanis"
      right={<Button size="sm" variant="outline" onClick={copyDecont}><Copy className="h-4 w-4" /> Copiază decontul</Button>}>
      <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60">
        <div className="bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Săptămâna asta</p><p className="font-display text-xl font-800">{lei(weekSum)}</p></div>
        <div className="bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Luna asta</p><p className="font-display text-xl font-800">{lei(monthSum)}</p></div>
      </div>

      {deals.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Ține evidența mașinilor lui Yanis. Adaugă primul rând din formularul de mai jos.</p>
      ) : isMobile ? (
        /* Mobile: one card per deal - no horizontal scroll. */
        deals.map((d) => (
          <div key={d.id} className="border-t border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1"><TextInput value={d.car} onCommit={(s) => void updateDeal(d.id, { car: s })} placeholder="Mașină - ex. VW Golf 2018" /></span>
              <span className="shrink-0 font-display text-base font-800">{lei(total(d))}</span>
              <button onClick={() => void removeDeal(d.id)} aria-label="Șterge" className="shrink-0 text-muted-foreground transition hover:text-danger"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-700 text-muted-foreground">Comision<NumInput value={d.commission} onCommit={(n) => void updateDeal(d.id, { commission: n })} className="mt-0.5 block w-full text-right" /></label>
              <label className="block text-[11px] font-700 text-muted-foreground">Adaos<NumInput value={d.markup} onCommit={(n) => void updateDeal(d.id, { markup: n })} className="mt-0.5 block w-full text-right" /></label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="date" value={d.date} onChange={(e) => void updateDeal(d.id, { date: e.target.value })} className="h-9 flex-1 rounded-lg border border-input bg-card px-2 text-xs ring-focus" />
              <Toggle on={d.sold} onToggle={() => void updateDeal(d.id, { sold: !d.sold })} onLabel="Vândută" offLabel="Nevândută" />
              <Toggle on={d.paid} onToggle={() => void updateDeal(d.id, { paid: !d.paid })} onLabel="Plătit" offLabel="Neplătit" />
            </div>
            <TextInput value={d.clipLink} onCommit={(s) => void updateDeal(d.id, { clipLink: s })} placeholder="Link clip (opțional)" className="mt-2 w-full" />
          </div>
        ))
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-4 py-2 text-[11px] font-700 uppercase tracking-wide text-muted-foreground">
              <span className="w-16">Dată</span><span className="flex-1">Mașină</span><span className="w-28">Link clip</span><span className="w-16 text-center">Vândută</span><span className="w-20 text-right">Comision</span><span className="w-20 text-right">Adaos</span><span className="w-16 text-center">Plătit</span><span className="w-6" />
            </div>
            {deals.map((d) => (
              <div key={d.id} className="group flex items-center gap-2 border-t border-border/60 px-4 py-2">
                <input type="date" value={d.date} onChange={(e) => void updateDeal(d.id, { date: e.target.value })} className="h-9 w-16 rounded-lg border border-input bg-card px-1 text-[11px] ring-focus" />
                <span className="flex-1"><TextInput value={d.car} onCommit={(s) => void updateDeal(d.id, { car: s })} placeholder="ex. VW Golf 2018" /></span>
                <span className="w-28"><TextInput value={d.clipLink} onCommit={(s) => void updateDeal(d.id, { clipLink: s })} placeholder="link" /></span>
                <span className="grid w-16 place-items-center"><Toggle on={d.sold} onToggle={() => void updateDeal(d.id, { sold: !d.sold })} onLabel="Da" offLabel="Nu" /></span>
                <span className="w-20"><NumInput value={d.commission} onCommit={(n) => void updateDeal(d.id, { commission: n })} className="w-full text-right" /></span>
                <span className="w-20"><NumInput value={d.markup} onCommit={(n) => void updateDeal(d.id, { markup: n })} className="w-full text-right" /></span>
                <span className="grid w-16 place-items-center"><Toggle on={d.paid} onToggle={() => void updateDeal(d.id, { paid: !d.paid })} onLabel="Da" offLabel="Nu" /></span>
                <button onClick={() => void removeDeal(d.id)} aria-label="Șterge" className="w-6 text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center">
        <input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm ring-focus sm:w-36" />
        <input value={qCar} onChange={(e) => setQCar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder="Mașină (ex. VW Golf 2018)" className="h-9 flex-1 rounded-lg border border-input bg-card px-2 text-sm ring-focus" />
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" value={qComm} onChange={(e) => setQComm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder="comision" className="h-9 w-28 rounded-lg border border-input bg-card px-2 text-right text-sm ring-focus" />
          <Toggle on={qSold} onToggle={() => setQSold((s) => !s)} onLabel="Vândută" offLabel="Nevândută" />
          <Button size="sm" variant="primary" onClick={quickAdd}><Plus className="h-4 w-4" /> Adaugă</Button>
        </div>
      </div>
    </Block>
  );
}

/* ── 4 · Găleți ──────────────────────────────────────────────────────────── */
function Buckets({ money }: { money: MoneyApi }) {
  const { settings, saveSettings, tampon, addTamponEntry, removeTamponEntry } = money;
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [dir, setDir] = useState<1 | -1>(1);
  function addEntry() {
    const n = Number(amt);
    if (!Number.isFinite(n) || n <= 0) return;
    void addTamponEntry(desc.trim() || (dir === 1 ? "Intrare" : "Ieșire"), dir * n);
    setDesc(""); setAmt("");
  }

  return (
    <Block icon={Coins} tone="text-[hsl(var(--warning))]" title="Găleți">
      <div className="grid grid-cols-1 gap-px border-t border-border/60 bg-border/60 sm:grid-cols-3">
        <BucketCard label="Personal fix" value={settings.personalFix} onCommit={(n) => void saveSettings({ personalFix: n })} />
        <BucketCard label="Operațional" value={settings.operational} onCommit={(n) => void saveSettings({ operational: n })} />
        <BucketCard label="Tampon" value={settings.tampon} onCommit={(n) => void saveSettings({ tampon: n })} />
      </div>

      {/* Tampon history */}
      <div className="border-t border-border/60 px-4 py-3">
        <p className="mb-2 text-xs font-700 text-muted-foreground">Istoric Tampon</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Toggle on={dir === 1} onToggle={() => setDir((d) => (d === 1 ? -1 : 1))} onLabel="Intrare" offLabel="Ieșire" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descriere (ex. plată geomar)" className="h-9 flex-1 rounded-lg border border-input bg-card px-2 text-sm ring-focus" />
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }} placeholder="sumă" className="h-9 w-24 rounded-lg border border-input bg-card px-2 text-right text-sm ring-focus" />
            <Button size="sm" variant="primary" onClick={addEntry}><Plus className="h-4 w-4" /> Adaugă</Button>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {tampon.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Nicio mișcare încă.</p>
          ) : tampon.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">{fmtDay(t.date)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{t.description}</span>
              <span className={cn("shrink-0 text-sm font-700", t.amount >= 0 ? "text-success" : "text-danger")}>{t.amount >= 0 ? "+" : "−"}{lei(Math.abs(t.amount))}</span>
              <button onClick={() => void removeTamponEntry(t.id)} aria-label="Șterge" className="shrink-0 text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    </Block>
  );
}
function BucketCard({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <NumInput value={value} onCommit={onCommit} className="w-28 font-display text-xl font-800" />
        <span className="text-sm text-muted-foreground">lei</span>
      </div>
    </div>
  );
}

/* ── 5 · Runway ──────────────────────────────────────────────────────────── */
function Runway({ money }: { money: MoneyApi }) {
  const { settings, saveSettings } = money;
  const burn = settings.personalFix + settings.operationalBurn;
  const months = burn > 0 ? settings.tampon / burn : 0;
  const monthsLabel = burn > 0 ? months.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "fără date";
  const tone = burn <= 0 ? "text-muted-foreground" : months >= 3 ? "text-success" : months >= 1.5 ? "text-[hsl(var(--warning))]" : "text-danger";

  return (
    <Block icon={ShieldCheck} tone="text-success" title="Runway">
      <div className="grid grid-cols-1 gap-4 border-t border-border/60 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className={cn("font-display text-4xl font-800", tone)}>{monthsLabel} <span className="text-2xl">luni de siguranță</span></p>
          <p className="mt-1 text-sm text-muted-foreground">Tampon {lei(settings.tampon)} ÷ burn lunar {lei(burn)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-1 text-xs font-700 text-muted-foreground">Cheltuieli operaționale / lună</p>
          <div className="flex items-center gap-1">
            <NumInput value={settings.operationalBurn} onCommit={(n) => void saveSettings({ operationalBurn: n })} className="w-28 text-right" />
            <span className="text-sm text-muted-foreground">lei</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Burn = Personal fix ({lei(settings.personalFix)}) + operațional</p>
        </div>
      </div>
    </Block>
  );
}
