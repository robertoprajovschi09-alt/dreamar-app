import { Button, IconButton } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useUI } from "@/lib/ui-context";
import { NotificationsBell } from "@/components/NotificationsBell";
import { UserMenu } from "@/components/UserMenu";
import { DateRangeMenu } from "@/components/DateRangeMenu";
import { Menu, Moon, Search, Sparkles, Sun } from "lucide-react";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { openCommand } = useUI();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <button onClick={onMenu} className="lg:hidden text-muted-foreground hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>

      {/* Search → command palette */}
      <button onClick={openCommand} className="relative hidden flex-1 max-w-md items-center md:flex">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="flex h-10 w-full items-center rounded-lg border border-input bg-muted/40 pl-10 pr-16 text-sm text-muted-foreground">
          Caută clienți, videoclipuri, rapoarte…
        </span>
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-600 text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <DateRangeMenu />

        <Button variant="primary" size="md" className="hidden sm:inline-flex" onClick={openCommand}>
          <Sparkles className="h-4 w-4" /> Asistent AI
        </Button>

        <IconButton onClick={toggle} aria-label="Comută tema">
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </IconButton>

        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
