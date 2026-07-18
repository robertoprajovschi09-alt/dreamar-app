import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard, Input, Button, Badge } from "@/components/ui";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/lib/workspace";
import { useLibrary } from "@/lib/library";
import { useClientCounters } from "@/lib/clientcounters";
import { useWeeklyMetrics } from "@/lib/weeklyMetrics";
import { baselineFor } from "@/lib/niches";
import { formatNumber } from "@/lib/utils";
import { Check, Clapperboard, Copy, Loader2, Save, TrendingDown } from "lucide-react";

/*
 * Client measurement cards for the Rezultate tab: baseline (week 0), the weekly
 * rhythm, and the computed monthly report with decision hints. All numeric,
 * agency-side (client_counters, client_weekly_metrics, business_impact_entries).
 */

const DASH = "—";
const parseNum = (s: string): number | null => { const t = s.trim(); if (t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const numInput = "h-12 text-right"; // 48px, comfortably above the 44px tap target
const monthLabelOf = (mk: string) => new Date(mk + "-01T00:00:00").toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
const prevMonthKey = (mk: string) => { const [y, m] = mk.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

/* ─────────────────────────── Baseline (week 0) ──────────────────────────── */
export function BaselineCard({ clientId, niche }: { clientId: string; niche: string }) {
  const { values, setValue, loading } = useClientCounters(clientId);
  const questions = baselineFor(niche);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Seed the inputs from saved values once the counters load (and on client
  // switch). Not keyed on `values` so later edits are not clobbered.
  useEffect(() => {
    if (loading) return;
    const d: Record<string, string> = {};
    questions.forEach((q) => { const k = q.counterKey!; if (values[k] != null) d[k] = String(values[k]); });
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clientId]);

  const allEmpty = questions.every((q) => !(values[q.counterKey!] > 0));

  const commit = (q: { counterKey?: string; label: string }, raw: string) => {
    const n = parseNum(raw);
    if (n == null) return;
    if ((values[q.counterKey!] ?? null) === Math.max(0, Math.round(n))) return; // unchanged
    setValue(q.counterKey!, q.label, n);
  };

  return (
    <SectionCard title="Baseline (săptămâna 0)" subtitle="Cifrele de pornire, ca să măsurăm creșterea lună de lună">
      {allEmpty && (
        <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Completează cifrele de pornire ca să măsurăm creșterea lună de lună.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {questions.map((q) => (
          <label key={q.id} className="block">
            <span className="text-xs font-700 text-muted-foreground">{q.label}</span>
            {q.help && <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{q.help}</span>}
            <Input
              type="number" inputMode="numeric" min={0} className={`${numInput} mt-1.5 w-full`}
              placeholder="—"
              value={draft[q.counterKey!] ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, [q.counterKey!]: e.target.value }))}
              onBlur={(e) => commit(q, e.target.value)}
            />
          </label>
        ))}
      </div>
      {questions.some((q) => q.counterKey === "baseline_avg_basket_eur") && (
        <p className="mt-2 text-[11px] text-muted-foreground">Valoarea medie a rezervării se salvează ca număr întreg.</p>
      )}
    </SectionCard>
  );
}

/* ──────────────────────────── Weekly rhythm ─────────────────────────────── */
export function WeeklyCard({ clientId }: { clientId: string }) {
  const { current, previous, save, loading } = useWeeklyMetrics(clientId);
  const [f, setF] = useState({ bio: "", wa: "", price: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loading) return;
    setF({
      bio: current.bioClicks ? String(current.bioClicks) : "",
      wa: current.whatsappNew ? String(current.whatsappNew) : "",
      price: current.priceComments ? String(current.priceComments) : "",
      notes: current.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clientId, current.weekStart]);

  async function onSave() {
    if (busy) return;
    setBusy(true); setSaved(false);
    const res = await save({ bioClicks: Number(f.bio) || 0, whatsappNew: Number(f.wa) || 0, priceComments: Number(f.price) || 0, notes: f.notes });
    setBusy(false);
    if (!res.error) { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }
  }

  const bigField = (label: string, key: "bio" | "wa" | "price") => (
    <label className="block">
      <span className="text-xs font-700 text-muted-foreground">{label}</span>
      <Input type="number" inputMode="numeric" min={0} className={`${numInput} mt-1.5 w-full`} placeholder="0"
        value={f[key]} onChange={(e) => { setSaved(false); setF((p) => ({ ...p, [key]: e.target.value })); }} />
    </label>
  );

  return (
    <SectionCard title="Săptămâna asta" subtitle="Semnalele care spun dacă social-ul aduce oameni">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {bigField("Click-uri pe link-ul din bio", "bio")}
        {bigField("Conversații WhatsApp noi", "wa")}
        {bigField("Comentarii despre preț / disponibilitate", "price")}
      </div>
      <div className="mt-3">
        <span className="text-xs font-700 text-muted-foreground">Notă (opțional)</span>
        <Input className="mt-1.5" placeholder="ex. campanie de weekend, întrebări repetate despre parcare"
          value={f.notes} onChange={(e) => { setSaved(false); setF((p) => ({ ...p, notes: e.target.value })); }} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" className="min-h-[44px]" disabled={busy} onClick={onSave}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Salvat" : "Salvează"}
        </Button>
      </div>
      {previous && (
        <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Săptămâna trecută: {previous.bioClicks} click-uri · {previous.whatsappNew} WhatsApp · {previous.priceComments} întrebări de preț
        </p>
      )}
    </SectionCard>
  );
}

/* ─────────────────────────── Monthly report ─────────────────────────────── */
type BiRow = { bookings: number | null; revenue: number | null; reviewsGoogle: number | null; reviewsTripadvisor: number | null; clubMembers: number | null; leadsClosed: number | null };
const emptyBi = (): BiRow => ({ bookings: null, revenue: null, reviewsGoogle: null, reviewsTripadvisor: null, clubMembers: null, leadsClosed: null });

export function MonthlyInsights({ clientId, clientName, niche, monthKey }: { clientId: string; clientName: string; niche: string; monthKey: string }) {
  const { push } = useToast();
  const { currentAgency, live } = useWorkspace();
  const { videos } = useLibrary();
  const { values: baseline } = useClientCounters(clientId);
  const { weeksInMonth } = useWeeklyMetrics(clientId);

  const [cur, setCur] = useState<BiRow>(emptyBi());
  const [prev, setPrev] = useState<BiRow | null>(null);
  const [form, setForm] = useState({ reviewsGoogle: "", reviewsTripadvisor: "", clubMembers: "", leadsClosed: "" });
  const [saving, setSaving] = useState(false);

  const curPeriod = `${monthKey}-01`;
  const prevPeriod = `${prevMonthKey(monthKey)}-01`;

  useEffect(() => {
    if (!live || !supabase || !clientId) { setCur(emptyBi()); setPrev(null); setForm({ reviewsGoogle: "", reviewsTripadvisor: "", clubMembers: "", leadsClosed: "" }); return; }
    let active = true;
    (async () => {
      const { data } = await supabase!
        .from("business_impact_entries")
        .select("period_month, bookings, revenue_estimate, reviews_google, reviews_tripadvisor, club_members, leads_closed")
        .eq("client_id", clientId).eq("source", "agency").in("period_month", [curPeriod, prevPeriod]);
      if (!active) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toRow = (e: any): BiRow => ({ bookings: e.bookings ?? null, revenue: e.revenue_estimate ?? null, reviewsGoogle: e.reviews_google ?? null, reviewsTripadvisor: e.reviews_tripadvisor ?? null, clubMembers: e.club_members ?? null, leadsClosed: e.leads_closed ?? null });
      const rows = data ?? [];
      const c = rows.find((r) => String(r.period_month).slice(0, 10) === curPeriod);
      const p = rows.find((r) => String(r.period_month).slice(0, 10) === prevPeriod);
      const cRow = c ? toRow(c) : emptyBi();
      setCur(cRow);
      setPrev(p ? toRow(p) : null);
      setForm({
        reviewsGoogle: cRow.reviewsGoogle != null ? String(cRow.reviewsGoogle) : "",
        reviewsTripadvisor: cRow.reviewsTripadvisor != null ? String(cRow.reviewsTripadvisor) : "",
        clubMembers: cRow.clubMembers != null ? String(cRow.clubMembers) : "",
        leadsClosed: cRow.leadsClosed != null ? String(cRow.leadsClosed) : "",
      });
    })();
    return () => { active = false; };
  }, [live, clientId, curPeriod, prevPeriod]);

  async function saveFields() {
    if (saving) return;
    setSaving(true);
    const g = parseNum(form.reviewsGoogle), t = parseNum(form.reviewsTripadvisor), m = parseNum(form.clubMembers), l = parseNum(form.leadsClosed);
    if (live && supabase && clientId) {
      const { error } = await supabase.from("business_impact_entries").upsert(
        { agency_id: currentAgency.id, client_id: clientId, period_month: curPeriod, source: "agency", reviews_google: g, reviews_tripadvisor: t, club_members: m, leads_closed: l },
        { onConflict: "client_id,period_month,source" });
      if (error) { setSaving(false); push({ tone: "danger", title: "Nu s-a putut salva", description: error.message }); return; }
    }
    setCur((c) => ({ ...c, reviewsGoogle: g, reviewsTripadvisor: t, clubMembers: m, leadsClosed: l }));
    setSaving(false);
    push({ tone: "success", title: "Salvat", description: monthLabelOf(monthKey) });
  }

  // Videos for this client + month.
  const monthVideos = useMemo(
    () => videos.filter((v) => v.client === clientName && (v.date || "").slice(0, 7) === monthKey).slice().sort((a, b) => b.views - a.views),
    [videos, clientName, monthKey]);
  const totalViews = monthVideos.reduce((s, v) => s + v.views, 0);
  const avgRetention = monthVideos.length ? monthVideos.reduce((s, v) => s + v.retention3s, 0) / monthVideos.length : 0;
  const median = useMemo(() => {
    if (!monthVideos.length) return 0;
    const s = monthVideos.map((v) => v.views).sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }, [monthVideos]);

  const bDirect = baseline["baseline_bookings_direct"] ?? null;
  const bBasket = baseline["baseline_avg_basket_eur"] ?? null;
  const bRevG = baseline["baseline_reviews_google"] ?? null;
  const bRevT = baseline["baseline_reviews_tripadvisor"] ?? null;
  const bClub = baseline["baseline_club_members"] ?? null;

  // 1) bookings vs baseline direct
  const bkPct = cur.bookings != null && bDirect != null && bDirect > 0 ? Math.round(((cur.bookings - bDirect) / bDirect) * 100) : null;
  // 2) estimated saved OTA commission (EUR)
  const otaEur = cur.bookings != null && bDirect != null && bBasket != null && bBasket > 0
    ? Math.round(Math.max(0, cur.bookings - bDirect) * bBasket * 0.15) : null;
  // 3) new reviews = (google+trip now) − (prev entry, else baseline)
  const reviewsNow = (cur.reviewsGoogle != null || cur.reviewsTripadvisor != null) ? (cur.reviewsGoogle ?? 0) + (cur.reviewsTripadvisor ?? 0) : null;
  const reviewsBase = prev && (prev.reviewsGoogle != null || prev.reviewsTripadvisor != null)
    ? (prev.reviewsGoogle ?? 0) + (prev.reviewsTripadvisor ?? 0)
    : (bRevG != null || bRevT != null) ? (bRevG ?? 0) + (bRevT ?? 0) : null;
  const newReviews = reviewsNow != null && reviewsBase != null ? reviewsNow - reviewsBase : null;
  // 4) new club members
  const clubBase = prev && prev.clubMembers != null ? prev.clubMembers : bClub;
  const newMembers = cur.clubMembers != null && clubBase != null ? cur.clubMembers - clubBase : null;

  // Decision hints
  const bioThis = weeksInMonth(monthKey).reduce((s, w) => s + w.bioClicks, 0);
  const bioPrev = weeksInMonth(prevMonthKey(monthKey)).reduce((s, w) => s + w.bioClicks, 0);
  const hintCta = monthVideos.length > 0 && avgRetention > 30 && bioThis === 0;
  const hintSite = bioThis > bioPrev && cur.bookings != null && prev?.bookings != null && cur.bookings <= prev.bookings;

  function copyReport() {
    const L = (v: number | null, suffix = "") => (v == null ? DASH : `${formatNumber(v)}${suffix}`);
    const lines = [
      `Raport ${clientName} · ${monthLabelOf(monthKey)}`,
      "",
      `Rezervări directe: ${cur.bookings == null ? DASH : formatNumber(cur.bookings)}${bkPct != null ? ` (${bkPct >= 0 ? "+" : ""}${bkPct}% față de baseline)` : ""}`,
      `Comision OTA salvat estimat: ${otaEur == null ? DASH : `~${formatNumber(otaEur)} EUR`}`,
      `Recenzii noi: ${L(newReviews)}`,
      `Membri noi în club: ${L(newMembers)}`,
      `Views totale: ${formatNumber(totalViews)}` + (monthVideos.length ? `\nTop clipuri:` : ""),
      ...monthVideos.slice(0, 3).map((v, i) => `  ${i + 1}. ${v.hook} — ${formatNumber(v.views)} views, retenție ${v.retention3s}%`),
      `Lead-uri închise: ${L(cur.leadsClosed)}`,
    ];
    void navigator.clipboard?.writeText(lines.join("\n"));
    push({ tone: "success", title: "Raport copiat", description: "Gata de trimis pe WhatsApp." });
  }

  const Metric = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: boolean }) => (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] font-700 uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 font-display text-xl font-800">{children}</div>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">completează baseline-ul</p>}
    </div>
  );

  return (
    <SectionCard title="Luna în cifre" subtitle={`Calculat din datele lunii · ${monthLabelOf(monthKey)}`}
      action={<Button variant="outline" onClick={copyReport}><Copy className="h-4 w-4" /> Copiază raportul</Button>}>
      {/* Computed, read-only */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Rezervări directe" hint={cur.bookings != null && bkPct == null}>
          {cur.bookings == null ? DASH : (
            <span className="flex items-center gap-2">{formatNumber(cur.bookings)}
              {bkPct != null && bkPct >= 20 && <Badge tone="success">+{bkPct}% peste baseline</Badge>}
              {bkPct != null && bkPct < 20 && <span className="text-xs font-600 text-muted-foreground">{bkPct >= 0 ? "+" : ""}{bkPct}%</span>}
            </span>
          )}
        </Metric>
        <Metric label="Comision OTA salvat" hint={otaEur == null}>{otaEur == null ? DASH : `~${formatNumber(otaEur)} €`}</Metric>
        <Metric label="Recenzii noi" hint={newReviews == null}>{newReviews == null ? DASH : formatNumber(newReviews)}</Metric>
        <Metric label="Membri noi în club" hint={newMembers == null}>{newMembers == null ? DASH : formatNumber(newMembers)}</Metric>
        <Metric label="Views totale">{formatNumber(totalViews)}</Metric>
        <Metric label="Lead-uri închise" hint={cur.leadsClosed == null}>{cur.leadsClosed == null ? DASH : formatNumber(cur.leadsClosed)}</Metric>
      </div>
      {otaEur != null && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          formula: max(0, rezervări − {formatNumber(bDirect ?? 0)}) × {formatNumber(bBasket ?? 0)} € × 15%
        </p>
      )}

      {/* Decision hints */}
      {(hintCta || hintSite) && (
        <div className="mt-3 space-y-2">
          {hintCta && <p className="rounded-lg bg-warning/15 px-3 py-2 text-xs font-600 text-[hsl(var(--warning))]">Retenție bună, zero click-uri: problema e CTA-ul.</p>}
          {hintSite && <p className="rounded-lg bg-info/12 px-3 py-2 text-xs font-600 text-info">Click-urile cresc, rezervările nu: verifică site-ul și prețul afișat.</p>}
        </div>
      )}

      {/* This month's clips, weak ones flagged */}
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-700 uppercase tracking-wide text-muted-foreground"><Clapperboard className="h-3.5 w-3.5" /> Clipurile lunii</p>
        {monthVideos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Niciun video înregistrat pentru luna asta.</p>
        ) : (
          <ul className="space-y-1.5">
            {monthVideos.map((v) => {
              const weak = median > 0 && v.views < median * 0.5;
              return (
                <li key={v.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{v.hook}</span>
                  {weak && <Badge tone="warning" className="shrink-0"><TrendingDown className="mr-1 h-3 w-3" /> sub media contului</Badge>}
                  <span className="shrink-0 text-xs text-muted-foreground">{formatNumber(v.views)} views · {v.retention3s}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* The 4 up-to-date figures that feed the numbers above */}
      <div className="mt-4 border-t border-border/60 pt-4">
        <p className="mb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Cifre la zi (luna asta)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField label="Recenzii Google" value={form.reviewsGoogle} onChange={(v) => setForm((p) => ({ ...p, reviewsGoogle: v }))} />
          <FormField label="Recenzii Tripadvisor" value={form.reviewsTripadvisor} onChange={(v) => setForm((p) => ({ ...p, reviewsTripadvisor: v }))} />
          <FormField label="Membri în club" value={form.clubMembers} onChange={(v) => setForm((p) => ({ ...p, clubMembers: v }))} />
          <FormField label="Lead-uri închise" value={form.leadsClosed} onChange={(v) => setForm((p) => ({ ...p, leadsClosed: v }))} />
        </div>
        <Button variant="primary" className="mt-3 min-h-[44px]" disabled={saving} onClick={saveFields}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvează cifrele lunii
        </Button>
      </div>
    </SectionCard>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-700 text-muted-foreground">{label}</span>
      <Input type="number" inputMode="numeric" min={0} className={`${numInput} mt-1.5 w-full`} placeholder="—" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
