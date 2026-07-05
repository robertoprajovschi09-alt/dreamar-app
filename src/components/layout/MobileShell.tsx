import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { HELP } from "@/components/PageHelp";
import { ClientsProvider } from "@/lib/clients";
import { ClipsProvider } from "@/lib/clips";
import { ScriptsProvider } from "@/lib/scripts";
import { LibraryProvider } from "@/lib/library";
import { CampaignsProvider } from "@/lib/campaigns";
import { UIProvider } from "@/lib/ui-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { allDestinations } from "@/lib/nav";
import { useWorkspace } from "@/lib/workspace";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Clapperboard, LayoutGrid, LogOut, Moon, Sun, Target, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The three primary tabs; everything else lives behind "Mai mult".
const TAB_PATHS = new Set(["/dashboard", "/pipeline", "/money"]);

export default function MobileShell() {
  return (
    <ClientsProvider>
      <ClipsProvider>
        <ScriptsProvider>
          <LibraryProvider>
            <CampaignsProvider>
              <UIProvider>
                <MobileInner />
              </UIProvider>
            </CampaignsProvider>
          </LibraryProvider>
        </ScriptsProvider>
      </ClipsProvider>
    </ClientsProvider>
  );
}

function MobileInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet whenever the route changes (a tap navigated away).
  useEffect(() => { setMoreOpen(false); }, [path]);

  const active = path.startsWith("/pipeline") ? "pipeline"
    : path.startsWith("/money") ? "money"
    : path.startsWith("/dashboard") ? "home"
    : "more";
  const go = (to: string) => { setMoreOpen(false); navigate(to); };

  // Long-press on a bottom-bar icon reveals a tiny "what is this page" popover.
  const [pressHelp, setPressHelp] = useState<{ title: string; short: string } | null>(null);
  const MORE_HELP = { title: "Mai mult", short: "Restul paginilor: Clienți, Calendar, Scripturi, Kill List, Agenție, Setări." };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}>
          <ErrorBoundary key={path}>
            <Outlet />
          </ErrorBoundary>
        </Suspense>
      </main>

      {pressHelp && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <div className="max-w-[320px] rounded-xl border border-border bg-card p-3 shadow-card">
            <p className="text-sm font-800">{pressHelp.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{pressHelp.short}</p>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-stretch justify-between px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5">
          <TabBtn label="Azi" icon={Target} active={active === "home"} onClick={() => go("/dashboard")} help={HELP.azi} onPress={setPressHelp} />
          <TabBtn label="Pipeline" icon={Clapperboard} active={active === "pipeline"} onClick={() => go("/pipeline")} help={HELP.pipeline} onPress={setPressHelp} />
          <TabBtn label="Bani" icon={Wallet} active={active === "money"} onClick={() => go("/money")} help={HELP.bani} onPress={setPressHelp} />
          <TabBtn label="Mai mult" icon={LayoutGrid} active={active === "more" || moreOpen} onClick={() => setMoreOpen(true)} help={MORE_HELP} onPress={setPressHelp} />
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onGo={go} />
    </div>
  );
}

type TabHelp = { title: string; short: string };
function TabBtn({ label, icon: Icon, active, onClick, help, onPress }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void; help: TabHelp; onPress: (h: TabHelp | null) => void }) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const start = () => {
    longPressed.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onPress(help);
      try { navigator.vibrate?.(15); } catch { /* no haptics */ }
    }, 450);
  };
  const end = () => { clear(); onPress(null); };
  return (
    <button
      onClick={() => { if (!longPressed.current) onClick(); }}
      onPointerDown={start} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label} aria-current={active ? "page" : undefined}
      className={cn("flex min-h-[52px] flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-700 transition active:bg-muted/60",
        active ? "text-primary" : "text-muted-foreground")}>
      <Icon className="h-[23px] w-[23px]" />
      {label}
    </button>
  );
}

function MoreSheet({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (to: string) => void }) {
  const { profile, currentAgency } = useWorkspace();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const more = allDestinations.filter((d) => !TAB_PATHS.has(d.to));

  return (
    <>
      <button aria-label="Închide" onClick={onClose}
        className={cn("fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <div role="dialog" aria-modal="true"
        className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-card transition-transform duration-300", open ? "translate-y-0" : "translate-y-full")}>
        <div className="mx-auto max-w-[680px] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-800 text-primary">{(profile.name || "?").slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate font-700">{profile.name || "Cont"}</p>
              <p className="truncate text-xs text-muted-foreground">{currentAgency.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {more.map((d) => (
              <button key={d.to} onClick={() => onGo(d.to)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-600 transition active:bg-muted">
                <d.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                <span className="truncate">{d.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={toggle}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-600 transition active:bg-muted">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Temă deschisă" : "Temă închisă"}
            </button>
            <button onClick={() => { void signOut(); navigate("/login"); }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-600 text-danger transition active:bg-danger/10">
              <LogOut className="h-4 w-4" /> Deconectare
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
