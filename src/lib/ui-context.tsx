import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NewClientModal } from "@/components/NewClientModal";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { useTheme } from "@/lib/theme";

type UICtx = { openNewClient: () => void; openCommand: () => void; openShortcuts: () => void };
const Ctx = createContext<UICtx | null>(null);

// G-then-key jumps, locked to the nine-item inventory.
const goMap: Record<string, string> = {
  d: "/dashboard", p: "/pipeline", b: "/money", c: "/clients", l: "/calendar",
  s: "/scripts", k: "/kill-list", a: "/agency", e: "/settings",
};

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

export function UIProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { toggle } = useTheme();
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<number>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // ⌘K / Ctrl+K - command palette
      if ((e.metaKey || e.ctrlKey) && k === "k") { e.preventDefault(); setCommandOpen((o) => !o); return; }
      // ⌘⇧L / Ctrl+Shift+L - toggle theme
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === "l") { e.preventDefault(); toggle(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      // ? - shortcuts panel
      if (e.key === "?") { e.preventDefault(); setShortcutsOpen(true); return; }
      // G then <key> - navigate
      if (pendingG.current) {
        pendingG.current = false;
        const to = goMap[k];
        if (to) { e.preventDefault(); navigate(to); }
        return;
      }
      if (k === "g") {
        pendingG.current = true;
        window.clearTimeout(gTimer.current);
        gTimer.current = window.setTimeout(() => { pendingG.current = false; }, 900);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, toggle]);

  return (
    <Ctx.Provider value={{ openNewClient: () => setNewClientOpen(true), openCommand: () => setCommandOpen(true), openShortcuts: () => setShortcutsOpen(true) }}>
      {children}
      <NewClientModal open={newClientOpen} onClose={() => setNewClientOpen(false)} />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onNewClient={() => setNewClientOpen(true)} onShortcuts={() => setShortcutsOpen(true)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </Ctx.Provider>
  );
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
