import { Link } from "react-router-dom";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-600 text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-600 lg:block">
        <div className="pointer-events-none absolute -right-16 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-10 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-12 text-white">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 font-display text-lg font-800 backdrop-blur">d</span>
            <span className="font-display text-lg font-800">drea<span className="text-white/80">.mar</span></span>
          </div>
          <h2 className="mt-8 max-w-md font-display text-3xl font-800 leading-tight">The premium operating system for marketing agencies.</h2>
          <ul className="mt-8 space-y-3">
            {[
              "Private, isolated workspace per agency",
              "Niche dashboards, calendars & client portals",
              "AI reports, strategy room & health scores",
              "White-label on Unlimited & Pro",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20"><Check className="h-3 w-3" /></span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex items-center gap-2 text-xs text-white/70">
            <Sparkles className="h-3.5 w-3.5" /> Trusted by agencies across the EU
          </div>
        </div>
      </div>
    </div>
  );
}
