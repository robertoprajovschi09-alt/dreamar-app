/*
 * Worker entry (Cloudflare Workers + static assets).
 * /api/strateg -> the existing Pages-style handler in functions/api/strateg.js
 * everything else -> static assets (SPA fallback to index.html).
 */
import { onRequestPost } from "./api/strateg.js";

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
    return env.ASSETS.fetch(request);
  },
};
