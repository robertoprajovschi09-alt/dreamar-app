import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Env-driven client. Until VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set
// (see .env.example), `supabase` is null and the app keeps running on its
// sample data — so Phase 8 wiring can land page-by-page behind this flag
// without breaking the demo or the marketing site.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// Use this in data hooks: throws a clear error if called before configuration,
// so a half-wired page fails loudly in dev rather than silently.
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return supabase;
}

// --- Storage helpers ---
// With the new `sb_publishable_…` key format, supabase-js's storage client sends
// the publishable key as the bearer token instead of the signed-in user's access
// token, so every storage write lands as `anon` and trips RLS. These helpers issue
// the request directly with the real session token (proven to satisfy RLS).
async function authHeaders(): Promise<Record<string, string> | null> {
  if (!supabase || !anon) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, apikey: anon };
}

export async function storageUpload(bucket: string, path: string, file: File, opts?: { upsert?: boolean }): Promise<{ error?: string }> {
  const h = await authHeaders();
  if (!h) return { error: "Not signed in" };
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: { ...h, "Content-Type": file.type || "application/octet-stream", "x-upsert": opts?.upsert ? "true" : "false" },
    body: file,
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); return { error: `Upload failed (${res.status}) ${t.slice(0, 120)}` }; }
  return {};
}

export async function storageRemove(bucket: string, path: string): Promise<{ error?: string }> {
  const h = await authHeaders();
  if (!h) return { error: "Not signed in" };
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(path)}`, { method: "DELETE", headers: h });
  if (!res.ok && res.status !== 404) { const t = await res.text().catch(() => ""); return { error: `Delete failed (${res.status}) ${t.slice(0, 120)}` }; }
  return {};
}

export async function storageSignedUrl(bucket: string, path: string, expiresIn = 60): Promise<{ url?: string; error?: string }> {
  const h = await authHeaders();
  if (!h) return { error: "Not signed in" };
  const res = await fetch(`${url}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); return { error: `Couldn't sign (${res.status}) ${t.slice(0, 120)}` }; }
  const body = await res.json();
  return { url: `${url}/storage/v1${body.signedURL}` };
}

export function storagePublicUrl(bucket: string, path: string): string {
  return `${url}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}
