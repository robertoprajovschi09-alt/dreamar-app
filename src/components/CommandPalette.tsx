import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { allDestinations } from "@/lib/nav";
import { nicheLabels } from "@/data/sample";
import { useClients } from "@/lib/clients";
import { cn } from "@/lib/utils";
import { CornerDownLeft, FileText, Keyboard, Plus, Search, UserPlus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Cmd = { id: string; label: string; hint?: string; group: string; icon: LucideIcon; run: () => void };

export function CommandPalette({ open, onClose, onNewClient, onShortcuts }: { open: boolean; onClose: () => void; onNewClient: () => void; onShortcuts: () => void }) {
  const navigate = useNavigate();
  const { clients } = useClients(); // live (agency-scoped) clients, or sample in demo
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Cmd[] = useMemo(() => {
    const go = (to: string) => () => { navigate(to); onClose(); };
    const actions: Cmd[] = [
      { id: "new-client", label: "Adaugă un client nou", hint: "Acțiune", group: "Acțiuni", icon: UserPlus, run: () => { onClose(); onNewClient(); } },
      { id: "new-report", label: "Generează raportul lunar", hint: "Acțiune", group: "Acțiuni", icon: FileText, run: go("/reports") },
      { id: "new-post", label: "Programează o postare", hint: "Acțiune", group: "Acțiuni", icon: Plus, run: go("/calendar") },
      { id: "shortcuts", label: "Scurtături de tastatură", hint: "?", group: "Acțiuni", icon: Keyboard, run: () => { onClose(); onShortcuts(); } },
    ];
    const nav: Cmd[] = allDestinations.map((it) => ({ id: "nav-" + it.to, label: it.label, group: "Navighează", icon: it.icon, run: go(it.to) }));
    const cli: Cmd[] = clients.map((c) => ({ id: "client-" + c.id, label: c.name, hint: nicheLabels[c.niche], group: "Clienți", icon: Users, run: go(`/clients/${c.id}`) }));
    return [...actions, ...nav, ...cli];
  }, [navigate, onClose, onNewClient, onShortcuts, clients]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(s) || c.hint?.toLowerCase().includes(s));
  }, [q, commands]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  // flat order matching render for keyboard nav
  const flat = Object.values(groups).flat();

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); flat[active]?.run(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  let idx = -1;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-scale-in panel overflow-hidden" onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută clienți, pagini, acțiuni…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-600 text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Niciun rezultat pentru „{q}”.</p>}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-3 py-1.5 text-[10px] font-700 uppercase tracking-[0.14em] text-muted-foreground/70">{group}</p>
              {items.map((c) => {
                idx++;
                const isActive = idx === active;
                const myIdx = idx;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setActive(myIdx)}
                    onClick={c.run}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition", isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                      <c.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 font-600 text-foreground">{c.label}</span>
                    {c.hint && <span className="text-[11px] text-muted-foreground">{c.hint}</span>}
                    {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
