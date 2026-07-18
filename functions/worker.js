/*
 * Worker entry (Cloudflare Workers + static assets).
 * /api/strateg -> the existing Pages-style handler in functions/api/strateg.js
 * everything else -> static assets (SPA fallback to index.html).
 */
import { onRequestPost } from "./api/strateg.js";
import { runReminders } from "./push/reminders.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/strateg") {
      if (request.method === "POST") return onRequestPost({ request, env, ctx });
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", Allow: "POST" },
      });
    }
    // The VAPID public key is not a secret — the frontend needs it to subscribe.
    if (url.pathname === "/api/push/public-key") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405, headers: { "Content-Type": "application/json", Allow: "GET" },
        });
      }
      return new Response(JSON.stringify({ key: env.VAPID_PUBLIC_KEY || "" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },

  // Runs every minute (see wrangler.jsonc crons): fire due post-time reminders.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runReminders(env));
  },
};
