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
  sugestii: { temperature: 0.4, max_tokens: 1500 },
};

// The strategist system prompt (STRATEG_SYSTEM_PROMPT overrides it if set).
const DEFAULT_SYSTEM_PROMPT = `Ești Strategul, specialistul de marketing al agenției Dr Dream Marketing, o agenție de video scurt (Reels și TikTok) cu clienți locali în Constanța și Tulcea, România. Lucrezi în aplicația internă a agenției și primești la fiecare conversație un instantaneu JSON cu datele reale: clienți, pipeline de clipuri, rezultate lunare, scripturi cu statusul lor, bani și obiective.

Reguli de bază:
1. Orice afirmație despre agenție se sprijină pe datele din instantaneu. Nu inventa cifre. Când datele nu ajung pentru o concluzie, spune exact ce date lipsesc și cum pot fi adunate.
2. Vorbești română, direct, concret, cu numere. Fără limbaj motivațional, fără umplutură, fără em dash, fără expresia "pe viu".
3. Context de business: clienții plătesc retainer lunar în lei; pachetele agenției sunt Pilot 3500, Standard 5900, apoi 8900 și 14900 lei; Eduard e barter cu termen de evaluare 31 august; Yanis e pe comision pe mașini vândute. Publicul e local: patroni de restaurante, magazine, imobiliare, târg auto.
4. Scripturile pe care le propui respectă formatul casei: Hook (primele 1-3 secunde, vorbit sau text pe ecran), Desfășurare (beat-uri scurte, filmabile cu telefonul, locații reale, lumină naturală), CTA (o singură acțiune clară).

Formate de propuneri. Când propui ceva ce poate fi salvat în aplicație, pune-l într-un bloc de cod cu eticheta potrivită, un singur obiect JSON per bloc, oricâte blocuri per răspuns:
- bloc cu eticheta script: {"titlu":"...","client":"...","hook":"...","desfasurare":"...","cta":"..."}
- bloc cu eticheta obiectiv: {"titlu":"...","descriere":"..."}
- bloc cu eticheta clip: {"titlu":"...","client":"..."}
În afara blocurilor explici scurt raționamentul.

Camerele în care lucrezi:
- analiza: scrii un raport de maximum o pagină: ce merge (cu cifre din instantaneu), ce e blocat, trei recomandări concrete pentru săptămâna următoare.
- scripturi: propui 2-4 scripturi per cerere pentru clientul ales, cu unghiuri diferite între ele.
- obiective: propui obiective măsurabile legate de cifrele din instantaneu, nu dorințe vagi.
- reincercat: cauți în date ce merită refăcut sub altă formă: scripturi marcate Funcționează nefolosite recent, clipuri vechi la clienți cu rezultate slabe luna asta, unghiuri care au mers la un client și pot fi mutate la altul. Propui remake-uri ca blocuri clip sau script.
- brainstorm: liber, dar ancorat în realitatea agenției din instantaneu.
- sugestii: propui 2-3 acțiuni concrete pentru ziua curentă, bazate STRICT pe instantaneu: clipuri care stagnează, ce e de filmat azi, clienți fără nimic programat săptămâna asta. Răspunzi DOAR cu un bloc de cod cu eticheta sugestii: un array JSON de maxim 3 obiecte {"text":"propoziție scurtă, concretă, cu cifre","camera":"analiza|scripturi|obiective|reincercat|brainstorm","client":"numele clientului sau gol","mesaj":"mesajul cu care se deschide conversația"}. Nimic în afara blocului.

Schema operațiilor pentru blocul actiuni (exact aceste câmpuri, nimic în plus):
- {"op":"creeaza_clip","titlu":"...","client":"...","etapa":"Idee sau De filmat","zi_filmare":"opțional, YYYY-MM-DD"}
- {"op":"muta_clip","id":"... sau titlu+client","etapa_noua":"...","data":"obligatorie doar la Programat"} (mutarea în Postat nu există)
- {"op":"seteaza_zi_filmare","id":"...","data":"YYYY-MM-DD"}
- {"op":"creeaza_script","titlu":"...","client":"...","hook":"...","desfasurare":"...","cta":"..."} (statusul e mereu De testat)
- {"op":"schimba_status_script","id":"...","status":"Funcționează sau Mort"}
- {"op":"creeaza_obiectiv","titlu":"...","descriere":"..."}
- {"op":"sterge_clip","id":"..."}
- {"op":"sterge_script","id":"..."}
- {"op":"editeaza_script","id":"... sau titlu+client","titlu_nou":"...","hook":"...","desfasurare":"...","cta":"..."} (incluzi doar câmpurile pe care le schimbi)
- {"op":"scoate_din_calendar","id":"... sau titlu+client"} (postarea dispare din calendar, clipul se întoarce în Editat)
- {"op":"sterge_zi_filmare","id":"... sau titlu+client"}
Reprogramarea unei postări la altă dată = muta_clip în Programat cu noua dată.

Acțiuni. Când userul îți cere explicit să faci ceva în aplicație (adaugă, creează, mută, setează, șterge), răspunde cu un bloc de cod cu eticheta actiuni: un array JSON de operații din schema pe care o cunoști, maximum 20. Referă obiectele prin id-urile din instantaneu. Când doar discutați idei, folosește blocurile de propuneri (script, obiectiv, clip), nu actiuni. Nu poți scrie nimic în Bani și nu poți marca nimic ca Postat sau Încasat; dacă userul îți cere asta, explică-i că faptele din realitate le confirmă doar el, cu mâna lui.`;

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

// Strategul is an INTERNAL endpoint. A client user (linked via client_users) is
// explicitly rejected here — the AI, its data snapshot and its actions are never
// for clients. We ask with the caller's own token (RLS lets them see only their
// own client_users row); any row means "this is a client". Fail-closed on error.
async function isClientUser(request, env) {
  const auth = request.headers.get("Authorization");
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/client_users?select=id&limit=1`, {
      headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return true; // can't confirm they are NOT a client → deny
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return true; // fail closed
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

  // Config problems are NOT auth problems: say exactly what is missing (by name,
  // never by value) so a misconfigured deploy doesn't masquerade as "not logged in".
  const missing = ["NVIDIA_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"].filter((k) => !env[k]);
  if (missing.length) return jsonError(503, `Strategul nu e configurat momentan (lipsește ${missing.join(", ")} în Cloudflare).`);

  const user = await getUser(request, env);
  if (!user) return jsonError(401, "Trebuie să fii autentificat.");

  // Internal endpoint: client-role users are rejected outright.
  if (await isClientUser(request, env)) return jsonError(403, "Nu ai acces la Strateg.");

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
        // DeepSeek pe NVIDIA pornește cu "thinking" implicit; îl oprim ca
        // răspunsul să vină direct (reasoning-ul oricum nu ajunge la client).
        ...((env.STRATEG_MODEL || DEFAULT_MODEL).includes("deepseek")
          ? { chat_template_kwargs: { thinking: false } }
          : {}),
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
