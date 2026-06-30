import { createPortal } from "react-dom";
import { useUI } from "@/lib/ui-context";
import { useToast } from "@/lib/toast";
import { BarChart3, Lightbulb, Send, Sparkles, UserPlus } from "lucide-react";

export function QuickActionSheet({ open, onClose, onGoInbox }: { open: boolean; onClose: () => void; onGoInbox: () => void }) {
  const { openNewClient } = useUI();
  const { push } = useToast();

  if (!open) return null;

  const actions = [
    { icon: Lightbulb, label: "Idee rapidă", run: () => { onClose(); push({ tone: "info", title: "Idee rapidă — în curând", description: "Vei putea nota idei pe telefon, cu voce." }); } },
    { icon: Send, label: "Trimite spre aprobare", run: () => { onClose(); onGoInbox(); } },
    { icon: BarChart3, label: "Loghează un rezultat", run: () => { onClose(); push({ tone: "info", title: "În curând" }); } },
    { icon: UserPlus, label: "Client nou", run: () => { onClose(); openNewClient(); } },
    { icon: Sparkles, label: "Întreabă AI", run: () => { onClose(); push({ tone: "info", title: "AI — în curând" }); } },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 animate-scale-in rounded-t-3xl border-t border-border bg-card p-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <div className="space-y-1">
          {actions.map((a) => (
            <button key={a.label} onClick={a.run} className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition active:bg-muted">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><a.icon className="h-5 w-5" /></span>
              <span className="text-sm font-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
