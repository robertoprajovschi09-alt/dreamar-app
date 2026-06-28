import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Info, X, AlertTriangle } from "lucide-react";

type ToastTone = "success" | "info" | "warning" | "danger";
type Toast = { id: number; title: string; description?: string; tone: ToastTone };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);
let counter = 1;

const toneMeta: Record<ToastTone, { icon: typeof Check; cls: string }> = {
  success: { icon: Check, cls: "text-success bg-success/12" },
  info: { icon: Info, cls: "text-info bg-info/12" },
  warning: { icon: AlertTriangle, cls: "text-[hsl(var(--warning))] bg-warning/15" },
  danger: { icon: X, cls: "text-danger bg-danger/12" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (t: Omit<Toast, "id">) => {
    const id = counter++;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3600);
  };

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[200] flex w-[340px] max-w-[92vw] flex-col gap-2">
          {toasts.map((t) => {
            const M = toneMeta[t.tone];
            return (
              <div key={t.id} className="panel flex items-start gap-3 p-3.5 animate-scale-in">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${M.cls}`}>
                  <M.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-700">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
