import { Link } from "react-router-dom";
import { plans } from "@/data/sample";
import { ShotApp, ShotApproval, ShotPhone, ShotRaport } from "./ProductShots";

/*
 * The homepage is a story, not a brochure: hero → the problem → the daily
 * workflow → the product (shown, not told) → what the client sees → why
 * agencies switch → pricing → FAQ → close. One idea per section, hairline
 * borders, no gradients — typography carries the design.
 */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-700 uppercase tracking-[0.18em] text-muted-foreground">{children}</p>;
}

export default function LandingPage() {
  return (
    <main>
      {/* 1 — Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 md:pt-28">
        <div className="max-w-3xl">
          <Eyebrow>Pentru agenții de marketing</Eyebrow>
          <h1 className="mt-4 font-display text-4xl font-800 leading-[1.05] tracking-tight md:text-6xl">
            Sistemul de operare al agenției tale.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Clienți, conținut, aprobări și rezultate — într-un singur flux calm.
            Ca ziua ta să fie despre muncă, nu despre unelte.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/signup" className="rounded-xl bg-primary px-6 py-3 text-sm font-700 text-primary-foreground transition hover:brightness-110">
              Începe gratuit
            </Link>
            <Link to="/pricing" className="text-sm font-600 text-muted-foreground transition hover:text-foreground">
              Vezi prețurile →
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">14 zile gratuit · Fără card · Anulezi oricând</p>
        </div>
        <div className="mt-14 md:mt-16">
          <ShotApp />
        </div>
      </section>

      {/* 2 — The problem */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Eyebrow>Problema</Eyebrow>
          <div className="mt-6 max-w-3xl space-y-2 font-display text-2xl font-700 leading-snug tracking-tight text-muted-foreground/70 md:text-4xl">
            <p>Calendarul e într-un tool.</p>
            <p>Aprobările — pe WhatsApp.</p>
            <p>Raportul — un Excel, duminică seara.</p>
          </div>
          <p className="mt-8 max-w-3xl font-display text-2xl font-800 leading-snug tracking-tight md:text-4xl">
            Munca e bună. Doar că trăiește în cinci locuri.
          </p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            DreamAR o adună la un loc — organizată pe client, nu pe unealtă.
          </p>
        </div>
      </section>

      {/* 3 — The daily workflow */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Eyebrow>Fluxul zilnic</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-800 tracking-tight md:text-4xl">O zi de lucru, un singur tab.</h2>
          <ol className="mt-12 max-w-2xl">
            {[
              ["Deschizi „Astăzi”", "Vezi exact ce are nevoie de tine — nimic mai mult."],
              ["Trimiți spre aprobare", "Direct din calendar, dintr-un click."],
              ["Clientul decide din portalul lui", "Aprob sau Vreau o schimbare. Fără login-uri uitate."],
              ["Rezultatele se adună singure", "Lead-uri, venit, buget de ads și ROI — gata de raport."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-6 border-t border-border py-6 first:border-t-0 md:gap-10">
                <span className="font-display text-sm font-800 text-muted-foreground/60">0{i + 1}</span>
                <div>
                  <p className="font-display text-lg font-800 tracking-tight">{t}</p>
                  <p className="mt-1 text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 — The product, shown */}
      <section id="produs" className="border-t border-border">
        <div className="mx-auto max-w-6xl space-y-24 px-5 py-24 md:space-y-32 md:py-32">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <Eyebrow>Produsul</Eyebrow>
              <h2 className="mt-4 font-display text-3xl font-800 tracking-tight md:text-4xl">Raportul se scrie din datele pe care le ai deja.</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                Lead-uri, venit, buget și ROI se adună automat pe fiecare client.
                Tu adaugi două rânduri pe limba lui — și apeși Trimite.
              </p>
            </div>
            <ShotRaport />
          </div>

          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div className="md:order-2">
              <h2 className="font-display text-3xl font-800 tracking-tight md:text-4xl">Aprobarea durează 30 de secunde, nu 3 zile.</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                Clientul primește un buton, nu un link cu parolă uitată.
                Decizia lui apare la tine pe „Astăzi” — cu tot cu motivul, dacă cere o schimbare.
              </p>
            </div>
            <div className="md:order-1"><ShotApproval /></div>
          </div>
        </div>
      </section>

      {/* 5 — The client experience */}
      <section id="clienti" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 md:grid-cols-2 md:gap-16 md:py-32">
          <div>
            <Eyebrow>Portalul clientului</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-800 tracking-tight md:text-4xl">
              Clientul tău vede un singur lucru: că afacerea lui crește.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
              Fără dashboard-uri, fără jargon. Cifrele lui — câți oameni l-au căutat,
              cât a investit, cât s-a întors — și un singur buton de apăsat.
            </p>
          </div>
          <ShotPhone />
        </div>
      </section>

      {/* 6 — Why agencies switch */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Eyebrow>De ce schimbă agențiile</Eyebrow>
          <div className="mt-8 max-w-3xl">
            {[
              ["Totul pe client, nu pe unealtă", "Calendar, campanii, aprobări, fișiere și raport trăiesc în interiorul fiecărui client."],
              ["Rapoarte pe limba clientului", "CTR-ul rămâne la tine. Clientul vede lead-uri, venit și ROI."],
              ["Gândit pentru 30 de secunde între ședințe", "Deschizi, rezolvi ce e roșu, închizi. Pe telefon sau pe desktop."],
            ].map(([t, d]) => (
              <div key={t} className="border-t border-border py-8 first:border-t-0">
                <p className="font-display text-xl font-800 tracking-tight md:text-2xl">{t}</p>
                <p className="mt-2 max-w-xl text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Pricing */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
          <Eyebrow>Prețuri</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-800 tracking-tight md:text-4xl">Simplu. Crești când crești.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => (
              <div key={p.name} className="bg-background p-6">
                <div className="flex items-center justify-between">
                  <p className="font-display text-sm font-800">{p.name.replace(" Agency", "").replace(" Pro", "")}</p>
                  {i === 1 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-700 text-primary">Cel mai ales</span>}
                </div>
                <p className="mt-3 font-display text-3xl font-800">{p.price} €<span className="text-sm font-600 text-muted-foreground">/lună</span></p>
                <p className="mt-2 text-sm text-muted-foreground">{p.tagline}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {p.features.slice(0, 3).map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-5">
            <Link to="/signup" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-700 text-primary-foreground transition hover:brightness-110">Începe gratuit</Link>
            <Link to="/pricing" className="text-sm font-600 text-muted-foreground transition hover:text-foreground">Compară planurile →</Link>
          </div>
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-24 md:py-32">
          <Eyebrow>Întrebări frecvente</Eyebrow>
          <div className="mt-8">
            {[
              ["Cât durează să încep?", "Îți creezi contul, adaugi primul client și îl inviți în portal — sub 10 minute. Nu există proces de implementare."],
              ["Clienții mei trebuie să învețe ceva?", "Nu. Portalul lor are cifrele lor și un buton de aprobat. Dacă știu să folosească WhatsApp, se descurcă și aici."],
              ["Pot să lucrez și de pe telefon?", "Da — pe telefon primești o aplicație gândită pentru triaj: vezi ce are nevoie de tine, trimiți spre aprobare, răspunzi. Planificarea detaliată rămâne pe desktop."],
              ["Ce se întâmplă după cele 14 zile?", "Alegi un plan sau te oprești. Nu cerem card la înscriere, deci nu există facturare-surpriză."],
              ["Unde sunt stocate datele?", "În Uniunea Europeană, cu acces izolat per agenție. Datele clienților tăi nu se ating între ele."],
            ].map(([q, a]) => (
              <details key={q} className="group border-t border-border py-5 first:border-t-0">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-800 tracking-tight [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="ml-4 text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9 — Close */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center md:py-32">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-800 tracking-tight md:text-5xl">
            Adu-ți agenția într-un singur loc.
          </h2>
          <div className="mt-8">
            <Link to="/signup" className="inline-block rounded-xl bg-background px-7 py-3.5 text-sm font-700 text-foreground transition hover:opacity-90">
              Începe gratuit
            </Link>
          </div>
          <p className="mt-4 text-xs opacity-60">14 zile gratuit · Fără card · Anulezi oricând</p>
        </div>
      </section>
    </main>
  );
}
