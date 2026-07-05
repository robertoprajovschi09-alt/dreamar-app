import { Modal } from "@/components/overlay";

const groups = [
  {
    title: "General",
    items: [
      { keys: ["⌘", "K"], label: "Deschide paleta de comenzi" },
      { keys: ["?"], label: "Afișează acest panou de scurtături" },
      { keys: ["⌘", "⇧", "L"], label: "Comută între modul luminos și întunecat" },
      { keys: ["Esc"], label: "Închide orice dialog sau meniu" },
    ],
  },
  {
    title: "Mergi la, apasă G apoi…",
    items: [
      { keys: ["G", "D"], label: "Azi" },
      { keys: ["G", "P"], label: "Pipeline" },
      { keys: ["G", "B"], label: "Bani" },
      { keys: ["G", "C"], label: "Clienți" },
      { keys: ["G", "L"], label: "Calendar" },
      { keys: ["G", "S"], label: "Scripturi" },
      { keys: ["G", "K"], label: "Kill List" },
      { keys: ["G", "A"], label: "Agenție" },
      { keys: ["G", "E"], label: "Setări" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="grid h-6 min-w-6 place-items-center rounded-md border border-border bg-muted px-1.5 text-[11px] font-700 text-foreground shadow-soft">
      {children}
    </kbd>
  );
}

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Scurtături de tastatură" subtitle="Navighează prin drea.mar fără să pui mâna pe mouse" size="md">
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[10px] font-700 uppercase tracking-[0.14em] text-muted-foreground/70">{g.title}</p>
            <div className="space-y-1">
              {g.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/50">
                  <span className="text-sm">{it.label}</span>
                  <span className="flex items-center gap-1">
                    {it.keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
