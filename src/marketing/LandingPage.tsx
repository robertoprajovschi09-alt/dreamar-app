import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { plans } from "@/data/sample";
import { ShotApp, ShotApproval, ShotPhone, ShotRaport } from "./ProductShots";

/*
 * The homepage is a story: hero → problem → workflow → product (shown) →
 * client portal → why switch → pricing → FAQ → close. Editorial type (Geist,
 * medium weight, tight tracking), monochrome chrome — the product shots carry
 * the only color. Motion = one quick physical reveal per block.
 */

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

function Eyebrow({ n, children }: { n?: string; children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
      {n && <span className="mr-2 opacity-60">{n}</span>}{children}
    </p>
  );
}

const ctaDark = "inline-block rounded-full bg-foreground px-6 py-3 text-sm font-500 text-background transition duration-200 motion-safe:hover:-translate-y-0.5";

export default function LandingPage() {
  return (
    <main>
      {/* 1 — Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-36 md:pt-48">
        <Reveal className="max-w-3xl">
          <Eyebrow>Pentru agenții de marketing</Eyebrow>
          <h1 className="mt-5 font-display text-[2.75rem] font-600 leading-[1.04] md:text-7xl">
            Sistemul de operare al agenției tale.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Clienți, conținut, aprobări și rezultate — într-un singur flux calm.
            Ca ziua ta să fie despre muncă, nu despre unelte.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link to="/signup" className={ctaDark}>Începe gratuit</Link>
          </div>
          <p className="mt-5 text-xs text-muted-foreground/80">14 zile gratuit · Fără card · Anulezi oricând</p>
        </Reveal>
        <Reveal className="mt-16 md:mt-24">
          <ShotApp />
        </Reveal>
      </section>

      {/* 2 — The problem */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <Reveal>
            <Eyebrow n="01">Problema</Eyebrow>
            <div className="mt-8 max-w-3xl space-y-2 font-display text-3xl font-500 leading-snug text-muted-foreground/70 md:text-5xl">
              <p>Calendarul e într-un tool.</p>
              <p>Aprobările — pe WhatsApp.</p>
              <p>Raportul — un Excel, duminică seara.</p>
            </div>
            <p className="mt-10 max-w-3xl font-display text-3xl font-600 leading-snug md:text-5xl">
              Munca e bună. Doar că trăiește în cinci locuri.
            </p>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              DreamAR o adună la un loc — organizată pe client, nu pe unealtă.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 3 — The daily workflow */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <Reveal>
            <Eyebrow n="02">Fluxul zilnic</Eyebrow>
            <h2 className="mt-5 max-w-2xl font-display text-3xl font-600 md:text-5xl">O zi de lucru, un singur tab.</h2>
          </Reveal>
          <ol className="mt-14 max-w-2xl">
            {[
              ["Deschizi „Astăzi”", "Vezi exact ce are nevoie de tine — nimic mai mult."],
              ["Trimiți spre aprobare", "Direct din calendar, dintr-un click."],
              ["Clientul decide din portalul lui", "Aprob sau Vreau o schimbare. Fără login-uri uitate."],
              ["Rezultatele se adună singure", "Lead-uri, venit, buget de ads și ROI — gata de raport."],
            ].map(([t, d], i) => (
              <Reveal key={t}>
                <li className="flex gap-8 border-t border-border/50 py-7 first:border-t-0 md:gap-12">
                  <span className="pt-1 font-mono text-xs text-muted-foreground/60">0{i + 1}</span>
                  <div>
                    <p className="font-display text-xl font-600">{t}</p>
                    <p className="mt-1.5 leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 — The product, shown */}
      <section id="produs" className="scroll-mt-24 border-t border-border/50">
        <div className="mx-auto max-w-7xl space-y-28 px-6 py-28 md:space-y-40 md:py-40">
          <div className="grid items-center gap-12 md:grid-cols-5 md:gap-16">
            <Reveal className="md:col-span-2">
              <Eyebrow n="03">Produsul</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-600 md:text-4xl">Raportul se scrie din datele pe care le ai deja.</h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Lead-uri, venit, buget și ROI se adună automat pe fiecare client.
                Tu adaugi două rânduri pe limba lui — și apeși Trimite.
              </p>
            </Reveal>
            <Reveal className="md:col-span-3"><ShotRaport /></Reveal>
          </div>

          <div className="grid items-center gap-12 md:grid-cols-5 md:gap-16">
            <Reveal className="md:order-2 md:col-span-2">
              <h2 className="font-display text-3xl font-600 md:text-4xl">Aprobarea durează 30 de secunde, nu 3 zile.</h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Clientul primește un buton, nu un link cu parolă uitată.
                Decizia lui apare la tine pe „Astăzi” — cu tot cu motivul, dacă cere o schimbare.
              </p>
            </Reveal>
            <Reveal className="md:order-1 md:col-span-3"><ShotApproval /></Reveal>
          </div>
        </div>
      </section>

      {/* 5 — The client experience */}
      <section id="clienti" className="scroll-mt-24 border-t border-border/50">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-28 md:grid-cols-2 md:gap-20 md:py-40">
          <Reveal>
            <Eyebrow n="04">Portalul clientului</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-600 md:text-4xl">
              Clientul tău vede un singur lucru: că afacerea lui crește.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Fără dashboard-uri, fără jargon. Cifrele lui — câți oameni l-au căutat,
              cât a investit, cât s-a întors — și un singur buton de apăsat.
            </p>
          </Reveal>
          <Reveal><ShotPhone /></Reveal>
        </div>
      </section>

      {/* 6 — Why agencies switch */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <Reveal><Eyebrow n="05">De ce schimbă agențiile</Eyebrow></Reveal>
          <div className="mt-10 max-w-3xl">
            {[
              ["Totul pe client, nu pe unealtă", "Calendar, campanii, aprobări, fișiere și raport trăiesc în interiorul fiecărui client."],
              ["Rapoarte pe limba clientului", "CTR-ul rămâne la tine. Clientul vede lead-uri, venit și ROI."],
              ["Gândit pentru 30 de secunde între ședințe", "Deschizi, rezolvi ce e roșu, închizi. Pe telefon sau pe desktop."],
            ].map(([t, d]) => (
              <Reveal key={t}>
                <div className="border-t border-border/50 py-9 first:border-t-0">
                  <p className="font-display text-2xl font-600">{t}</p>
                  <p className="mt-2.5 max-w-xl leading-relaxed text-muted-foreground">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Pricing */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <Reveal>
            <Eyebrow n="06">Prețuri</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-600 md:text-5xl">Simplu. Crești când crești.</h2>
          </Reveal>
          <Reveal className="mt-14">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((p, i) => (
                <div key={p.name} className="bg-background p-7">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-600">{p.name.replace(" Agency", "").replace(" Pro", "")}</p>
                    {i === 1 && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-500 text-background">Cel mai ales</span>}
                  </div>
                  <p className="mt-4 font-display text-3xl font-600">{p.price} €<span className="text-sm font-400 text-muted-foreground"> /lună</span></p>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.tagline}</p>
                  <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    {p.features.slice(0, 3).map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-6">
              <Link to="/signup" className={ctaDark}>Începe gratuit</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-3xl px-6 py-28 md:py-40">
          <Reveal><Eyebrow n="07">Întrebări frecvente</Eyebrow></Reveal>
          <div className="mt-10">
            {[
              ["Cât durează să încep?", "Îți creezi contul, adaugi primul client și îl inviți în portal — sub 10 minute. Nu există proces de implementare."],
              ["Clienții mei trebuie să învețe ceva?", "Nu. Portalul lor are cifrele lor și un buton de aprobat. Dacă știu să folosească WhatsApp, se descurcă și aici."],
              ["Pot să lucrez și de pe telefon?", "Da — pe telefon primești o aplicație gândită pentru triaj: vezi ce are nevoie de tine, trimiți spre aprobare, răspunzi. Planificarea detaliată rămâne pe desktop."],
              ["Ce se întâmplă după cele 14 zile?", "Alegi un plan sau te oprești. Nu cerem card la înscriere, deci nu există facturare-surpriză."],
              ["Unde sunt stocate datele?", "În Uniunea Europeană, cu acces izolat per agenție. Datele clienților tăi nu se ating între ele."],
            ].map(([q, a]) => (
              <Reveal key={q}>
                <details className="group border-t border-border/50 py-6 first:border-t-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-600 [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="ml-4 font-400 text-muted-foreground transition duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3.5 max-w-xl leading-relaxed text-muted-foreground">{a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 9 — Close */}
      <section className="border-t border-border/50 bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-6 py-28 text-center md:py-40">
          <Reveal>
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-600 leading-[1.1] md:text-6xl">
              Adu-ți agenția într-un singur loc.
            </h2>
            <div className="mt-10">
              <Link to="/signup" className="inline-block rounded-full bg-background px-7 py-3.5 text-sm font-500 text-foreground transition duration-200 motion-safe:hover:-translate-y-0.5">
                Începe gratuit
              </Link>
            </div>
            <p className="mt-5 text-xs opacity-60">14 zile gratuit · Fără card · Anulezi oricând</p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
