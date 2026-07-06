import { useCallback } from "react";
import { useClips, type Clip, type ClipState } from "./clips";
import { useScripts, type Script } from "./scripts";
import { useKillList } from "./killlist";
import { useClients } from "./clients";

/*
 * The Strateg's action executor. The model proposes operations in an "actiuni"
 * block; NOTHING runs without the user's tap. This module validates every
 * operation against the schema, resolves objects (id first, then title+client,
 * never guessing when ambiguous) and executes.
 *
 * SAFETY, independent of the AI:
 *  - deletions are capped at 10 per block, the block at 20 operations;
 *  - an operation on a missing object fails cleanly with a message;
 *  - this module has NO import from the money layer, so it cannot touch Bani
 *    even by bug. Forbidden by absence: money writes, marking Postat/Încasat,
 *    client edits, Kill List condition changes.
 */

export type OpKind =
  | "creeaza_clip" | "muta_clip" | "seteaza_zi_filmare" | "creeaza_script"
  | "schimba_status_script" | "creeaza_obiectiv" | "sterge_clip" | "sterge_script";

export const SAFE_OPS: OpKind[] = ["creeaza_clip", "creeaza_script", "creeaza_obiectiv", "seteaza_zi_filmare", "muta_clip"];
export const SENSITIVE_OPS: OpKind[] = ["sterge_clip", "sterge_script", "schimba_status_script"];
const ALL_OPS = new Set<string>([...SAFE_OPS, ...SENSITIVE_OPS]);

export const MAX_OPS_PER_BLOCK = 20;
export const MAX_DELETES_PER_BLOCK = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawOp = Record<string, any>;
export type ActionRow =
  | { idx: number; valid: true; kind: OpKind; raw: RawOp; summary: string }
  | { idx: number; valid: false; kind: OpKind | null; raw: RawOp; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STAGE_TO_STATE: Record<string, ClipState> = {
  "idee": "idea", "de filmat": "to_film", "filmat": "filmed", "editat": "edited", "programat": "scheduled",
};
const STATUS_TO_KEY: Record<string, "works" | "dead"> = { "funcționează": "works", "functioneaza": "works", "mort": "dead" };
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short" }).replace(".", "");

function hasRef(o: RawOp): boolean { return isStr(o.id) || isStr(o.titlu); }

// Row summary shown in the checklist (Romanian, short).
function summarize(o: RawOp, kind: OpKind): string {
  const t = isStr(o.titlu) ? `„${o.titlu}"` : `#${String(o.id ?? "").slice(0, 8)}`;
  const cl = isStr(o.client) ? ` la ${o.client}` : "";
  switch (kind) {
    case "creeaza_clip": return `Creează clipul ${t}${cl} în ${o.etapa || "Idee"}${isStr(o.zi_filmare) ? `, zi de filmare ${fmtDay(o.zi_filmare)}` : ""}`;
    case "muta_clip": return `Mută clipul ${t} în ${o.etapa_noua}${isStr(o.data) ? ` (${fmtDay(o.data)})` : ""}`;
    case "seteaza_zi_filmare": return `Setează zi de filmare ${isStr(o.data) ? fmtDay(o.data) : "?"} pentru ${t}`;
    case "creeaza_script": return `Creează scriptul ${t}${cl}`;
    case "schimba_status_script": return `Marchează scriptul ${t} ca ${o.status}`;
    case "creeaza_obiectiv": return `Adaugă obiectivul ${t} în Kill List`;
    case "sterge_clip": return `Șterge clipul ${t}`;
    case "sterge_script": return `Șterge scriptul ${t}`;
  }
}

function validateOne(o: RawOp): { ok: true; kind: OpKind } | { ok: false; kind: OpKind | null; error: string } {
  if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, kind: null, error: "Operație invalidă." };
  const kind = String(o.op ?? "");
  if (!ALL_OPS.has(kind)) return { ok: false, kind: null, error: "Operație necunoscută sau nepermisă." };
  const k = kind as OpKind;
  switch (k) {
    case "creeaza_clip":
      if (!isStr(o.titlu)) return { ok: false, kind: k, error: "Lipsește titlul." };
      if (isStr(o.etapa) && !["idee", "de filmat"].includes(norm(o.etapa))) return { ok: false, kind: k, error: "Etapa la creare poate fi doar Idee sau De filmat." };
      if (o.zi_filmare !== undefined && (!isStr(o.zi_filmare) || !DATE_RE.test(o.zi_filmare))) return { ok: false, kind: k, error: "Zi de filmare invalidă (YYYY-MM-DD)." };
      return { ok: true, kind: k };
    case "muta_clip": {
      if (!hasRef(o)) return { ok: false, kind: k, error: "Lipsește id-ul sau titlul clipului." };
      const stage = norm(o.etapa_noua);
      if (stage === "postat") return { ok: false, kind: k, error: "Mutarea în Postat o confirmi doar tu, cu mâna ta." };
      if (!STAGE_TO_STATE[stage]) return { ok: false, kind: k, error: "Etapă necunoscută." };
      if (STAGE_TO_STATE[stage] === "scheduled" && (!isStr(o.data) || !DATE_RE.test(o.data))) return { ok: false, kind: k, error: "Mutarea în Programat are nevoie de o dată (YYYY-MM-DD)." };
      return { ok: true, kind: k };
    }
    case "seteaza_zi_filmare":
      if (!hasRef(o)) return { ok: false, kind: k, error: "Lipsește id-ul sau titlul clipului." };
      if (!isStr(o.data) || !DATE_RE.test(o.data)) return { ok: false, kind: k, error: "Dată invalidă (YYYY-MM-DD)." };
      return { ok: true, kind: k };
    case "creeaza_script":
      if (!isStr(o.titlu)) return { ok: false, kind: k, error: "Lipsește titlul." };
      return { ok: true, kind: k };
    case "schimba_status_script":
      if (!hasRef(o)) return { ok: false, kind: k, error: "Lipsește id-ul sau titlul scriptului." };
      if (!STATUS_TO_KEY[norm(o.status)]) return { ok: false, kind: k, error: "Statusul poate fi doar Funcționează sau Mort." };
      return { ok: true, kind: k };
    case "creeaza_obiectiv":
      if (!isStr(o.titlu)) return { ok: false, kind: k, error: "Lipsește titlul." };
      return { ok: true, kind: k };
    case "sterge_clip":
    case "sterge_script":
      if (!hasRef(o)) return { ok: false, kind: k, error: "Lipsește id-ul sau titlul." };
      return { ok: true, kind: k };
  }
}

// Validate a whole block: schema per row + the 20-ops and 10-deletes caps.
export function validateBlock(raw: unknown): ActionRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  let deletes = 0;
  return raw.map((o, idx) => {
    const r = validateOne(o as RawOp);
    if (!r.ok) return { idx, valid: false as const, kind: r.kind, raw: o as RawOp, error: r.error };
    if (idx >= MAX_OPS_PER_BLOCK) return { idx, valid: false as const, kind: r.kind, raw: o as RawOp, error: `Peste plafonul de ${MAX_OPS_PER_BLOCK} operații per bloc.` };
    if (r.kind === "sterge_clip" || r.kind === "sterge_script") {
      deletes += 1;
      if (deletes > MAX_DELETES_PER_BLOCK) return { idx, valid: false as const, kind: r.kind, raw: o as RawOp, error: `Plafon ${MAX_DELETES_PER_BLOCK} ștergeri per bloc.` };
    }
    return { idx, valid: true as const, kind: r.kind, raw: o as RawOp, summary: summarize(o as RawOp, r.kind) };
  });
}

/* ── resolution + execution ──────────────────────────────────────────────── */
export type Candidate = { id: string; label: string };
export type Resolution =
  | { kind: "none" }                                  // op creates something; nothing to resolve
  | { kind: "ok"; id: string }
  | { kind: "ambiguous"; candidates: Candidate[] }    // "alege obiectul"
  | { kind: "missing"; error: string };
export type ExecResult = { ok: true; label: string; to?: string } | { ok: false; error: string };

export function useActionExecutor() {
  const { clips, createClip, updateClip, deleteClip } = useClips();
  const { scripts, createScript, updateScript, deleteScript } = useScripts();
  const { addCustomItem } = useKillList();
  const { clients } = useClients();

  const findClient = useCallback((name?: string | null): string | null => {
    if (!isStr(name)) return null;
    const q = norm(name);
    const hit = clients.find((c) => norm(c.name) === q) ?? clients.find((c) => norm(c.name).includes(q));
    return hit?.id ?? null;
  }, [clients]);

  const resolveIn = useCallback(<T extends { id: string }>(pool: T[], raw: RawOp, label: (t: T) => string, clientOf: (t: T) => string): Resolution => {
    if (isStr(raw.id)) {
      const hit = pool.find((x) => x.id === raw.id.trim());
      if (hit) return { kind: "ok", id: hit.id };
      if (!isStr(raw.titlu)) return { kind: "missing", error: "Obiectul nu există (id negăsit)." };
    }
    const q = norm(raw.titlu);
    if (!q) return { kind: "missing", error: "Obiectul nu există." };
    let cands = pool.filter((x) => norm(label(x)) === q);
    if (isStr(raw.client)) {
      const cq = norm(raw.client);
      const scoped = cands.filter((x) => norm(clientOf(x)).includes(cq));
      if (scoped.length > 0) cands = scoped;
    }
    if (cands.length === 1) return { kind: "ok", id: cands[0].id };
    if (cands.length > 1) return { kind: "ambiguous", candidates: cands.map((x) => ({ id: x.id, label: `${label(x)} · ${clientOf(x)}` })) };
    return { kind: "missing", error: "Nu am găsit obiectul după titlu." };
  }, []);

  const resolve = useCallback((row: ActionRow): Resolution => {
    if (!row.valid) return { kind: "missing", error: row.error };
    switch (row.kind) {
      case "creeaza_clip": case "creeaza_script": case "creeaza_obiectiv":
        return { kind: "none" };
      case "muta_clip": case "seteaza_zi_filmare": case "sterge_clip":
        return resolveIn<Clip>(clips, row.raw, (c) => c.title, (c) => c.clientName);
      case "schimba_status_script": case "sterge_script":
        return resolveIn<Script>(scripts, row.raw, (s) => s.title, (s) => s.clientName);
    }
  }, [clips, scripts, resolveIn]);

  // Execute ONE already-validated row (resolvedId comes from resolve or the
  // user's pick in the mini-selector). Returns the journal label + link.
  const execute = useCallback(async (row: ActionRow, resolvedId: string | null): Promise<ExecResult> => {
    if (!row.valid) return { ok: false, error: row.error };
    const o = row.raw;
    try {
      switch (row.kind) {
        case "creeaza_clip": {
          const clientId = findClient(o.client);
          const state: ClipState = STAGE_TO_STATE[norm(o.etapa)] ?? "idea";
          const res = await createClip({ clientId, title: String(o.titlu).trim(), state, filmDate: isStr(o.zi_filmare) ? o.zi_filmare : null });
          if (res.error) return { ok: false, error: "Nu am putut crea clipul." };
          const cl = clientId ? ` la ${clients.find((c) => c.id === clientId)?.name ?? o.client}` : "";
          return { ok: true, label: `creat clipul „${o.titlu}"${cl}${isStr(o.zi_filmare) ? `, zi de filmare ${fmtDay(o.zi_filmare)}` : ""}`, to: clientId ? `/pipeline?client=${clientId}` : "/pipeline" };
        }
        case "muta_clip": {
          const clip = clips.find((c) => c.id === resolvedId);
          if (!clip) return { ok: false, error: "Clipul nu mai există." };
          const state = STAGE_TO_STATE[norm(o.etapa_noua)];
          const res = await updateClip(clip.id, { state, scheduledDate: state === "scheduled" ? o.data : null });
          if (res.error) return { ok: false, error: "Nu am putut muta clipul." };
          return { ok: true, label: `mutat clipul „${clip.title}" în ${o.etapa_noua}${state === "scheduled" ? ` (${fmtDay(o.data)})` : ""}`, to: clip.clientId ? `/pipeline?client=${clip.clientId}` : "/pipeline" };
        }
        case "seteaza_zi_filmare": {
          const clip = clips.find((c) => c.id === resolvedId);
          if (!clip) return { ok: false, error: "Clipul nu mai există." };
          const res = await updateClip(clip.id, { filmDate: o.data });
          if (res.error) return { ok: false, error: "Nu am putut seta ziua de filmare." };
          return { ok: true, label: `setat zi de filmare ${fmtDay(o.data)} pentru clipul „${clip.title}"`, to: "/calendar" };
        }
        case "creeaza_script": {
          const clientId = findClient(o.client);
          const res = await createScript({ clientId, title: String(o.titlu).trim(), hook: isStr(o.hook) ? o.hook : "", body: isStr(o.desfasurare) ? o.desfasurare : "", cta: isStr(o.cta) ? o.cta : "", status: "to_test" });
          if (res.error) return { ok: false, error: "Nu am putut crea scriptul." };
          const cl = clientId ? ` la ${clients.find((c) => c.id === clientId)?.name ?? o.client}` : "";
          return { ok: true, label: `creat scriptul „${o.titlu}"${cl}`, to: "/scripts" };
        }
        case "schimba_status_script": {
          const script = scripts.find((s) => s.id === resolvedId);
          if (!script) return { ok: false, error: "Scriptul nu mai există." };
          const res = await updateScript(script.id, { status: STATUS_TO_KEY[norm(o.status)] });
          if (res.error) return { ok: false, error: "Nu am putut schimba statusul." };
          return { ok: true, label: `marcat scriptul „${script.title}" ca ${o.status}`, to: "/scripts" };
        }
        case "creeaza_obiectiv": {
          addCustomItem(String(o.titlu).trim(), isStr(o.descriere) ? o.descriere : "");
          return { ok: true, label: `adăugat obiectivul „${o.titlu}" în Kill List`, to: "/kill-list" };
        }
        case "sterge_clip": {
          const clip = clips.find((c) => c.id === resolvedId);
          if (!clip) return { ok: false, error: "Clipul nu mai există." };
          const res = await deleteClip(clip.id);
          if (res.error) return { ok: false, error: "Nu am putut șterge clipul." };
          return { ok: true, label: `șters clipul „${clip.title}"` };
        }
        case "sterge_script": {
          const script = scripts.find((s) => s.id === resolvedId);
          if (!script) return { ok: false, error: "Scriptul nu mai există." };
          const res = await deleteScript(script.id);
          if (res.error) return { ok: false, error: "Nu am putut șterge scriptul." };
          return { ok: true, label: `șters scriptul „${script.title}"` };
        }
      }
    } catch {
      return { ok: false, error: "Operația a picat neașteptat." };
    }
  }, [clips, scripts, clients, findClient, createClip, updateClip, deleteClip, createScript, updateScript, deleteScript, addCustomItem]);

  return { resolve, execute, findClient, createClip, createScript, addCustomItem };
}
