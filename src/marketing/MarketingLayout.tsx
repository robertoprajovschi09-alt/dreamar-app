import { Link, NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
        <span className="font-display text-base font-800">d</span>
      </span>
      <span className="font-display text-[17px] font-800 tracking-tight">
        drea<span className="text-muted-foreground">.mar</span>
      </span>
    </Link>
  );
}

const navItems = [
  { label: "Produs", to: "/#produs" },
  { label: "Portalul clientului", to: "/#clienti" },
  { label: "Prețuri", to: "/pricing" },
];

export function MarketingLayout() {
  const { theme, toggle } = useTheme();
  const { isAuthed } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map((n) => (
              <a key={n.label} href={n.to} className="text-sm font-600 text-muted-foreground transition hover:text-foreground">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground" aria-label="Comută tema">
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            {isAuthed ? (
              <Link to="/dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm font-700 text-primary-foreground transition hover:brightness-110">
                Deschide aplicația →
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-600 text-muted-foreground transition hover:text-foreground sm:block">
                  Autentificare
                </Link>
                <Link to="/signup" className="rounded-lg bg-primary px-4 py-2 text-sm font-700 text-primary-foreground transition hover:brightness-110">
                  Începe gratuit
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Wordmark />
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Sistemul de operare al agenției tale — clienți, conținut, aprobări și rezultate, într-un singur loc.
              </p>
            </div>
            <FooterCol title="Produs" links={[["Produs", "/#produs"], ["Portalul clientului", "/#clienti"], ["Prețuri", "/pricing"], ["Autentificare", "/login"]]} />
            <FooterCol title="Companie" links={[["Despre noi", "/#"], ["Cariere", "/#"], ["Contact", "/#"], ["Blog", "/#"]]} />
            <FooterCol title="Legal" links={[["Confidențialitate", "/#"], ["Termeni", "/#"], ["Securitate", "/#"], ["GDPR", "/#"]]} />
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>© 2026 drea.mar — toate drepturile rezervate.</span>
            <div className="flex items-center gap-4">
              <span>Creat pentru agențiile din UE · Prețuri în EUR</span>
              <Link to="/admin/login" className="transition hover:text-foreground">Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-700 uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, to]) => (
          <li key={label}>
            <a href={to} className="text-sm text-muted-foreground transition hover:text-foreground">{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const marketingActiveClass = (isActive: boolean) => cn(isActive && "text-foreground");
