import { Link } from "react-router-dom";
import { DashboardPreview } from "./DashboardPreview";
import { nicheLabels, plans } from "@/data/sample";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";

const modules = [
  { icon: LayoutDashboard, title: "Tablou de bord agenție", desc: "Clienți activi, aprobări în așteptare, videoclipuri de top, alerte AI și un scor de sănătate al portofoliului — dintr-o privire." },
  { icon: Users, title: "Gestionare clienți", desc: "Fiecare client cu nișă, obiective, vocea brandului, abonament, documente și un tablou de bord personalizat." },
  { icon: CalendarDays, title: "Calendar de conținut", desc: "Planifică, mută prin tragere și urmărește fiecare postare, de la idee la analiză, pentru toți clienții și pe toate platformele." },
  { icon: Video, title: "Performanță video", desc: "24 de metrici per videoclip, scoruri AI și recomandări de repetare, îmbunătățire sau oprire." },
  { icon: TrendingUp, title: "Impact în afacere", desc: "Urmărește rezultatele reale — apeluri, rezervări, vânzări și venituri — nu doar like-uri." },
  { icon: Sparkles, title: "Cameră de strategie AI", desc: "Întreabă-l pe Claude ce să creezi în continuare, pornind de la videoclipurile, metricile și feedbackul fiecărui client." },
  { icon: FileText, title: "Rapoarte lunare AI", desc: "Rapoarte premium, editabile, white-label, pe care clienții tăi chiar vor să le citească. Exportă în PDF." },
  { icon: ShieldCheck, title: "Flux de aprobare", desc: "Clienții aprobă scenarii, videoclipuri și rapoarte în propriul portal. Gata cu schimburile interminabile de emailuri." },
];

const steps = [
  { n: "1", title: "Adaugă-ți clienții", desc: "Alege o nișă, iar drea.mar adaptează automat tabloul de bord, metricile și secțiunile raportului." },
  { n: "2", title: "Urmărește tot", desc: "Înregistrează videoclipuri, conținut, impact în afacere și feedback într-un singur spațiu de lucru, izolat pentru fiecare agenție." },
  { n: "3", title: "Lasă AI-ul să facă munca grea", desc: "Generează strategie, detectează hook-urile câștigătoare, evaluează sănătatea și livrează rapoarte lunare în câteva minute." },
];

const testimonials = [
  { quote: "Am înlocuit cinci instrumente cu drea.mar. Rapoartele lunare au trecut de la o zi întreagă la zece minute.", name: "Lena Wolf", role: "Fondator, Peak Studio" },
  { quote: "Tablourile de bord pe nișă vorbesc în sfârșit limba clienților noștri. Retenția a crescut peste tot.", name: "Robert Casco", role: "Proprietar, Nova Creative" },
  { quote: "Camera de strategie AI e ca și cum ai avea un strateg senior pe fiecare cont.", name: "Sara K.", role: "Director, Halo Media" },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10%] h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-600/25 via-indigo-500/15 to-transparent blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-600 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Sistemul de operare pentru agențiile de marketing
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-800 leading-[1.05] tracking-tight sm:text-6xl">
            Conduce-ți întreaga agenție dintr-un{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 bg-clip-text text-transparent">singur spațiu de lucru premium</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Clienți, calendare de conținut, performanță video, impact în afacere, portaluri pentru clienți și rapoarte AI — create special pentru agenții, cu un spațiu de lucru privat pentru fiecare agenție.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3 text-sm font-700 text-white shadow-xl shadow-indigo-600/30 transition hover:brightness-110">
              Începe perioada de probă gratuită <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-700 transition hover:bg-muted">
              Vezi prețurile
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Fără card de credit · De la 99 €/lună · Anulezi oricând</p>

          <div className="mx-auto mt-14 max-w-4xl">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border/70 bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6 text-sm font-700 text-muted-foreground/70">
          <span>Nova Creative</span><span>Peak Studio</span><span>Halo Media</span><span>Bright Loop</span><span>Tide Agency</span>
        </div>
      </section>

      {/* Modules */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-800 tracking-tight sm:text-4xl">Tot ce are nevoie o agenție. Nimic în plus.</h2>
          <p className="mt-3 text-muted-foreground">Șaisprezece module care îți înlocuiesc foile de calcul, prezentările și jumătatea de duzină de instrumente deconectate.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <div key={m.title} className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                <m.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-800">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Niches */}
      <section id="niches" className="border-y border-border/70 bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-600 text-muted-foreground">
                <MessagesSquare className="h-3.5 w-3.5 text-indigo-500" /> Adaptat pe nișă
              </span>
              <h2 className="mt-4 font-display text-3xl font-800 tracking-tight sm:text-4xl">Un tablou de bord care vorbește limba clientului tău</h2>
              <p className="mt-3 text-muted-foreground">
                Imobiliarele urmăresc vizionări și oferte. Restaurantele urmăresc rezervări și cele mai vândute preparate. Fiecare nișă primește propriile metrici, formulare și secțiuni de raport — automat.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {Object.values(nicheLabels).map((n) => (
                  <span key={n} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-600">{n}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: "Imobiliare", m: ["14 proprietăți promovate", "37 vizionări programate", "9 oferte primite", "6,40 € cost / lead"] },
                { t: "Restaurant", m: ["312 rezervări", "1.284 comenzi online", "38,2 mii € impact vânzări", "Paste cu trufe #1"] },
                { t: "Fitness", m: ["63 abonamente vândute", "148 ședințe de probă", "412 mesaje", "38% din conținut"] },
                { t: "Hotel", m: ["86% grad de ocupare", "184 € ADR", "158 € RevPAR", "Rezervări directe în creștere"] },
              ].map((c) => (
                <div key={c.t} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-800 text-indigo-600 dark:text-indigo-400">{c.t}</p>
                  <ul className="mt-2 space-y-1">
                    {c.m.map((x) => <li key={x} className="text-[11px] text-muted-foreground">{x}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-800 tracking-tight sm:text-4xl">Funcțional în câteva minute, fără migrări</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 font-display text-base font-800 text-white">{s.n}</span>
              <h3 className="mt-4 font-display text-lg font-800">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border/70 bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex gap-0.5 text-amber-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                <p className="mt-3 text-sm leading-relaxed">"{t.quote}"</p>
                <p className="mt-4 text-sm font-700">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-800 tracking-tight sm:text-4xl">Prețuri simple, prietenoase cu agențiile</h2>
          <p className="mt-3 text-muted-foreground">Începe de la 99 €/lună. Crește la clienți nelimitați și white-label pe măsură ce te dezvolți.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.name} className={`flex flex-col rounded-2xl border bg-card p-6 ${p.current ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-border"}`}>
              <p className="font-display text-base font-800">{p.name}</p>
              <p className="mt-3 font-display text-3xl font-800">{p.price} €<span className="text-sm font-600 text-muted-foreground">/lună</span></p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}</li>
                ))}
              </ul>
              <Link to="/pricing" className="mt-5 rounded-lg border border-border py-2 text-center text-sm font-700 transition hover:bg-muted">Află mai multe</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-600 px-8 py-16 text-center text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <h2 className="font-display text-3xl font-800 tracking-tight sm:text-4xl">Gata să conduci o agenție mai eficientă?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Alătură-te agențiilor care gestionează fiecare client, campanie și raport într-un singur spațiu de lucru premium.</p>
          <Link to="/signup" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-800 text-indigo-700 shadow-xl transition hover:bg-white/90">
            Începe gratuit <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
