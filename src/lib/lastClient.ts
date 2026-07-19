// Remembers the last client a clip was created for, so the create modals can
// pre-select it — you usually work in bursts on the same client.
const KEY = "dreamar-last-client-id";

export function getLastClientId(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function rememberLastClientId(id: string | null | undefined): void {
  try { if (id) localStorage.setItem(KEY, id); } catch { /* private mode */ }
}

// Prefill value for a client <select>: an explicit id (e.g. the client opened in
// Pipeline level 2) always wins; otherwise fall back to the remembered client,
// but only if it still exists in the current list.
export function prefillClientId(clients: { id: string }[], explicit?: string | null): string {
  if (explicit) return explicit;
  const last = getLastClientId();
  return last && clients.some((c) => c.id === last) ? last : "";
}
