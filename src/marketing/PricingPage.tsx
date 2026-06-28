import { Link } from "react-router-dom";
import { plans } from "@/data/sample";
import { Check, Minus } from "lucide-react";

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
  { q: "Există o perioadă de probă gratuită?", a: "Da — fiecare plan începe cu o perioadă de probă gratuită de 14 zile. Nu ai nevoie de card de credit ca să începi." },
  { q: "Pot schimba planul mai târziu?", a: "Oricând. Trecerea la un plan superior se calculează proporțional și intră în vigoare imediat, iar trecerea la un plan inferior se aplică la următorul ciclu de facturare." },
  { q: "Datele agenției mele sunt izolate?", a: "Complet. Fiecare agenție primește un spațiu de lucru privat, securizat la nivel de date — datele clienților tăi nu sunt niciodată vizibile pentru altă agenție." },
  { q: "Ce include white-label?", a: "Pe planurile Unlimited și White Label Pro poți adăuga propriul logo, culoarea brandului și (pe Pro) un domeniu personalizat pe portalul clienților și pe rapoarte." },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-success" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  return <span className="text-sm font-600">{v}</span>;
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-800 tracking-tight sm:text-5xl">Prețuri care cresc odată cu agenția ta</h1>
        <p className="mt-4 text-muted-foreground">Alege un plan, începe o perioadă de probă gratuită de 14 zile și plătești doar pentru ce ai nevoie pe măsură ce crești. Toate prețurile în EUR, facturate lunar.</p>
      </div>

      {/* Plan cards */}
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.current ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-600/10" : "border-border"}`}>
            {p.current && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-1 text-[10px] font-800 uppercase tracking-wide text-white">Cel mai popular</span>
            )}
            <p className="font-display text-base font-800">{p.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
            <p className="mt-4 font-display text-4xl font-800">{p.price} €<span className="text-sm font-600 text-muted-foreground">/lună</span></p>
            <ul className="mt-5 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}</li>
              ))}
            </ul>
            <Link
              to="/signup"
              className={`mt-6 rounded-lg py-2.5 text-center text-sm font-700 transition ${p.current ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 hover:brightness-110" : "border border-border hover:bg-muted"}`}
            >
              Începe perioada de probă gratuită
            </Link>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="mt-20">
        <h2 className="text-center font-display text-2xl font-800">Compară fiecare funcționalitate</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-700">Funcționalitate</th>
                {plans.map((p) => (
                  <th key={p.name} className="px-4 py-3 text-center text-sm font-700">{p.name.split(" ")[0]}<div className="text-xs font-600 text-muted-foreground">{p.price} €</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-border/60">
                  <td className="px-4 py-3 text-sm font-600">{row.feature}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-4 py-3 text-center"><Cell v={v} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-center font-display text-2xl font-800">Întrebări frecvente</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-card p-5">
              <p className="font-display text-sm font-800">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 text-center">
        <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3 text-sm font-700 text-white shadow-xl shadow-indigo-600/30 transition hover:brightness-110">
          Începe perioada de probă gratuită
        </Link>
      </div>
    </main>
  );
}
