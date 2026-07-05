/*
 * drea.mar service worker — fast repeat loads, safe deploys.
 * - Navigations: network-first (a new Cloudflare deploy always wins), with the
 *   cached shell as an offline fallback.
 * - Same-origin static assets (Vite hashes them): cache-first, then network.
 * - Cross-origin (Supabase API/auth, Google Fonts) is never touched.
 * Bump CACHE to force old caches out on the next activate.
 */
const CACHE = "dreamar-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Supabase / fonts alone

  // Navigations: network-first so deploys are never stuck; fall back to shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a clean, same-origin, 2xx, non-redirected page may become the
          // cached offline shell — never a 5xx/404/redirect.
          if (res && res.ok && res.type === "basic" && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first, then network (and cache what we fetch).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
