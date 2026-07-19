import { supabase } from "./supabase";

/*
 * Real Web Push subscription management (client side). The device subscribes via
 * the service worker, and the subscription is stored in push_subscriptions so the
 * cron worker can reach it. On iOS this only works once the app is installed to
 * the home screen (standalone) — see isStandalone().
 */

export function isPushSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator
    && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

// iOS grants push only to a home-screen (standalone) install.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (navigator as any).standalone === true;
  return !!mm || iosStandalone;
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Subscribe this device (if needed) and store the subscription for the agency.
export async function ensurePushSubscription(agencyId: string): Promise<{ error?: string; count?: number }> {
  if (!isPushSupported()) return { error: "Dispozitivul nu acceptă notificări push." };
  if (!supabase) return { error: "Serviciul nu este configurat." };
  if (!agencyId) return { error: "Nicio agenție selectată." };

  try {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { error: "Permisiunea pentru notificări a fost refuzată." };
    }

    const reg = await navigator.serviceWorker.ready;

    const res = await fetch("/api/push/public-key");
    const { key } = await res.json();
    if (!key) return { error: "Cheia de notificări lipsește pe server." };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) as unknown as BufferSource });
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return { error: "Abonamentul de notificări este incomplet." };

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const profileId = userData.user?.id;
    if (userErr) return { error: "Sesiune: " + userErr.message };
    if (!profileId) return { error: "Nu ești autentificat (fără sesiune)." };

    const { data: written, error } = await supabase.from("push_subscriptions").upsert(
      { profile_id: profileId, agency_id: agencyId, endpoint, p256dh, auth, user_agent: navigator.userAgent },
      { onConflict: "endpoint" },
    ).select("id");
    if (error) return { error: error.message };
    // The write returned no row → RLS accepted nothing (silent drop). Surface it.
    if (!written || written.length === 0) return { error: "Scriere goală (RLS/agenție). agency=" + agencyId.slice(0, 8) };
    return { count: written.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nu s-au putut activa notificările." };
  }
}

// Unsubscribe this device and drop its stored subscription.
export async function disablePushSubscription(): Promise<{ error?: string }> {
  if (!isPushSupported() || !supabase) return {};
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nu s-au putut opri notificările." };
  }
}
