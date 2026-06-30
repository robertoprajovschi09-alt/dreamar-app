import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import ClientOnboarding from "@/pages/ClientOnboarding";
import { ClientHome } from "@/pages/client/ClientHome";
import { ClientApprovals } from "@/pages/client/ClientApprovals";
import { CheckSquare, FileText, Home, LogOut, MessageCircle, MessageSquareDashed, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "home" | "approvals" | "messages" | "reports" | "account";

export function ViewerShell() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { viewerAgencyName, viewerOnboarded, viewerClientId, viewerClientName, profile } = useWorkspace();
  const [tab, setTab] = useState<Tab>("home");
  const [pending, setPending] = useState(0);
  const onSignOut = () => { signOut(); navigate("/login"); };

  const refreshPending = useCallback(async () => {
    if (!supabase || !viewerClientId) return;
    const { count } = await supabase.from("approvals").select("id", { count: "exact", head: true })
      .eq("client_id", viewerClientId).eq("entity_type", "post").eq("status", "pending");
    setPending(count ?? 0);
  }, [viewerClientId]);
  useEffect(() => { if (viewerOnboarded) void refreshPending(); }, [viewerOnboarded, refreshPending]);

  if (!viewerOnboarded) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Header agencyName={viewerAgencyName} onSignOut={onSignOut} />
        <main className="mx-auto max-w-[640px] p-4 lg:p-8"><ClientOnboarding /></main>
      </div>
    );
  }

  const NAV: { id: Tab; label: string; icon: typeof Home; badge?: number }[] = [
    { id: "home", label: "Acasă", icon: Home },
    { id: "approvals", label: "Aprobări", icon: CheckSquare, badge: pending || undefined },
    { id: "messages", label: "Mesaje", icon: MessageCircle },
    { id: "reports", label: "Rapoarte", icon: FileText },
    { id: "account", label: "Cont", icon: User },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Header agencyName={viewerAgencyName} onSignOut={onSignOut} />
      <main className="mx-auto w-full max-w-[640px] flex-1 p-4 pb-24">
        {tab === "home" && <ClientHome onOpenApprovals={() => setTab("approvals")} />}
        {tab === "approvals" && <ClientApprovals onChange={refreshPending} />}
        {tab === "messages" && <Soon title="Mesaje" text="Aici vei putea vorbi direct cu echipa ta, fără telefoane și e-mailuri pierdute. Vine în curând." />}
        {tab === "reports" && <Soon title="Rapoarte" text="Rapoartele tale lunare, pe înțelesul tuturor, apar aici în curând." />}
        {tab === "account" && <Account name={viewerClientName || profile.name} agency={viewerAgencyName} onSignOut={onSignOut} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-stretch justify-around">
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-600 transition", active ? "text-primary" : "text-muted-foreground")}>
                <n.icon className="h-[22px] w-[22px]" />
                {n.label}
                {n.badge ? <span className="absolute right-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-800 text-white">{n.badge}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Header({ agencyName, onSignOut }: { agencyName?: string; onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-white shadow-glow"><span className="font-display text-lg font-800">d</span></span>
        <div className="leading-none">
          <p className="font-display text-[15px] font-800 tracking-tight">Portalul tău</p>
          <p className="mt-0.5 text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground">{agencyName ? `cu ${agencyName}` : "drea.mar"}</p>
        </div>
      </div>
      <button onClick={onSignOut} aria-label="Deconectare" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"><LogOut className="h-4 w-4" /></button>
    </header>
  );
}

function Soon({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-4">
      <p className="font-display text-xl font-800">{title}</p>
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <MessageSquareDashed className="h-8 w-8 text-muted-foreground" />
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function Account({ name, agency, onSignOut }: { name: string; agency?: string; onSignOut: () => void }) {
  return (
    <div className="space-y-4">
      <p className="font-display text-xl font-800">Contul tău</p>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Afacerea ta</p>
        <p className="mt-0.5 font-700">{name}</p>
        {agency && <><p className="mt-3 text-xs text-muted-foreground">Agenția ta</p><p className="mt-0.5 font-700">{agency}</p></>}
      </div>
      <button onClick={onSignOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-700 text-muted-foreground transition hover:bg-muted"><LogOut className="h-4 w-4" /> Deconectare</button>
    </div>
  );
}
