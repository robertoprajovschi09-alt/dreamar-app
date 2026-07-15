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
    .select("client_id, client_name, niche, agency_name, agency_website, agency_city, agency_whatsapp")
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
    },
  };
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
