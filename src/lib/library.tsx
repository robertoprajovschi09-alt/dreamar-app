import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { videos as sampleVideos, hooks as sampleHooks, nicheLabels, type VideoRow } from "@/data/sample";

export type HookRow = { id: string; text: string; niche: string; platform: string; uses: number; avgScore: number; pattern: string; result: string };

export type NewVideoInput = {
  clientId: string; hook: string; platform: string; date: string | null;
  format: string; views: number; aiScore: number | null; rec: "repeat" | "improve" | "stop";
};
export type VideoPatch = {
  hook?: string; format?: string; platform?: string; views?: number; reach?: number;
  aiScore?: number | null; rec?: "repeat" | "improve" | "stop";
  retention3s?: number; completion?: number; likes?: number; comments?: number; shares?: number; saves?: number; dms?: number;
};
export type NewHookInput = { text: string; niche: string | null; platform: string; pattern: string; result: string };
export type HookPatch = { text?: string; niche?: string | null; platform?: string; pattern?: string; result?: string };

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube",
  linkedin: "LinkedIn", twitter: "Twitter", whatsapp: "WhatsApp",
};

const VIDEO_COLS =
  "id, client_id, hook, platform, publish_date, video_format, views, reach, watch_time_seconds, duration_seconds, retention_3s_pct, retention_50_pct, completion_rate_pct, likes, comments, shares, saves, dms, calls, body_angle, cta, objective, estimated_sales_impact, client_feedback, ai_insight, ai_score, recommendation, client:clients(name)";

const n = (v: unknown) => Number(v ?? 0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVideo(r: any): VideoRow {
  return {
    id: r.id,
    client: r.client?.name ?? "—",
    platform: r.platform ? (PLATFORM_LABEL[r.platform] ?? r.platform) : "",
    date: r.publish_date ?? "",
    hook: r.hook ?? "",
    format: r.video_format ?? "",
    views: n(r.views), reach: n(r.reach), watchTime: n(r.watch_time_seconds), duration: n(r.duration_seconds),
    retention3s: n(r.retention_3s_pct), retention50: n(r.retention_50_pct), completion: n(r.completion_rate_pct),
    likes: n(r.likes), comments: n(r.comments), shares: n(r.shares), saves: n(r.saves), dms: n(r.dms), calls: n(r.calls),
    bodyAngle: r.body_angle ?? "", cta: r.cta ?? "", objective: r.objective ?? "",
    salesImpact: r.estimated_sales_impact ?? "—", feedback: r.client_feedback ?? "", aiInsight: r.ai_insight ?? "",
    aiScore: n(r.ai_score), rec: (r.recommendation ?? "improve") as VideoRow["rec"],
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHook(r: any): HookRow {
  return {
    id: r.id, text: r.text,
    niche: r.niche ? (nicheLabels[r.niche as keyof typeof nicheLabels] ?? r.niche) : "",
    platform: r.platform ? (PLATFORM_LABEL[r.platform] ?? r.platform) : "",
    uses: r.uses ?? 0,
    avgScore: r.avg_ai_score != null ? Math.round(Number(r.avg_ai_score)) : 0,
    pattern: r.pattern ?? "",
    result: r.result ?? "",
  };
}

type LibraryCtx = {
  videos: VideoRow[];
  hooks: HookRow[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createVideo: (input: NewVideoInput) => Promise<{ error?: string }>;
  updateVideo: (id: string, patch: VideoPatch) => Promise<{ error?: string }>;
  deleteVideo: (id: string) => Promise<{ error?: string }>;
  createHook: (input: NewHookInput) => Promise<{ error?: string }>;
  updateHook: (id: string, patch: HookPatch) => Promise<{ error?: string }>;
  deleteHook: (id: string) => Promise<{ error?: string }>;
};

const Ctx = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [videos, setVideos] = useState<VideoRow[]>(live ? [] : sampleVideos);
  const [hooks, setHooks] = useState<HookRow[]>(live ? [] : (sampleHooks as HookRow[]));
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const [v, h] = await Promise.all([
      supabase.from("videos").select(VIDEO_COLS).eq("agency_id", agencyId).order("publish_date", { ascending: false, nullsFirst: false }),
      supabase.from("hooks").select("id, text, niche, platform, pattern, result, uses, avg_ai_score").eq("agency_id", agencyId).order("uses", { ascending: false }),
    ]);
    if (agencyRef.current !== agencyId) return; // drop stale response after an agency switch
    if (v.error) console.error("[library] videos load failed:", v.error.message); else if (v.data) setVideos(v.data.map(mapVideo));
    if (h.error) console.error("[library] hooks load failed:", h.error.message); else if (h.data) setHooks(h.data.map(mapHook));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setVideos(sampleVideos); setHooks(sampleHooks as HookRow[]); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const createVideo = useCallback(async (input: NewVideoInput) => {
    if (!live || !supabase || !agencyId) return {};
    const { error } = await supabase.from("videos").insert({
      agency_id: agencyId, client_id: input.clientId, hook: input.hook,
      platform: input.platform ? input.platform.toLowerCase() : null,
      publish_date: input.date, video_format: input.format || null,
      views: input.views, ai_score: input.aiScore, recommendation: input.rec,
    });
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [live, agencyId, reload]);

  const createHook = useCallback(async (input: NewHookInput) => {
    if (!live || !supabase || !agencyId) return {};
    const { error } = await supabase.from("hooks").insert({
      agency_id: agencyId, text: input.text,
      niche: input.niche || null,
      platform: input.platform ? input.platform.toLowerCase() : null,
      pattern: input.pattern || null, result: input.result || null,
    });
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [live, agencyId, reload]);

  const deleteVideo = useCallback(async (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    if (live && supabase) { const { error } = await supabase.from("videos").delete().eq("id", id); if (error) return { error: error.message }; }
    return {};
  }, [live]);

  const updateVideo = useCallback(async (id: string, patch: VideoPatch) => {
    if (live && supabase) {
      const db: Record<string, unknown> = {};
      if (patch.hook !== undefined) db.hook = patch.hook;
      if (patch.format !== undefined) db.video_format = patch.format || null;
      if (patch.platform !== undefined) db.platform = patch.platform ? patch.platform.toLowerCase() : null;
      if (patch.views !== undefined) db.views = patch.views;
      if (patch.reach !== undefined) db.reach = patch.reach;
      if (patch.aiScore !== undefined) db.ai_score = patch.aiScore;
      if (patch.rec !== undefined) db.recommendation = patch.rec;
      if (patch.retention3s !== undefined) db.retention_3s_pct = patch.retention3s;
      if (patch.completion !== undefined) db.completion_rate_pct = patch.completion;
      if (patch.likes !== undefined) db.likes = patch.likes;
      if (patch.comments !== undefined) db.comments = patch.comments;
      if (patch.shares !== undefined) db.shares = patch.shares;
      if (patch.saves !== undefined) db.saves = patch.saves;
      if (patch.dms !== undefined) db.dms = patch.dms;
      const { error } = await supabase.from("videos").update(db).eq("id", id);
      if (error) return { error: error.message };
      await reload();
    } else {
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch, format: patch.format ?? v.format } as VideoRow : v)));
    }
    return {};
  }, [live, reload]);

  const deleteHook = useCallback(async (id: string) => {
    setHooks((prev) => prev.filter((h) => h.id !== id));
    if (live && supabase) { const { error } = await supabase.from("hooks").delete().eq("id", id); if (error) return { error: error.message }; }
    return {};
  }, [live]);

  const updateHook = useCallback(async (id: string, patch: HookPatch) => {
    if (live && supabase) {
      const db: Record<string, unknown> = {};
      if (patch.text !== undefined) db.text = patch.text;
      if (patch.niche !== undefined) db.niche = patch.niche || null;
      if (patch.platform !== undefined) db.platform = patch.platform ? patch.platform.toLowerCase() : null;
      if (patch.pattern !== undefined) db.pattern = patch.pattern || null;
      if (patch.result !== undefined) db.result = patch.result || null;
      const { error } = await supabase.from("hooks").update(db).eq("id", id);
      if (error) return { error: error.message };
      await reload();
    } else {
      setHooks((prev) => prev.map((h) => (h.id === id ? { ...h, text: patch.text ?? h.text, platform: patch.platform ?? h.platform, pattern: patch.pattern ?? h.pattern, result: patch.result ?? h.result, niche: patch.niche != null ? (nicheLabels[patch.niche as keyof typeof nicheLabels] ?? patch.niche) : h.niche } : h)));
    }
    return {};
  }, [live, reload]);

  return <Ctx.Provider value={{ videos, hooks, loading, live, reload, createVideo, updateVideo, deleteVideo, createHook, updateHook, deleteHook }}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
