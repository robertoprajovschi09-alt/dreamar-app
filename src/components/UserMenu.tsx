import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/lib/toast";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { ChevronDown, CreditCard, LogOut, Moon, Sun, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { push } = useToast();
  const { profile } = useWorkspace();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (to: string) => () => { setOpen(false); navigate(to); };

  const items = [
    { icon: User, label: "Profil", run: go("/settings") },
    { icon: CreditCard, label: "Facturare și plan", run: go("/billing") },
    { icon: Users, label: "Schimbă agenția", run: () => { setOpen(false); push({ tone: "info", title: "Schimbă agenția", description: "Folosește comutatorul de spațiu de lucru din partea de sus a barei laterale." }); } },
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={cn("flex items-center gap-2.5 rounded-lg border border-border bg-card py-1 pl-1 pr-2.5 transition hover:bg-muted", open && "bg-muted")}>
        <Avatar name={profile.name || "?"} src={profile.avatarUrl || undefined} size={30} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-xs font-700">{profile.name}</span>
          <span className="block text-[10px] text-muted-foreground">{profile.role}</span>
        </span>
        <ChevronDown className={cn("hidden h-3.5 w-3.5 text-muted-foreground transition md:block", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 animate-scale-in panel overflow-hidden p-1.5">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={profile.name || "?"} src={profile.avatarUrl || undefined} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-700">{profile.name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          {items.map((it) => (
            <button key={it.label} onClick={it.run} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-600 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <it.icon className="h-4 w-4" /> {it.label}
            </button>
          ))}
          <button onClick={() => { toggle(); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-600 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Mod luminos" : "Mod întunecat"}
          </button>
          <div className="my-1 h-px bg-border" />
          <button onClick={() => { setOpen(false); signOut(); navigate("/login"); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-600 text-danger transition hover:bg-danger/10">
            <LogOut className="h-4 w-4" /> Deconectare
          </button>
        </div>
      )}
    </div>
  );
}
