import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ClientsProvider } from "@/lib/clients";
import { ClipsProvider } from "@/lib/clips";
import { LibraryProvider } from "@/lib/library";
import { UIProvider } from "@/lib/ui-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useInbox } from "@/lib/inbox";
import Today from "@/pages/Today";
import { MobileInbox } from "@/pages/mobile/MobileInbox";
import { MobileClients } from "@/pages/mobile/MobileClients";
import { MobileAccount } from "@/pages/mobile/MobileAccount";
import { Home, Inbox as InboxIcon, UserCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "home" | "inbox" | "clients" | "account";

export default function MobileShell() {
  return (
    <ClientsProvider>
      <ClipsProvider>
        <LibraryProvider>
          <UIProvider>
            <MobileInner />
          </UIProvider>
        </LibraryProvider>
      </ClipsProvider>
    </ClientsProvider>
  );
}

function MobileInner() {
  const [tab, setTab] = useState<Tab>("home");
  // Set when a feed row wants to open a client — consumed by the Clienți tab.
  const [focusClient, setFocusClient] = useState<string | null>(null);
  const { count } = useInbox();
  const location = useLocation();
  const openClient = (name: string) => { setFocusClient(name); setTab("clients"); };

  // Deep links / programmatic navigation (g-shortcuts) land on the right tab.
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith("/clients")) setTab("clients");
    else if (p.startsWith("/settings") || p.startsWith("/agency") || p.startsWith("/integrations")) setTab("account");
    else if (p.startsWith("/dashboard")) setTab("home");
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5">
        <ErrorBoundary key={tab}>
          {tab === "home" && <Today />}
          {tab === "inbox" && <MobileInbox onOpenClient={openClient} />}
          {tab === "clients" && <MobileClients initialName={focusClient} onConsumed={() => setFocusClient(null)} />}
          {tab === "account" && <MobileAccount />}
        </ErrorBoundary>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-end justify-between px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-2">
          <TabBtn label="Acasă" icon={Home} active={tab === "home"} onClick={() => setTab("home")} />
          <TabBtn label="Inbox" icon={InboxIcon} active={tab === "inbox"} onClick={() => setTab("inbox")} badge={count} />
          <TabBtn label="Clienți" icon={Users} active={tab === "clients"} onClick={() => setTab("clients")} />
          <TabBtn label="Cont" icon={UserCircle} active={tab === "account"} onClick={() => setTab("account")} />
        </div>
      </nav>
    </div>
  );
}

function TabBtn({ label, icon: Icon, active, onClick, badge }: { label: string; icon: typeof Home; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-600 transition", active ? "text-primary" : "text-muted-foreground")}>
      <Icon className="h-[22px] w-[22px]" />
      {label}
      {badge ? <span className="absolute right-[18%] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-800 text-white">{badge}</span> : null}
    </button>
  );
}
