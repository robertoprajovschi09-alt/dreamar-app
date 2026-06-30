import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Check } from "lucide-react";

const THRESHOLD = 92;

// Drag the card right to fire the action (Linear/Superhuman). Tap = onClick.
// Optimistic: once fired, the row animates out and onSwipe runs.
export function SwipeRow({ children, onSwipe, label = "Gata", onClick }: {
  children: ReactNode;
  onSwipe?: () => void;
  label?: string;
  onClick?: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  function down(e: PointerEvent) {
    if (!onSwipe) return;
    startX.current = e.clientX; moved.current = false;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (startX.current == null) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 4) moved.current = true;
    setDx(Math.max(0, Math.min(d, 140)));
  }
  function up(e: PointerEvent) {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (startX.current == null) return;
    const passed = dx > THRESHOLD;
    startX.current = null;
    if (passed && onSwipe) { setGone(true); window.setTimeout(() => onSwipe(), 170); }
    else setDx(0);
  }

  if (gone) return null;
  const progress = Math.min(dx / THRESHOLD, 1);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {onSwipe && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-success pl-4 text-white" style={{ width: `${Math.max(dx, 0)}px`, opacity: progress }}>
          <Check className="h-5 w-5 shrink-0" />
          {dx > 60 && <span className="ml-2 whitespace-nowrap text-sm font-700">{label}</span>}
        </div>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); startX.current = null; setDx(0); }}
        onClick={() => { if (!moved.current) onClick?.(); }}
        className="relative touch-pan-y select-none"
        style={{ transform: `translateX(${dx}px)`, transition: startX.current == null ? "transform .18s ease" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}
