import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Per-page "Cum funcționează" help. A discreet "?" in the page header opens a
 * bottom half-sheet with the page's explanation; on the first visit to a page
 * the sheet opens itself once (a flag is stored locally). The `short` line also
 * feeds the mobile bottom-bar long-press popover.
 */

export type HelpKey = "azi" | "pipeline" | "bani" | "strateg" | "calendar" | "scripturi" | "clienti" | "killlist";

export const HELP: Record<HelpKey, { title: string; short: string; body: string }> = {
  azi: {
    title: "Azi",
    short: "Ce ai de făcut acum: alerte de bani, ce postezi azi, clipurile gata de postat și ce filmezi.",
    body: "Ce ai de făcut acum: alerte de bani, ce postezi azi, clipurile gata de postat și ce filmezi. Totul vine din Pipeline și din Bani. Aici doar bifezi.",
  },
  pipeline: {
    title: "Pipeline",
    short: "Drumul unui clip: Idee, De filmat, Filmat, Editat, Programat, Postat.",
    body: "Drumul unui clip: Idee, De filmat, Filmat, Editat, Programat, Postat. Clipurile gata de postat ale unui client sunt cele din Editat. Un clip poate primi o zi de filmare, care apare în Calendar. Ce programezi aici apare în Azi și în Calendar.",
  },
  bani: {
    title: "Bani",
    short: "Încasări cu scadențe, facturi de pregătit, decontul Yanis și împărțirea banilor.",
    body: "Încasări cu scadențe, facturi de pregătit, decontul Yanis și împărțirea banilor. Ce e depășit aici urcă singur în Azi. Pragurile de aici deblochează Kill List.",
  },
  strateg: {
    title: "Strategul",
    short: "Specialistul tău de marketing: analize, scripturi, obiective, idei.",
    body: "Specialistul tău de marketing: analize, scripturi, obiective, idei. Pornește mereu de la datele reale din aplicație. Ce propune se salvează cu un buton în Scripturi, Kill List sau Pipeline.",
  },
  calendar: {
    title: "Calendar",
    short: "Filmările și postările clipurilor, văzute pe zile.",
    body: "Filmările și postările clipurilor, văzute pe zile. Ce muți aici se mută și în clip. Filmările au contur, postările sunt pline. Fiecare client are calendarul lui, plus cel general.",
  },
  scripturi: {
    title: "Scripturi",
    short: "Banca ta de scripturi. Atașezi un script la un clip.",
    body: "Banca ta de scripturi. Atașezi un script la un clip. Când clipul merge, marchezi scriptul Funcționează și îl refolosești.",
  },
  clienti: {
    title: "Clienți",
    short: "Fișa fiecărui client: retainer, livrabile, rezultate lunare, fișiere.",
    body: "Fișa fiecărui client: retainer, livrabile, rezultate lunare, fișiere.",
  },
  killlist: {
    title: "Kill List",
    short: "Obiectivele tale, deblocate din cifrele reale din Bani.",
    body: "Obiectivele tale, deblocate din cifrele reale din Bani, nu din motivație.",
  },
};

export function PageHelp({ page }: { page: HelpKey }) {
  const [open, setOpen] = useState(false);
  const h = HELP[page];

  // Open once on the first visit to this page, then remember it.
  useEffect(() => {
    const key = `dreamar-help-seen-${page}`;
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setOpen(true);
      }
    } catch { /* private mode */ }
  }, [page]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Cum funcționează" title="Cum funcționează"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-muted hover:text-foreground">
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      {createPortal(
        <>
          <button aria-label="Închide" onClick={() => setOpen(false)}
            className={cn("fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-sm transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} />
          <div role="dialog" aria-modal="true" aria-label={`Cum funcționează: ${h.title}`}
            className={cn("fixed inset-x-0 bottom-0 z-[61] rounded-t-3xl border-t border-border bg-card transition-transform duration-300", open ? "translate-y-0" : "translate-y-full")}>
            <div className="mx-auto max-w-[560px] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <p className="text-[11px] font-700 uppercase tracking-wide text-muted-foreground">Cum funcționează</p>
              <h2 className="mt-1 font-display text-lg font-800">{h.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
              <button onClick={() => setOpen(false)}
                className="gradient-primary mt-5 flex min-h-[48px] w-full items-center justify-center rounded-xl text-sm font-700 text-white transition active:scale-[0.99]">
                Am înțeles
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
