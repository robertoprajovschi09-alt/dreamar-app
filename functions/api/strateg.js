/*
 * POST /api/strateg — server-side proxy to the NVIDIA-hosted "Strateg" model.
 *
 * The API key lives ONLY in the NVIDIA_API_KEY environment variable. It is never
 * sent to the client and never logged. The client sends its Supabase session
 * token; without a valid session the request is rejected. The upstream response
 * is streamed back as SSE, with reasoning tokens stripped (only `content` ships).
 *
 * Cloudflare Pages env / bindings (set in the dashboard, never in git):
 *   NVIDIA_API_KEY        (required)  the NVIDIA integrate key
 *   STRATEG_MODEL         (optional)  model id, defaults to "z-ai/glm-5.2"
 *   STRATEG_SYSTEM_PROMPT (optional)  overrides the built-in system prompt (Promptul 12)
 *   SUPABASE_URL          (required)  for verifying the caller's session
 *   SUPABASE_ANON_KEY     (required)  apikey used with the session check
 *   STRATEG_RL            (optional)  KV namespace binding for per-session rate limiting
 */

const UPSTREAM = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "z-ai/glm-5.2";
const REQUEST_TIMEOUT_MS = 60000;
const RATE_MAX = 10; // requests / minute / session
const RATE_WINDOW_MS = 60000;

// Per-room generation parameters, fixed on the server (no seed).
const ROOM_PARAMS = {
  analiza: { temperature: 0.4, max_tokens: 8192 },
  scripturi: { temperature: 0.9, max_tokens: 4096 },
  obiective: { temperature: 0.5, max_tokens: 2048 },
  reincercat: { temperature: 0.5, max_tokens: 4096 },
  brainstorm: { temperature: 1.0, max_tokens: 4096 },
};

// Placeholder for "Promptul 12". Replace this text (or set STRATEG_SYSTEM_PROMPT)
// with the real strategist system prompt.
const DEFAULT_SYSTEM_PROMPT =
  "Ești Strategul agenției Dr Dream. Răspunzi scurt, clar și acționabil, în română, " +
  "folosind doar datele reale primite. Nu inventezi cifre. Fără limbaj de marketing.";

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Verify the caller's Supabase session by asking Supabase who the token belongs to.
async function getUser(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

// Sliding-window rate limit per session, backed by a KV namespace. If no KV is
// bound we cannot keep state, so we allow the request rather than break the app.
async function withinRateLimit(env, userId) {
  const kv = env.STRATEG_RL;
  if (!kv) return true;
  const key = `rl:${userId}`;
  const now = Date.now();
  let hits = [];
  try { hits = JSON.parse((await kv.get(key)) || "[]"); } catch { hits = []; }
  hits = hits.filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  await kv.put(key, JSON.stringify(hits), { expirationTtl: 120 });
  return true;
}

// Re-emit the upstream stream as SSE with ONLY `content` deltas (reasoning dropped).
function streamContentOnly(upstreamBody) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const done = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      try {
        while (true) {
          const { done: finished, value } = await reader.read();
          if (finished) break;
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") { done(); continue; }
            try {
              const delta = JSON.parse(payload).choices?.[0]?.delta;
              // Only content reaches the client. reasoning_content (or any other
              // reasoning field) is deliberately never forwarded.
              if (delta && typeof delta.content === "string" && delta.content.length) {
                send({ content: delta.content });
              }
            } catch { /* skip a malformed chunk */ }
          }
        }
        done();
      } catch {
        send({ error: "Strategul s-a întrerupt. Încearcă din nou." });
      } finally {
        controller.close();
      }
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const user = await getUser(request, env);
  if (!user) return jsonError(401, "Trebuie să fii autentificat.");

  if (!env.NVIDIA_API_KEY) return jsonError(503, "Strategul nu e configurat momentan.");

  if (!(await withinRateLimit(env, user.id))) {
    return jsonError(429, "Strategul are nevoie de o pauză scurtă. Încearcă din nou într-un minut.");
  }

  let body;
  try { body = await request.json(); } catch { return jsonError(400, "Cerere invalidă."); }
  const room = typeof body.room === "string" ? body.room : "analiza";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const snapshot = body.snapshot ?? {};
  const params = ROOM_PARAMS[room] || ROOM_PARAMS.analiza;

  // System 1 = the strategist prompt; System 2 = the serialized data snapshot;
  // then the conversation so far.
  const composed = [
    { role: "system", content: env.STRATEG_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT },
    { role: "system", content: "Instantaneu de date:\n" + JSON.stringify(snapshot) },
    ...messages
      .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.STRATEG_MODEL || DEFAULT_MODEL,
        messages: composed,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return jsonError(504, "Strategul nu a răspuns la timp. Încearcă din nou.");
  }
  clearTimeout(timer);

  if (!upstream.ok || !upstream.body) {
    // Never leak the upstream body or the key; map to a clear, friendly message.
    const msg = upstream.status === 401 || upstream.status === 403
      ? "Cheia strategului nu e validă. Verifică setările."
      : "Strategul nu a putut răspunde acum. Încearcă din nou.";
    return jsonError(502, msg);
  }

  return new Response(streamContentOnly(upstream.body), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
