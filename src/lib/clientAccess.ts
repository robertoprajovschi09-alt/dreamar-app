import { supabase } from "./supabase";

// Client-access (portal) helpers — thin wrappers over the Phase 2 SECURITY
// DEFINER RPCs. Every mutation lives in the database; the client only ever
// holds a raw invite token (never stored server-side, only its SHA-256 hash).

export type InviteState = "niciuna" | "trimisa" | "acceptata" | "expirata" | "revocata";

export type InviteStatus = {
  status: InviteState;
  email: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  invitedAt: string | null;
  accountActive: boolean;   // a live (non-revoked) client account exists
  accountRevoked: boolean;  // an account exists but access was revoked
};

export type InvitePreview = {
  valid: boolean;
  reason: "ok" | "invalid" | "expirat" | "folosit" | "revocat" | string;
  email: string | null;
  clientName: string | null;
  agencyName: string | null;
};

// The invite link carries the token in the URL FRAGMENT, so it never reaches
// server access logs or the Referer header.
export function inviteLink(token: string): string {
  return `${window.location.origin}/accept-invite#${token}`;
}

// Session flag read by the workspace bootstrap: while an invite is being
// accepted, a brand-new client account must NOT trigger agency provisioning.
export const INVITE_ACCEPT_FLAG = "dreamar-invite-accept";
function setAcceptFlag() { try { sessionStorage.setItem(INVITE_ACCEPT_FLAG, "1"); } catch { /* private mode */ } }
export function clearAcceptFlag() { try { sessionStorage.removeItem(INVITE_ACCEPT_FLAG); } catch { /* private mode */ } }

// ---- Owner side (internal client page) -------------------------------------

export async function createInvite(clientId: string, email: string): Promise<{ token?: string; error?: string }> {
  if (!supabase) return { error: "Supabase indisponibil." };
  const { data, error } = await supabase.rpc("client_invite_create", { p_client_id: clientId, p_email: email });
  if (error) return { error: error.message };
  return { token: data as string };
}

export async function getInviteStatus(clientId: string): Promise<{ status?: InviteStatus; error?: string }> {
  if (!supabase) return { error: "Supabase indisponibil." };
  const { data, error } = await supabase.rpc("client_invite_status", { p_client_id: clientId });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { status: { status: "niciuna", email: null, expiresAt: null, acceptedAt: null, invitedAt: null, accountActive: false, accountRevoked: false } };
  }
  return {
    status: {
      status: row.status,
      email: row.email ?? null,
      expiresAt: row.expires_at ?? null,
      acceptedAt: row.accepted_at ?? null,
      invitedAt: row.invited_at ?? null,
      accountActive: !!row.account_active,
      accountRevoked: !!row.account_revoked,
    },
  };
}

export async function revokeAccess(clientId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase indisponibil." };
  const { error } = await supabase.rpc("client_access_revoke", { p_client_id: clientId });
  return { error: error?.message };
}

export async function restoreAccess(clientId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase indisponibil." };
  const { error } = await supabase.rpc("client_access_restore", { p_client_id: clientId });
  return { error: error?.message };
}

// ---- Accept side (public page) ---------------------------------------------

export async function previewInvite(token: string): Promise<{ preview?: InvitePreview; error?: string }> {
  if (!supabase) return { error: "Supabase indisponibil." };
  const { data, error } = await supabase.rpc("client_invite_preview", { p_token: token });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    preview: {
      valid: !!row?.valid,
      reason: row?.reason ?? "invalid",
      email: row?.email ?? null,
      clientName: row?.client_name ?? null,
      agencyName: row?.agency_name ?? null,
    },
  };
}

// Full accept: create the account with the chosen password (auto-confirm is on,
// so the session is immediate), then consume the token + create the client link.
// If the email already has an account, sign in with the given password instead.
export async function acceptWithPassword(token: string, email: string, password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase indisponibil." };
  setAcceptFlag();
  const up = await supabase.auth.signUp({ email, password });
  if (up.error) {
    const already = /already registered|already exists|user already/i.test(up.error.message);
    if (!already) { clearAcceptFlag(); return { error: up.error.message }; }
    const si = await supabase.auth.signInWithPassword({ email, password });
    if (si.error) { clearAcceptFlag(); return { error: "Există deja un cont cu acest email. Dacă e al tău, folosește parola lui." }; }
  }
  const { error } = await supabase.rpc("client_invite_redeem", { p_token: token });
  if (error) { clearAcceptFlag(); return { error: error.message }; }
  // Leave the flag set until the full reload lands on the portal; the workspace
  // bootstrap clears it once it confirms the viewer.
  return {};
}
