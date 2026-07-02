import { Link } from "react-router-dom";
import { plans } from "@/data/sample";
import { Check, Minus } from "lucide-react";

/* Same register as the homepage: editorial type, hairline grid, flat chrome. */

const comparison = [
  { feature: "Clienți", values: ["5", "15", "Nelimitat", "Nelimitat"] },
  { feature: "Membri în echipă", values: ["1", "3", "Nelimitat", "Nelimitat"] },
  { feature: "Calendar de conținut", values: [true, true, true, true] },
  { feature: "Stocare de documente", values: [true, true, true, true] },
  { feature: "Rapoarte lunare AI", values: [false, true, true, true] },
  { feature: "Portal client", values: [false, true, true, true] },
  { feature: "Tablouri de bord pe nișă", values: [false, true, true, true] },
  { feature: "Flux de aprobare", values: [false, true, true, true] },
  { feature: "Cameră de strategie AI", values: [false, false, true, true] },
  { feature: "Analize avansate", values: [false, false, true, true] },
  { feature: "Monitorizarea concurenței", values: [false, false, true, true] },
  { feature: "Rapoarte white-label", values: [false, false, true, true] },
  { feature: "Branding personalizat", values: [false, false, false, true] },
  { feature: "Domeniu personalizat", values: [false, false, false, true] },
  { feature: "Rapoarte PDF premium", values: [false, false, false, true] },
];

const faqs = [
  { q: "Există o perioadă de probă gratuită?", a: "Da — fiecare plan începe cu 14 zile gratuite. Nu ai nevoie de card ca să începi." },
  { q: "Pot schimba planul mai târziu?", a: "Oricând. Trecerea la un plan superior se calculează proporțional și intră în vigoare imediat; trecerea la unul inferior se aplică la următorul ciclu de facturare." },
  { q: "Datele agenției mele sunt izolate?", a: "Complet. Fiecare agenție are un spațiu de lucru privat, izolat la nivel de date — datele clienților tăi nu sunt vizibile pentru nimeni altcineva." },
  { q: "Ce include white-label?", a: "Pe Unlimited și White Label Pro adaugi propriul logo și culoarea brandului; pe Pro, și un domeniu personalizat pe portalul clienților și pe rapoarte." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">{children}</p>;
}

const ctaDark = "inline-block rounded-full bg-foreground px-6 py-3 text-sm font-500 text-background transition duration-200 motion-safe:hover:-translate-y-0.5";

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-foreground/60" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />;
  return <span className="text-sm font-500">{v}</span>;
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-28 pt-36 md:pt-44">
      <div className="max-w-2xl">
        <Eyebrow>Prețuri</Eyebrow>
        <h1 className="mt-5 font-display text-4xl font-600 leading-[1.05] md:text-6xl">Simplu. Crești când crești.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          14 zile gratuite pe orice plan, fără card. Prețuri în EUR, facturate lunar.
        </p>
      </div>

      {/* Plan cards — hairline grid, flat */}
      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <div key={p.name} className="flex flex-col bg-background p-7">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-600">{p.name.replace(" Agency", "").replace(" Pro", "")}</p>
              {p.current && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-500 text-background">Cel mai ales</span>}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.tagline}</p>
            <p className="mt-5 font-display text-4xl font-600">{p.price} €<span className="text-sm font-400 text-muted-foreground"> /lună</span></p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/40" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className={`mt-8 rounded-full py-2.5 text-center text-sm font-500 transition duration-200 motion-safe:hover:-translate-y-0.5 ${
                p.current ? "bg-foreground text-background" : "border border-border text-foreground hover:bg-muted/50"
              }`}
            >
              Începe gratuit
            </Link>
          </div>
        ))}
      </div>

      {/* Comparison */}
      <div className="mt-28 md:mt-36">
        <Eyebrow>Comparație</Eyebrow>
        <h2 className="mt-5 font-display text-3xl font-600 md:text-4xl">Fiecare funcționalitate, plan cu plan.</h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border/60">
                <th className="px-4 py-3.5 text-left text-sm font-500 text-muted-foreground">Funcționalitate</th>
                {plans.map((p) => (
                  <th key={p.name} className="px-4 py-3.5 text-center text-sm font-600">
                    {p.name.split(" ")[0]}
                    <div className="text-xs font-400 text-muted-foreground">{p.price} €</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-border/50">
                  <td className="px-4 py-3.5 text-sm">{row.feature}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-4 py-3.5 text-center"><Cell v={v} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-28 max-w-3xl md:mt-36">
        <Eyebrow>Întrebări frecvente</Eyebrow>
        <div className="mt-8">
          {faqs.map((f) => (
            <details key={f.q} className="group border-t border-border/50 py-6 first:border-t-0">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-600 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="ml-4 font-400 text-muted-foreground transition duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3.5 max-w-xl leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-24 md:mt-32">
        <Link to="/signup" className={ctaDark}>Începe gratuit</Link>
        <p className="mt-4 text-xs text-muted-foreground/80">14 zile gratuit · Fără card · Anulezi oricând</p>
      </div>
    </main>
  );
}
