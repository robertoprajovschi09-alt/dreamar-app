import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { navGroups, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { useClients } from "@/lib/clients";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Check, ChevronsUpDown, LogOut, Sparkles, X } from "lucide-react";

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-white shadow-glow">
        <span className="font-display text-lg font-800">d</span>
      </span>
      <div className="leading-none">
        <p className="font-display text-[17px] font-800 tracking-tight">
          drea<span className="text-primary">.mar</span>
        </p>
        <p className="mt-0.5 text-[10px] font-600 uppercase tracking-[0.18em] text-muted-foreground">Platforma agențiilor</p>
      </div>
    </Link>
  );
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { live } = useWorkspace();
  const { clients } = useClients();

  // In live mode show the real Clients count and hide the sample Tasks/
  // Approvals badges (those pages aren't wired to live data yet).
  function badgeFor(item: NavItem): string | number | undefined {
    if (!live) return item.badge;
    if (item.to === "/clients") return clients.length || undefined;
    if (item.to === "/tasks" || item.to === "/approvals") return undefined;
    return item.badge;
  }

  return (
    <aside className="flex h-full w-[264px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Agency switcher */}
      <AgencySwitcher />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {navGroups.map((group) => (
          <div key={group.heading}>
            <p className="px-3 pb-2 text-[10px] font-700 uppercase tracking-[0.16em] text-muted-foreground/70">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-600 transition",
                      isActive
                        ? "bg-sidebar-accent text-primary shadow-soft"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  {({ isActive }) => {
                    const badge = badgeFor(item);
                    return (
                    <>
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary")} />
                      <span className="flex-1">{item.label}</span>
                      {badge != null && (
                        <Badge tone={isActive ? "primary" : "neutral"} className="px-1.5 py-0.5 text-[10px]">
                          {badge}
                        </Badge>
                      )}
                    </>
                    );
                  }}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade card */}
      <div className="px-3 pb-3">
        <div className="gradient-hero relative overflow-hidden rounded-xl p-4 text-white">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-xl" />
          <Sparkles className="h-5 w-5" />
          <p className="mt-2 text-sm font-700">Deblochează Camera de strategie AI</p>
          <p className="mt-0.5 text-[11px] text-white/70">Treci la planul Unlimited pentru rapoarte personalizate cu brandul tău și monitorizarea concurenței.</p>
          <button onClick={() => { onClose?.(); navigate("/billing"); }} className="mt-3 w-full rounded-lg bg-white px-3 py-2 text-xs font-700 text-[hsl(252_70%_30%)] transition hover:bg-white/90">
            Schimbă planul
          </button>
        </div>
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <button onClick={() => { signOut(); navigate("/login"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-600 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <LogOut className="h-[18px] w-[18px]" />
          Deconectare
        </button>
      </div>
    </aside>
  );
}

function AgencySwitcher() {
  const { agencies, currentAgency, switchAgency, branding } = useWorkspace();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative mx-3 mb-2" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-card px-3 py-2.5 text-left transition hover:bg-muted", open && "bg-muted")}
      >
        {branding.logoUrl ? (
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-border bg-card">
            <img src={branding.logoUrl} alt={currentAgency.name} className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-xs font-800 text-white", currentAgency.gradient)}>
            {currentAgency.initials}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-700">{currentAgency.name}</span>
          <span className="block text-[11px] text-muted-foreground">{currentAgency.plan}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 animate-scale-in panel overflow-hidden p-1.5">
          <p className="px-2.5 py-1.5 text-[10px] font-700 uppercase tracking-wide text-muted-foreground">Schimbă spațiul de lucru</p>
          {agencies.map((a) => (
            <button
              key={a.id}
              onClick={() => { switchAgency(a.id); setOpen(false); if (a.id !== currentAgency.id) push({ tone: "info", title: `Ai trecut la ${a.name}`, description: a.plan }); }}
              className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition", a.id === currentAgency.id ? "bg-sidebar-accent" : "hover:bg-muted")}
            >
              <span className={cn("grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-[10px] font-800 text-white", a.gradient)}>{a.initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-600">{a.name}</span>
                <span className="block text-[10px] text-muted-foreground">{a.plan}</span>
              </span>
              {a.id === currentAgency.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button onClick={() => { setOpen(false); push({ tone: "info", title: "Creează agenție", description: "Gestionezi mai multe agenții dintr-un singur cont — în curând." }); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-600 text-primary transition hover:bg-muted">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-primary/40 text-primary">+</span>
            Creează agenție
          </button>
        </div>
      )}
    </div>
  );
}
