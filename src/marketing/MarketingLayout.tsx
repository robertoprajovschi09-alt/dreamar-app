import { Link, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

// Public-site chrome for an internal tool: a wordmark, a theme toggle and one
// button into the app. No marketing nav, no signup.

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 pl-1">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background">
        <span className="font-display text-sm font-600">d</span>
      </span>
      <span className="font-display text-[15px] font-600 tracking-tight">
        drea<span className="text-muted-foreground">.mar</span>
      </span>
    </Link>
  );
}

export function MarketingLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div className="marketing-root min-h-screen bg-background text-foreground">
      {/* Floating pill navigation */}
      <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
        <div className="glass-pill flex h-12 w-full max-w-2xl items-center justify-between gap-2 rounded-full pl-2 pr-1.5">
          <Wordmark />
          <div className="flex items-center gap-1">
            <button onClick={toggle} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:text-foreground" aria-label="Comută tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/dashboard" className="rounded-full bg-foreground px-4 py-1.5 text-[13px] font-500 text-background transition duration-200 motion-safe:hover:-translate-y-px">
              Deschide aplicația
            </Link>
          </div>
        </div>
      </header>

      <Outlet />

      {/* Slim, single-row footer */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-12 text-sm md:flex-row">
          <Wordmark />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
            <Link to="/admin/login" className="link-u transition hover:text-foreground">Admin</Link>
          </nav>
          <p className="text-[13px] text-muted-foreground">© 2026 drea.mar</p>
        </div>
      </footer>
    </div>
  );
}
