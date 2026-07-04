import { useEffect, useState } from "react";
import { Panel, SectionCard, Button, Badge, Input, Select } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Modal } from "@/components/overlay";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { nicheSpec, nicheItem, NICHE_ICONS, type NicheKey, type MetricField, type ItemField, type NicheItemConfig } from "@/lib/niches";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { id: string; name: string; attributes: Record<string, any> };
type Impact = Partial<Record<MetricField, number>>;
type Post = { id: string; title: string; platform: string | null; status: string; date: string };
const firstOfMonthISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const ALL_FIELDS: MetricField[] = ["calls_received", "relevant_dms", "bookings", "appointments", "orders", "sales", "viewings", "contracts", "revenue_estimate"];

export default function NicheOverview({ clientId, niche }: { clientId: string; niche: string }) {
  const { push } = useToast();
  const spec = nicheSpec(niche);
  const cfg = nicheItem(niche);
  const Icon = NICHE_ICONS[(niche as NicheKey)] ?? NICHE_ICONS.custom;

  const [items, setItems] = useState<Item[]>([]);
  const [impact, setImpact] = useState<Impact>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | "new" | null>(null);

  async function load() {
    if (!supabase || !clientId) return;
    setLoading(true);
    const month = firstOfMonthISO();
    const [cl, it, im, ps] = await Promise.all([
      supabase.from("clients").select("agency_id").eq("id", clientId).maybeSingle(),
      supabase.from("niche_items").select("id, name, attributes").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase.from("business_impact_entries").select("source, calls_received, relevant_dms, bookings, appointments, orders, sales, viewings, contracts, revenue_estimate").eq("client_id", clientId).eq("period_month", month),
      supabase.from("content_posts").select("id, title, platform, status, scheduled_date, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (im.data ?? []) as any[];
    const cR = rows.find((r) => r.source === "client");
    const aR = rows.find((r) => r.source === "agency");
    const merged: Impact = {};
    for (const f of ALL_FIELDS) merged[f] = Number((cR?.[f] ?? aR?.[f]) ?? 0);
    setAgencyId(cl.data?.agency_id ?? "");
    setItems((it.data ?? []) as Item[]);
    setImpact(merged);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPosts((ps.data ?? []).map((p: any) => ({ id: p.id, title: p.title, platform: p.platform, status: p.status, date: p.scheduled_date || p.created_at })));
    setLoading(false);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  async function remove(id: string) {
    setItems((p) => p.filter((x) => x.id !== id));
    if (supabase) {
      const { error } = await supabase.from("niche_items").delete().eq("id", id);
      if (error) { push({ tone: "danger", title: "Nu s-a putut șterge", description: error.message }); void load(); }
    }
  }

  if (loading) return <Panel className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></Panel>;

  const fmt = (field: MetricField, v: number) => (field === "revenue_estimate" ? formatCurrency(v) : formatNumber(v));

  return (
    <div className="space-y-4">
      {/* Niche KPI strip — this month's outcomes (client self-report or agency-entered) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {spec.portalKpis.map((k) => (
          <Panel key={k.field} className="p-5">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-800">{fmt(k.field, impact[k.field] ?? 0)}</p>
          </Panel>
        ))}
      </div>

      {/* Niche items */}
      <SectionCard title={cfg.plural} icon={Icon} action={<Button variant="primary" size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Adaugă {cfg.singular.toLowerCase()}</Button>}>
        {items.length ? (
          <Table>
            <THead>
              <TH>{cfg.nameLabel}</TH>
              {cfg.fields.map((f) => <TH key={f.key}>{f.label}</TH>)}
              <TH></TH>
            </THead>
            <tbody>
              {items.map((it) => (
                <TR key={it.id} className="group">
                  <TD className="font-600">{it.name}</TD>
                  {cfg.fields.map((f) => <TD key={f.key}>{renderVal(f, it.attributes?.[f.key])}</TD>)}
                  <TD className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => setEditing(it)} className="grid h-7 w-7 place-items-center rounded hover:bg-muted" title="Editează"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(it.id)} className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-danger" title="Șterge"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm font-600">Încă niciun {cfg.singular.toLowerCase()}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Adaugă {cfg.plural.toLowerCase()} pe care le promovezi pentru acest client, ca echipa și rapoartele să le aibă la îndemână.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Adaugă {cfg.singular.toLowerCase()}</Button>
          </div>
        )}
      </SectionCard>

      {/* Recent content */}
      <SectionCard title="Conținut recent" subtitle={posts.length ? `Cele mai recente ${posts.length} postări pentru acest client` : "Postările programate și publicate apar aici"}>
        {posts.length ? (
          <div className="divide-y divide-border">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 truncate text-sm font-600">{p.title}</span>
                {p.platform && <Badge tone="neutral">{p.platform}</Badge>}
                <Badge tone={p.status === "published" ? "success" : p.status === "approved" ? "info" : "neutral"}>{p.status}</Badge>
              </div>
            ))}
          </div>
        ) : <p className="py-6 text-center text-sm text-muted-foreground">Încă niciun conținut — creează postări în Calendarul de conținut.</p>}
      </SectionCard>

      {editing !== null && (
        <ItemModal cfg={cfg} clientId={clientId} niche={niche} agencyId={agencyId} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderVal(f: ItemField, v: any) {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (f.type === "money") return formatCurrency(Number(v));
  if (f.type === "select") return <Badge tone="neutral">{String(v)}</Badge>;
  return String(v);
}

function ItemModal({ cfg, clientId, niche, agencyId, item, onClose, onSaved }: {
  cfg: NicheItemConfig; clientId: string; niche: string; agencyId: string; item: Item | null; onClose: () => void; onSaved: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const a: Record<string, string> = {};
    cfg.fields.forEach((f) => { a[f.key] = item?.attributes?.[f.key] != null ? String(item.attributes[f.key]) : ""; });
    return a;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {};
    cfg.fields.forEach((f) => {
      const v = attrs[f.key];
      if (v !== "" && v != null) attributes[f.key] = f.type === "money" || f.type === "number" ? Number(v) : v;
    });
    if (!supabase) { push({ tone: "info", title: "Mod demo", description: "Salvarea este disponibilă într-un spațiu de lucru activ." }); setSaving(false); return; }
    const { error } = item
      ? await supabase.from("niche_items").update({ name: name.trim(), attributes }).eq("id", item.id)
      : await supabase.from("niche_items").insert({ agency_id: agencyId, client_id: clientId, niche, item_type: cfg.itemType, name: name.trim(), attributes });
    setSaving(false);
    if (error) { push({ tone: "danger", title: "Nu s-a putut salva", description: error.message }); return; }
    push({ tone: "success", title: item ? `${cfg.singular} actualizat` : `${cfg.singular} adăugat`, description: name.trim() });
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={item ? `Editează ${cfg.singular.toLowerCase()}` : `Adaugă ${cfg.singular.toLowerCase()}`} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={saving || !name.trim()} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvează</Button></>}>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-700 text-muted-foreground">{cfg.nameLabel}</p>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={cfg.namePlaceholder} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cfg.fields.map((f) => (
            <div key={f.key}>
              <p className="mb-1.5 text-xs font-700 text-muted-foreground">{f.label}{f.type === "money" ? " (lei)" : ""}</p>
              {f.type === "select" ? (
                <Select value={attrs[f.key]} onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              ) : (
                <Input type={f.type === "money" || f.type === "number" ? "number" : "text"} value={attrs[f.key]} onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))} placeholder={f.type === "money" ? "0" : ""} />
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
