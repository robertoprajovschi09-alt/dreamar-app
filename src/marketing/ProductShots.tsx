import { Bolt, Building2, CalendarDays, Check, CheckSquare, ChevronRight, Clock, FileEdit, Pencil, Send, ShieldCheck, Target, TrendingUp, Users, Wallet } from "lucide-react";

/*
 * Static product renditions for the marketing site. These mirror the real app
 * (same copy, same layout logic) but are hand-built so they stay crisp at any
 * size, follow the visitor's light/dark theme, and never ship stale pixels.
 * No gradients, hairline borders, one accent.
 */

const frame = "pointer-events-none select-none overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft";

/* ── The app, opened on Astăzi (hero) ────────────────────────────────────── */
export function ShotApp() {
  return (
    <div className={frame} aria-hidden="true">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          <i className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          <i className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
        </span>
        <span className="mx-auto rounded-md bg-muted px-3 py-1 text-[10px] font-600 text-muted-foreground">app.dreamar.ro/astazi</span>
      </div>
      <div className="flex">
        {/* sidebar */}
        <div className="hidden w-44 shrink-0 border-r border-border p-3 sm:block">
          <p className="px-2 pb-3 font-display text-[13px] font-800 tracking-tight">drea<span className="text-primary">.mar</span></p>
          <div className="space-y-0.5 text-[11px] font-600">
            <SideItem icon={Target} label="Astăzi" active />
            <SideItem icon={Users} label="Clienți" badge="9" />
            <SideItem icon={CalendarDays} label="Conținut" />
            <SideItem icon={ShieldCheck} label="Aprobări" badge="3" />
            <SideItem icon={Building2} label="Agenție" />
          </div>
        </div>
        {/* main */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <p className="font-display text-base font-800">Bună dimineața, Andrei</p>
          <p className="text-[11px] text-muted-foreground">Marți, 2 iulie</p>
          <div className="mt-3 rounded-xl border border-border p-3">
            <p className="mb-2 text-[11px] font-800">Focus de azi</p>
            <div className="space-y-1.5">
              <FeedLine tone="danger" icon={FileEdit} text="Verde Bistro a cerut o schimbare" action="Retrimite" />
              <FeedLine tone="primary" icon={Send} text="2 postări gata de trimis spre aprobare" action="Trimite" />
              <FeedLine tone="warning" icon={Wallet} text="IronPeak — campania a atins 92% din buget" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Programate săptămâna asta" value="14" />
            <MiniStat label="Cheltuieli ads · ROAS" value="€9.6k · 9.5×" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SideItem({ icon: Icon, label, active, badge }: { icon: typeof Target; label: string; active?: boolean; badge?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1">{label}</span>
      {badge && <span className="rounded-full bg-muted px-1.5 text-[9px] font-700">{badge}</span>}
    </div>
  );
}

function FeedLine({ tone, icon: Icon, text, action }: { tone: "danger" | "primary" | "warning"; icon: typeof Send; text: string; action?: string }) {
  const dot = { danger: "bg-danger", primary: "bg-primary", warning: "bg-[hsl(var(--warning))]" }[tone];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 px-2.5 py-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-600">{text}</span>
      {action ? (
        <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-[9px] font-700 text-primary-foreground">{action}</span>
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <p className="font-display text-sm font-800">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ── The client report tab (Raport) ──────────────────────────────────────── */
export function ShotRaport() {
  const stats: [string, string, typeof Users][] = [
    ["Lead-uri", "47", Users],
    ["Venit estimat", "€8.400", TrendingUp],
    ["Investit în ads", "€1.200", Wallet],
    ["ROI", "7×", Bolt],
  ];
  return (
    <div className={frame} aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-800">Raport · iunie 2026</p>
          <p className="text-[10px] text-muted-foreground">Cabinet Smile · exact ce vede clientul</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-700 text-primary-foreground"><Send className="h-3 w-3" /> Trimite clientului</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {stats.map(([l, v, Icon]) => (
          <div key={l} className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" />{l}</p>
            <p className="mt-0.5 font-display text-lg font-800">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 px-4 pb-4">
        <div className="rounded-xl border border-border p-3">
          <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Ce s-a întâmplat</p>
          <p className="mt-1 text-[11px] leading-relaxed">Filmările despre albire au adus 9 programări noi. Reclama de pe Instagram a ajuns la mai mulți oameni decât luna trecută.</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Ce urmează</p>
          <p className="mt-1 text-[11px] leading-relaxed">Pregătim 4 postări noi și relansăm reclama către cei care nu au răspuns încă.</p>
        </div>
      </div>
    </div>
  );
}

/* ── The approval loop, told as a 30-second timeline ─────────────────────── */
export function ShotApproval() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-800">Aprobare — Verde Bistro</p>
        <p className="text-[10px] text-muted-foreground">Scenetă cu meniul · Instagram</p>
      </div>
      <div className="p-4">
        {/* what the client sees */}
        <div className="rounded-xl border border-border p-3">
          <p className="text-[11px] font-600">Echipa ta a pregătit asta pentru tine. E bine așa?</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <span className="flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-[10px] font-700 text-muted-foreground"><Pencil className="h-3 w-3" /> Vreau o schimbare</span>
            <span className="flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-[10px] font-700 text-primary-foreground"><Check className="h-3 w-3" /> Aprob</span>
          </div>
        </div>
        {/* the timeline */}
        <div className="mt-4 space-y-2 border-l border-border pl-4 text-[11px]">
          <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3 w-3" /> 14:02 — Trimis din calendar</p>
          <p className="flex items-center gap-2 font-700 text-success"><CheckSquare className="h-3.5 w-3.5" /> 14:03 — Aprobat de client</p>
        </div>
      </div>
    </div>
  );
}

/* ── The client portal, on a phone ───────────────────────────────────────── */
export function ShotPhone() {
  return (
    <div className="pointer-events-none mx-auto w-[270px] select-none rounded-[2.2rem] border border-border bg-card p-2.5 shadow-soft" aria-hidden="true">
      <div className="overflow-hidden rounded-[1.7rem] border border-border/60">
        <div className="px-4 pb-4 pt-5">
          <p className="text-[10px] text-muted-foreground">Cabinet Smile · cu agenția ta</p>
          <p className="font-display text-sm font-800">Bună, Andrei</p>
          <div className="mt-3 rounded-2xl bg-success/12 p-3.5">
            <p className="flex items-center gap-1 text-[10px] font-700 text-success"><TrendingUp className="h-3 w-3" /> Luna aceasta</p>
            <p className="mt-1 font-display text-[15px] font-800 leading-snug">47 de persoane noi te-au contactat</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Cu 12 mai mulți decât luna trecută. Afacerea ta crește.</p>
          </div>
          <div className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-[10px] font-600 text-primary">
            La fiecare 1 € investit, ai primit ~7 € înapoi.
          </div>
          <div className="mt-2 rounded-xl border border-border p-3">
            <p className="text-[10px] font-700">O postare așteaptă aprobarea ta</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <span className="rounded-lg border border-border py-1.5 text-center text-[9px] font-700 text-muted-foreground">Vreau o schimbare</span>
              <span className="rounded-lg bg-primary py-1.5 text-center text-[9px] font-700 text-primary-foreground">Aprob</span>
            </div>
          </div>
        </div>
        <div className="flex justify-around border-t border-border px-2 py-2 text-muted-foreground">
          {["Acasă", "Aprobări", "Mesaje", "Rapoarte", "Cont"].map((t, i) => (
            <span key={t} className={`text-[8px] font-600 ${i === 0 ? "text-primary" : ""}`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
