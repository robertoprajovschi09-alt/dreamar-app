import { Link } from "react-router-dom";
import { Check, Clapperboard, ScrollText, Target, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The Strateg's action blocks. In an assistant reply, fenced code blocks labeled
 * script / obiectiv / clip render as cards with a save action, not as code.
 * Invalid JSON falls back to plain text - never a crash.
 */

export type BlockKind = "script" | "obiectiv" | "clip";
export type ScriptBlock = { titlu: string; client?: string; hook?: string; desfasurare?: string; cta?: string };
export type ObiectivBlock = { titlu: string; descriere?: string };
export type ClipBlock = { titlu: string; client?: string };
export type Segment =
  | { kind: "text"; text: string }
  | { kind: BlockKind; data: ScriptBlock | ObiectivBlock | ClipBlock }
  | { kind: "actiuni"; ops: unknown[] };

const FENCE = /```(script|obiectiv|clip|actiuni)\s*\n([\s\S]*?)```/g;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function valid(kind: BlockKind, v: any): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  if (typeof v.titlu !== "string" || !v.titlu.trim()) return false;
  return true;
}

export function parseSegments(content: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of content.matchAll(FENCE)) {
    const [whole, kind, body] = m;
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", text: content.slice(last, idx) });
    let parsed: unknown = null;
    try { parsed = JSON.parse(body.trim()); } catch { parsed = null; }
    if (kind === "actiuni") {
      if (Array.isArray(parsed) && parsed.length > 0) out.push({ kind: "actiuni", ops: parsed });
      else out.push({ kind: "text", text: body.trim() }); // invalid JSON: plain text, no crash
    } else if (parsed && valid(kind as BlockKind, parsed)) {
      out.push({ kind: kind as BlockKind, data: parsed as ScriptBlock & ObiectivBlock & ClipBlock });
    } else {
      out.push({ kind: "text", text: body.trim() }); // invalid JSON: plain text, no crash
    }
    last = idx + whole.length;
  }
  if (last < content.length) out.push({ kind: "text", text: content.slice(last) });
  return out;
}

// Streaming-safe parse: complete fenced blocks become segments as usual, but an
// UNCLOSED fence at the tail is cut off and reported via `open`, so raw JSON /
// ``` guards never hit the screen mid-stream. Stray trailing backticks (a fence
// arriving character by character) are hidden too.
export function parseStreaming(content: string): { segments: Segment[]; open: "actiuni" | "bloc" | null } {
  // Fences don't nest: walk all ``` delimiters; odd count = last one opens a block.
  const re = /```(\w*)/g;
  let open = false, openStart = -1, openLabel = "";
  for (const m of content.matchAll(re)) {
    if (!open) { open = true; openStart = m.index ?? 0; openLabel = m[1] || ""; }
    else { open = false; openStart = -1; openLabel = ""; }
  }
  if (open && openStart >= 0) {
    return { segments: parseSegments(content.slice(0, openStart)), open: openLabel === "actiuni" ? "actiuni" : "bloc" };
  }
  const tail = content.match(/`{1,2}$/); // partial fence still streaming in
  const clean = tail ? content.slice(0, content.length - tail[0].length) : content;
  return { segments: parseSegments(clean), open: null };
}

const META: Record<BlockKind, { icon: LucideIcon; tag: string; action: string }> = {
  script: { icon: ScrollText, tag: "Script", action: "Salvează în Scripturi" },
  obiectiv: { icon: Target, tag: "Obiectiv", action: "Adaugă în Kill List" },
  clip: { icon: Clapperboard, tag: "Clip", action: "Creează clip în Idee" },
};

export type SavedRef = { label: string; to: string };

export function BlockCard({ kind, data, saved, busy, onSave, preview }: {
  kind: BlockKind;
  data: ScriptBlock & ObiectivBlock & ClipBlock;
  saved: SavedRef | null;
  busy: boolean;
  onSave: () => void;
  // Mid-stream preview: same card, but the save action is inert until the
  // message is final (nothing from `pending` may execute).
  preview?: boolean;
}) {
  const M = META[kind];
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[hsl(var(--strateg))]/35 bg-[hsl(var(--strateg))]/[0.05] animate-scale-in motion-reduce:animate-none">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--strateg))]/20 px-3 py-2">
        <M.icon className="h-4 w-4 text-[hsl(var(--strateg))]" />
        <span className="text-[11px] font-800 uppercase tracking-wide text-[hsl(var(--strateg))]">{M.tag}</span>
        {data.client && <span className="truncate text-xs text-muted-foreground">· {data.client}</span>}
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p className="text-sm font-700">{data.titlu}</p>
        {kind === "script" && (
          <>
            {data.hook && <p className="text-xs"><span className="font-700 text-muted-foreground">Hook: </span>{data.hook}</p>}
            {data.desfasurare && <p className="text-xs"><span className="font-700 text-muted-foreground">Desfășurare: </span>{data.desfasurare}</p>}
            {data.cta && <p className="text-xs"><span className="font-700 text-muted-foreground">CTA: </span>{data.cta}</p>}
          </>
        )}
        {kind === "obiectiv" && data.descriere && <p className="text-xs text-muted-foreground">{data.descriere}</p>}
      </div>
      <div className="border-t border-[hsl(var(--strateg))]/20 px-3 py-2">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-700 text-success">
            <Check className="h-3.5 w-3.5" /> {saved.label}
            <Link to={saved.to} className="ml-1 text-[hsl(var(--strateg))] underline">Deschide</Link>
          </span>
        ) : (
          <button onClick={preview ? undefined : onSave} disabled={busy || preview}
            className={cn("rounded-lg bg-[hsl(var(--strateg))] px-3 py-1.5 text-xs font-700 text-[hsl(var(--strateg-foreground))] transition hover:opacity-90 disabled:opacity-50")}>
            {M.action}
          </button>
        )}
      </div>
    </div>
  );
}
