import { supabase } from "./supabase";

// Client portal data — reads ONLY the two whitelist views (client_me,
// client_clips). No raw tables, no owner data. Every field here is on the
// Phase 1 whitelist.

export type PortalStatus = "În lucru" | "Programat" | "Livrat";

export type PortalMe = {
  clientId: string;
  clientName: string;
  niche: string;
  agencyName: string;
  agencyWebsite: string | null;
  agencyCity: string | null;
  agencyWhatsapp: string | null;
  onboardedAt: string | null;
};

export type PortalClip = {
  id: string;
  title: string;
  status: PortalStatus;
  videoLink: string | null;
  postDate: string | null;   // YYYY-MM-DD
  filmDate: string | null;   // YYYY-MM-DD
};

export async function fetchPortalMe(): Promise<{ me?: PortalMe; error?: string }> {
  if (!supabase) return { error: "Portalul nu este configurat." };
  const { data, error } = await supabase
    .from("client_me")
    .select("client_id, client_name, niche, agency_name, agency_website, agency_city, agency_whatsapp, onboarding_completed_at")
    .limit(1);
  if (error) return { error: error.message };
  const r = data?.[0];
  if (!r) return { error: "Nu găsim contul tău." };
  return {
    me: {
      clientId: r.client_id,
      clientName: r.client_name ?? "Brandul tău",
      niche: r.niche ?? "custom",
      agencyName: r.agency_name ?? "",
      agencyWebsite: r.agency_website ?? null,
      agencyCity: r.agency_city ?? null,
      agencyWhatsapp: r.agency_whatsapp ?? null,
      onboardedAt: r.onboarding_completed_at ?? null,
    },
  };
}

// ── Client-writable data (via SECURITY DEFINER RPCs; RLS blocks direct writes) ──

export type PortalProfile = {
  brandVoice: string; targetAudience: string;
  objectives: string[]; goals: string[];
  brandProfile: Record<string, unknown>;
  onboardedAt: string | null;
};

export async function fetchMyProfile(): Promise<{ profile?: PortalProfile; error?: string }> {
  if (!supabase) return { error: "Portalul nu este configurat." };
  const { data, error } = await supabase.rpc("client_my_profile");
  if (error) return { error: error.message };
  const r = Array.isArray(data) ? data[0] : data;
  return {
    profile: {
      brandVoice: r?.brand_voice ?? "",
      targetAudience: r?.target_audience ?? "",
      objectives: Array.isArray(r?.objectives) ? r.objectives : [],
      goals: Array.isArray(r?.goals) ? r.goals : [],
      brandProfile: r?.brand_profile ?? {},
      onboardedAt: r?.onboarding_completed_at ?? null,
    },
  };
}

export async function submitOnboarding(input: {
  brandVoice: string; targetAudience: string; objectives: string[]; goals: string[]; brandProfile: Record<string, unknown>;
}): Promise<{ error?: string }> {
  if (!supabase) return { error: "Portalul nu este configurat." };
  const { error } = await supabase.rpc("client_submit_onboarding", {
    p_brand_voice: input.brandVoice || null,
    p_target_audience: input.targetAudience || null,
    p_objectives: input.objectives,
    p_goals: input.goals,
    p_brand_profile: input.brandProfile,
  });
  return { error: error?.message };
}

// The metrics object keys are business_impact_entries columns (see the niche's monthlyMetrics).
export async function fetchMyResults(periodMonth: string): Promise<{ metrics?: Record<string, number | null>; error?: string }> {
  if (!supabase) return { error: "Portalul nu este configurat." };
  const { data, error } = await supabase.rpc("client_my_results", { p_period_month: periodMonth });
  if (error) return { error: error.message };
  const r = Array.isArray(data) ? data[0] : data;
  return { metrics: (r ?? {}) as Record<string, number | null> };
}

export async function submitResults(periodMonth: string, metrics: Record<string, string>): Promise<{ error?: string }> {
  if (!supabase) return { error: "Portalul nu este configurat." };
  const { error } = await supabase.rpc("client_submit_results", { p_period_month: periodMonth, p_metrics: metrics });
  return { error: error?.message };
}

export async function fetchPortalClips(): Promise<{ clips?: PortalClip[]; error?: string }> {
  if (!supabase) return { error: "Portalul nu este configurat." };
  const { data, error } = await supabase
    .from("client_clips")
    .select("id, title, status, video_link, post_date, film_date");
  if (error) return { error: error.message };
  const clips: PortalClip[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? "Clip",
    status: (r.status as PortalStatus) ?? "În lucru",
    videoLink: r.video_link ?? null,
    postDate: r.post_date ?? null,
    filmDate: r.film_date ?? null,
  }));
  return { clips };
}

// Build a wa.me link from a stored number. Accepts Romanian local (07..) or
// international (+40 / 40..) formats; returns null if there is nothing usable.
export function whatsappLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "40" + d.slice(1);       // RO local → international
  if (d.length < 8) return null;
  return `https://wa.me/${d}`;
}
