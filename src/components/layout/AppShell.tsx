import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";
import { UIProvider } from "@/lib/ui-context";
import { ClientsProvider } from "@/lib/clients";
import { ClipsProvider } from "@/lib/clips";
import { ScriptsProvider } from "@/lib/scripts";
import { LibraryProvider } from "@/lib/library";
import { CampaignsProvider } from "@/lib/campaigns";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  return (
    <ClientsProvider>
    <ClipsProvider>
    <ScriptsProvider>
    <LibraryProvider>
    <CampaignsProvider>
    <UIProvider>
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "" : "pointer-events-none")}>
        <div
          className={cn(
            "absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute left-0 top-0 h-[100dvh] shadow-2xl transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar onClose={() => setMobileOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div key={location.pathname} className="mx-auto max-w-[1320px] animate-page space-y-6 p-4 lg:p-6">
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<div className="grid min-h-[50vh] place-items-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
    </UIProvider>
    </CampaignsProvider>
    </LibraryProvider>
    </ScriptsProvider>
    </ClipsProvider>
    </ClientsProvider>
  );
}
