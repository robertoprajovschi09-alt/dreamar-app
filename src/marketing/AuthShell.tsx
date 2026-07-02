import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/* Auth chrome in the homepage register: flat, editorial, monochrome. */

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-root grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link to="/" className="link-u inline-flex w-fit items-center gap-1.5 text-sm font-500 text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Înapoi la site
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Brand side — flat near-black, one statement */}
      <div className="hidden bg-foreground text-background lg:block">
        <div className="flex h-full flex-col justify-center px-14">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-background text-foreground">
              <span className="font-display text-sm font-600">d</span>
            </span>
            <span className="font-display text-[15px] font-600 tracking-tight">drea<span className="opacity-60">.mar</span></span>
          </div>
          <h2 className="mt-10 max-w-md font-display text-4xl font-600 leading-[1.1]">
            Sistemul de operare al agenției tale.
          </h2>
          <ul className="mt-10 max-w-sm">
            {[
              "Clienți, conținut, aprobări și rezultate — într-un singur loc",
              "Un portal simplu, pe limba clientului",
              "Spațiu de lucru privat, izolat per agenție",
            ].map((f) => (
              <li key={f} className="border-t border-background/15 py-4 text-sm leading-relaxed opacity-80 first:border-t-0">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
