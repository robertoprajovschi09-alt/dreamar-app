import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { LogOut, Monitor } from "lucide-react";

export function MobileAccount() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, currentAgency } = useWorkspace();
  return (
    <div className="space-y-4">
      <p className="font-display text-xl font-800">Cont</p>
      <div className="rounded-2xl border border-border p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/12 text-base font-800 text-primary">{(profile.name || "?").slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate font-700">{profile.name}</p>
            <p className="truncate text-xs text-muted-foreground">{currentAgency.name}</p>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Monitor className="mt-0.5 h-4 w-4 shrink-0" /> Calendarul, campaniile și rapoartele detaliate se gestionează pe desktop. Aici rezolvi rapid ce are nevoie de tine.
      </div>
      <button onClick={() => { signOut(); navigate("/login"); }} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-700 text-muted-foreground transition active:bg-muted">
        <LogOut className="h-4 w-4" /> Deconectare
      </button>
    </div>
  );
}
