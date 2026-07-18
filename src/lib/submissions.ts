import { supabase } from "./supabase";

// Agency-side inbox of what clients filled in their portal. RLS (is_member_of)
// already scopes these rows to the signed-in agency; we only read the unseen
// ones for the notification bell and mark them seen when the panel opens.

export type ClientSubmission = {
  id: string;
  clientId: string;
  kind: "onboarding" | "results";
  periodMonth: string | null; // YYYY-MM-DD (only for results)
  createdAt: string;          // ISO timestamp
};

export async function fetchUnseenSubmissions(): Promise<ClientSubmission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("client_submissions")
    .select("id, client_id, kind, period_month, created_at")
    .is("seen_at", null)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    kind: (r.kind as ClientSubmission["kind"]) ?? "results",
    periodMonth: r.period_month ?? null,
    createdAt: r.created_at,
  }));
}

export async function markSubmissionsSeen(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  await supabase.from("client_submissions").update({ seen_at: new Date().toISOString() }).in("id", ids);
}
