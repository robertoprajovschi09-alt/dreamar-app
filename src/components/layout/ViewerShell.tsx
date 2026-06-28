import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import ClientPortal from "@/pages/ClientPortal";
import ClientOnboarding from "@/pages/ClientOnboarding";
import { LogOut, Moon, Sun } from "lucide-react";

// Minimal chrome for a client VIEWER — no agency sidebar/nav, just their portal.
export function ViewerShell() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const { viewerAgencyName, viewerOnboarded } = useWorkspace();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-white shadow-glow"><span className="font-display text-lg font-800">d</span></span>
          <div className="leading-none">
            <p className="font-display text-[15px] font-800 tracking-tight">Portal client</p>
            <p className="mt-0.5 text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">{viewerAgencyName ? `susținut de ${viewerAgencyName}` : "susținut de drea.mar"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted" aria-label="Comută tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => { signOut(); navigate("/login"); }} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-600 text-muted-foreground transition hover:bg-muted">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Deconectare</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] space-y-6 p-4 lg:p-8">
        {viewerOnboarded ? <ClientPortal /> : <ClientOnboarding />}
      </main>
    </div>
  );
}
