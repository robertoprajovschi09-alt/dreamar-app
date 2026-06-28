import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import Admin from "@/pages/Admin";
import { LogOut, Moon, ShieldCheck, Sun } from "lucide-react";

// Standalone chrome for the platform (SaaS) admin — no agency sidebar/nav,
// just the cross-tenant control room. Reached via the footer → /admin/login.
export function AdminShell() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-glow"><ShieldCheck className="h-5 w-5" /></span>
          <div className="leading-none">
            <p className="font-display text-[15px] font-800 tracking-tight">drea.mar — Panou de control</p>
            <p className="mt-0.5 text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">Administrare SaaS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted" aria-label="Comută tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => { signOut(); navigate("/admin/login"); }} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-600 text-muted-foreground transition hover:bg-muted">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Deconectare</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] space-y-6 p-4 lg:p-8">
        <Admin />
      </main>
    </div>
  );
}
