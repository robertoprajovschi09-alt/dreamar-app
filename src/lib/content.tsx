import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useWorkspace } from "./workspace";
import { useClients } from "./clients";

let demoPostSeq = 0; // collision-free temp ids for demo-created posts

// UI post status mirrors the DB post_status enum, except the DB's
// 'sent_for_approval' is shown as 'approval' in the calendar.
export type UIPostStatus =
  | "idea" | "script" | "filming" | "editing" | "approval" | "approved" | "scheduled" | "published" | "analyzed";

export type ContentPost = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  platform: string; // proper-cased label
  status: UIPostStatus;
  date: string | null; // ISO yyyy-mm-dd (scheduled_date)
  script: string;
  approvalStatus?: string | null; // pending | approved | approved_with_changes | rejected | withdrawn | null
};

export type NewPostInput = {
  clientId: string;
  title: string;
  platform: string;
  status: UIPostStatus;
  date: string | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube",
  linkedin: "LinkedIn", twitter: "Twitter", whatsapp: "WhatsApp",
};
const uiToDbStatus = (s: UIPostStatus): string => (s === "approval" ? "sent_for_approval" : s);
const dbToUiStatus = (s: string): UIPostStatus => (s === "sent_for_approval" ? "approval" : (s as UIPostStatus));

// Demo posts (the calendar's previous inline sample), dated in the current
// sandbox month so they land on the live-style grid.
const D = (day: number) => `2026-06-${String(day).padStart(2, "0")}`;
const SAMPLE_POSTS: ContentPost[] = [
  { id: "p1", clientId: "altmark", clientName: "Altmark", title: "Tur proprietate — Sky 2 camere", platform: "TikTok", status: "published", date: D(2), script: "" },
  { id: "p2", clientId: "auralux", clientName: "AuraLux", title: "Tutorial glass skin", platform: "TikTok", status: "scheduled", date: D(3), script: "" },
  { id: "p3", clientId: "verde", clientName: "Verde", title: "Scenetă cu meniul", platform: "Instagram", status: "editing", date: D(5), script: "" },
  { id: "p4", clientId: "ironpeak", clientName: "IronPeak", title: "Reel transformare", platform: "Instagram", status: "approval", date: D(9), script: "" },
  { id: "p5", clientId: "smile", clientName: "SmileLab", title: "Mituri despre albire", platform: "Instagram", status: "script", date: D(10), script: "" },
  { id: "p6", clientId: "lumen", clientName: "Lumen", title: "Program de vineri", platform: "Instagram", status: "idea", date: D(12), script: "" },
  { id: "p7", clientId: "altmark", clientName: "Altmark", title: "Prezentare Garden 3 camere", platform: "YouTube", status: "filming", date: D(16), script: "" },
  { id: "p8", clientId: "ironpeak", clientName: "IronPeak", title: "Întrebări și răspunsuri cu antrenorul", platform: "TikTok", status: "approved", date: D(17), script: "" },
  { id: "p9", clientId: "mareluna", clientName: "Mare Luna", title: "Dezvăluire suită", platform: "Instagram", status: "scheduled", date: D(18), script: "" },
  { id: "p10", clientId: "drivex", clientName: "DriveX", title: "Noutăți în stoc", platform: "Facebook", status: "idea", date: D(23), script: "" },
  { id: "p11", clientId: "auralux", clientName: "AuraLux", title: "Promo luciu pentru păr", platform: "Instagram", status: "script", date: D(24), script: "" },
  { id: "p12", clientId: "altmark", clientName: "Altmark", title: "Recapitulare open house", platform: "TikTok", status: "scheduled", date: D(25), script: "" },
];

type ContentCtx = {
  posts: ContentPost[];
  loading: boolean;
  live: boolean;
  reload: () => Promise<void>;
  createPost: (input: NewPostInput) => Promise<{ error?: string; id?: string }>;
  updatePost: (id: string, patch: Partial<{ title: string; status: UIPostStatus; date: string | null; script: string; approvalStatus: string | null }>) => Promise<{ error?: string }>;
  deletePost: (id: string) => Promise<{ error?: string }>;
  // Agency action: send a post to the client for approval (creates/refreshes an
  // `approvals` row; the client then decides from their portal).
  requestApproval: (post: ContentPost) => Promise<{ error?: string }>;
};

const Ctx = createContext<ContentCtx | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ContentPost {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.name ?? "—",
    title: r.title,
    platform: r.platform ? (PLATFORM_LABEL[r.platform] ?? r.platform) : "",
    status: dbToUiStatus(r.status),
    date: r.scheduled_date ?? null,
    script: r.script ?? "",
    approvalStatus: r.approval_status ?? null,
  };
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { clients } = useClients();
  const agencyId = currentAgency.id;
  const agencyRef = useRef(agencyId);
  agencyRef.current = agencyId;
  const [posts, setPosts] = useState<ContentPost[]>(live ? [] : SAMPLE_POSTS);
  const [loading, setLoading] = useState(live);

  const reload = useCallback(async () => {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("content_posts")
      .select("id, client_id, title, platform, status, approval_status, scheduled_date, script, client:clients(name)")
      .eq("agency_id", agencyId)
      .order("scheduled_date", { ascending: true, nullsFirst: false });
    if (agencyRef.current !== agencyId) return; // drop stale response after an agency switch
    if (error) console.error("[content] load failed:", error.message);
    if (!error && data) setPosts(data.map(mapRow));
    setLoading(false);
  }, [live, agencyId]);

  useEffect(() => {
    if (!live) { setPosts(SAMPLE_POSTS); setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
  }, [live, agencyReady, agencyId, reload]);

  const createPost = useCallback(async (input: NewPostInput) => {
    if (!live || !supabase || !agencyId) {
      // demo: append locally with a collision-free id + the real client name
      const id = "demo-" + ++demoPostSeq;
      const clientName = clients.find((c) => c.id === input.clientId)?.name ?? input.clientId;
      setPosts((prev) => [...prev, { id, clientId: input.clientId, clientName, title: input.title, platform: input.platform, status: input.status, date: input.date, script: "" }]);
      return { id };
    }
    const { data, error } = await supabase.from("content_posts").insert({
      agency_id: agencyId,
      client_id: input.clientId,
      title: input.title,
      platform: input.platform ? input.platform.toLowerCase() : null,
      status: uiToDbStatus(input.status),
      scheduled_date: input.date,
    }).select("id").single();
    if (error) return { error: error.message };
    if (!data?.id) return { error: "Postarea nu a fost creată." };
    await reload();
    return { id: data.id as string };
  }, [live, agencyId, reload, clients]);

  const updatePost = useCallback(async (id: string, patch: Partial<{ title: string; status: UIPostStatus; date: string | null; script: string; approvalStatus: string | null; platform: string; notes: string }>) => {
    // optimistic local update
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (!live || !supabase) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch: any = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.status !== undefined) dbPatch.status = uiToDbStatus(patch.status);
    if (patch.date !== undefined) dbPatch.scheduled_date = patch.date;
    if (patch.script !== undefined) dbPatch.script = patch.script;
    if (patch.approvalStatus !== undefined) dbPatch.approval_status = patch.approvalStatus;
    if (patch.platform !== undefined) dbPatch.platform = patch.platform ? patch.platform.toLowerCase() : null;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes || null;
    const { error } = await supabase.from("content_posts").update(dbPatch).eq("id", id);
    if (error) { console.error("[content] update failed:", error.message); return { error: error.message }; }
    return {};
  }, [live]);

  const deletePost = useCallback(async (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (!live || !supabase) return {};
    const { error } = await supabase.from("content_posts").delete().eq("id", id);
    if (error) return { error: error.message };
    return {};
  }, [live]);

  const requestApproval = useCallback(async (post: ContentPost) => {
    // optimistic: move to "Pentru aprobare" with a pending client decision
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: "approval", approvalStatus: "pending" } : p)));
    if (!live || !supabase || !agencyId) return {};

    // Reuse an existing approval row for this post (avoid duplicate pending rows
    // in the client's portal); otherwise create one. The DB trigger then copies
    // status -> content_posts.approval_status.
    const { data: existing } = await supabase
      .from("approvals")
      .select("id, status")
      .eq("entity_type", "post").eq("entity_id", post.id)
      .order("created_at", { ascending: false }).limit(1);
    const row = existing?.[0];

    let approvalErr: string | undefined;
    if (row && row.status !== "pending") {
      // Reset the clock too — a resend is a fresh request; stale requested_at
      // makes the weekly "stuck >48h" queue flag it immediately.
      const { error } = await supabase.from("approvals").update({ status: "pending", requested_at: new Date().toISOString(), comments: null, change_requests: null }).eq("id", row.id);
      approvalErr = error?.message;
    } else if (!row) {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("approvals").insert({
        agency_id: agencyId, client_id: post.clientId, entity_type: "post", entity_id: post.id,
        status: "pending", requested_by: u.user?.id ?? null,
      });
      approvalErr = error?.message;
    }
    if (approvalErr) {
      // Revert the optimistic move before reloading, in case reload fails.
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      await reload();
      // Friendly message for the plan feature gate (enforce_approval_workflow_feature).
      if (/approval_workflow|plan_feature_required/i.test(approvalErr)) {
        return { error: "Aprobările clienților fac parte din planul Growth sau superior. Treci la un plan superior pentru a trimite conținut spre aprobare." };
      }
      return { error: approvalErr };
    }
    // Keep the production stage in sync so the calendar shows "Pentru aprobare".
    const { error: stErr } = await supabase.from("content_posts").update({ status: "sent_for_approval" }).eq("id", post.id);
    await reload();
    if (stErr) return { error: stErr.message };
    return {};
  }, [live, agencyId, reload]);

  return (
    <Ctx.Provider value={{ posts, loading, live, reload, createPost, updatePost, deletePost, requestApproval }}>
      {children}
    </Ctx.Provider>
  );
}

export function useContent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContent must be used within ContentProvider");
  return ctx;
}
